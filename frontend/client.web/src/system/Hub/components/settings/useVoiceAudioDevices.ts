import { useCallback, useEffect, useRef, useState } from 'react'
import {
  playAudioOutputTest,
  requestAudioOutputDevice,
  supportsAudioOutputPrompt,
  supportsAudioOutputRouting,
} from '../../../shared/voice/audioOutput'
import type {
  AudioOutputDeviceRequestResult,
  AudioOutputSelection,
} from '../../../shared/voice/audioOutput'
import {
  createVoiceAudioConstraints,
  getVoiceSettings,
} from '../../../shared/voice/voiceSettings'
import type { VoiceSettings } from '../../../shared/voice/voiceSettings'
import {
  getVoiceProcessingCapabilities,
  refineVoiceProcessingCapabilities,
} from '../../../shared/voice/voiceProcessingCapabilities'
import {
  subscribeVoiceInputLevel,
} from '../../../shared/voice/voiceInputEvents'
import type {
  VoiceInputLevelDetail,
} from '../../../shared/voice/voiceInputEvents'
import {
  applyVoiceGainToLevelDb,
  calculateVoiceRms,
  createAutomaticVoiceThresholdState,
  defaultAutomaticVoiceThresholdDb,
  normalizeVoiceLevel,
  resolveVoiceThresholdDb,
  rmsToDecibels,
  updateAutomaticVoiceThreshold,
} from '../../../Server/hooks/voice/voiceActivityModel'
import { microphoneGainPercentToLinearGain } from '../../../Server/hooks/voice/voiceInputGateModel'
import type {
  AutomaticVoiceThresholdState,
} from '../../../Server/hooks/voice/voiceActivityModel'

export type AudioDeviceListStatus =
  | 'loading'
  | 'ready'
  | 'unsupported'
  | 'error'
export type AudioTestStatus = 'idle' | 'starting' | 'running' | 'error'
export type SpeakerTestStatus = AudioTestStatus | 'fallback'
export type SpeakerTestResult = AudioOutputSelection & {
  requestedOutputDeviceId: string
}

type MicrophoneTestResources = {
  animationFrameId: number
  audioContext: AudioContext
  stream: MediaStream
  source: MediaStreamAudioSourceNode
  analyser: AnalyserNode
  silentGain: GainNode
  automaticThreshold: AutomaticVoiceThresholdState
  lastLevelGain: number
  lastPublishedAt: number
}

export function useVoiceAudioDevices(settings: VoiceSettings) {
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([])
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceListStatus, setDeviceListStatus] =
    useState<AudioDeviceListStatus>('loading')
  const [microphoneTestStatus, setMicrophoneTestStatus] =
    useState<AudioTestStatus>('idle')
  const [speakerTestStatus, setSpeakerTestStatus] =
    useState<SpeakerTestStatus>('idle')
  const [voiceProcessingCapabilities, setVoiceProcessingCapabilities] =
    useState(getVoiceProcessingCapabilities)
  const [testInputSample, setTestInputSample] =
    useState<VoiceInputLevelDetail | null>(null)
  const [runtimeInputLevel, setRuntimeInputLevel] =
    useState<VoiceInputLevelDetail | null>(null)
  const testResourcesRef = useRef<MicrophoneTestResources | null>(null)
  const settingsRef = useRef(settings)
  const refreshSequenceRef = useRef(0)
  const microphoneTestSequenceRef = useRef(0)
  const speakerTestSequenceRef = useRef(0)

  const canRouteAudioOutput = supportsAudioOutputRouting()
  const canPromptForAudioOutput = supportsAudioOutputPrompt()
  const supportsKeyboardPushToTalk = !isMobileWithoutHardwareKeyboard()

  const refreshDevices = useCallback(async (requestPermission = false) => {
    const sequence = ++refreshSequenceRef.current

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      setInputDevices([])
      setOutputDevices([])
      setDeviceListStatus('unsupported')
      return
    }

    setDeviceListStatus('loading')

    try {
      if (requestPermission && navigator.mediaDevices.getUserMedia) {
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })
        permissionStream.getTracks().forEach((track) => track.stop())
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      if (sequence !== refreshSequenceRef.current) {
        return
      }

      setInputDevices(
        devices.filter(
          (device) =>
            device.kind === 'audioinput' && device.deviceId !== 'default',
        ),
      )
      setOutputDevices(
        devices.filter(
          (device) =>
            device.kind === 'audiooutput' && device.deviceId !== 'default',
        ),
      )
      setDeviceListStatus('ready')
    } catch {
      if (sequence === refreshSequenceRef.current) {
        setDeviceListStatus('error')
      }
    }
  }, [])

  const stopMicrophoneTest = useCallback(() => {
    microphoneTestSequenceRef.current += 1
    const resources = testResourcesRef.current
    testResourcesRef.current = null

    disposeMicrophoneTestResources(resources)

    setTestInputSample(null)
    setMicrophoneTestStatus('idle')
  }, [])

  const replaceMicrophoneTest = useCallback(async (
    requestedInputDeviceId?: string,
  ) => {
    const previousResources = testResourcesRef.current
    const sequence = ++microphoneTestSequenceRef.current
    let pendingStream: MediaStream | null = null
    let pendingAudioContext: AudioContext | null = null

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === 'undefined'
    ) {
      setMicrophoneTestStatus('error')
      return
    }

    if (!previousResources) {
      setMicrophoneTestStatus('starting')
    }

    try {
      const requestedSettings = requestedInputDeviceId === undefined
        ? settingsRef.current
        : {
            ...settingsRef.current,
            inputDeviceId: requestedInputDeviceId,
          }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: createVoiceAudioConstraints(requestedSettings),
      })
      pendingStream = stream
      if (sequence !== microphoneTestSequenceRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        pendingStream = null
        return
      }

      const inputTrack = stream.getAudioTracks()[0]
      if (inputTrack?.applyConstraints) {
        try {
          await inputTrack.applyConstraints(
            createVoiceAudioConstraints(requestedSettings),
          )
        } catch {
          // The applied settings below still expose the browser's actual support.
        }
        if (sequence !== microphoneTestSequenceRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          pendingStream = null
          return
        }
      }
      if (inputTrack?.getSettings) {
        setVoiceProcessingCapabilities(
          refineVoiceProcessingCapabilities(
            getVoiceProcessingCapabilities(),
            inputTrack.getSettings(),
          ),
        )
      }

      const audioContext = new AudioContext()
      pendingAudioContext = audioContext
      await audioContext.resume()
      if (sequence !== microphoneTestSequenceRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        void audioContext.close()
        pendingStream = null
        pendingAudioContext = null
        return
      }

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      const silentGain = audioContext.createGain()

      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.45
      const samples = new Uint8Array(new ArrayBuffer(analyser.fftSize))
      silentGain.gain.value = 0
      source.connect(analyser)
      analyser.connect(silentGain)
      silentGain.connect(audioContext.destination)

      const resources = {
        animationFrameId: 0,
        audioContext,
        stream,
        source,
        analyser,
        silentGain,
        automaticThreshold:
          previousResources?.automaticThreshold ??
          createAutomaticVoiceThresholdState(),
        lastLevelGain: microphoneGainPercentToLinearGain(
          settingsRef.current.microphoneGainPercent,
        ),
        lastPublishedAt: 0,
      }
      testResourcesRef.current = resources
      disposeMicrophoneTestResources(previousResources)
      pendingStream = null
      pendingAudioContext = null

      const updateLevel = (now: number) => {
        if (testResourcesRef.current !== resources) {
          return
        }

        analyser.getByteTimeDomainData(samples)
        const levelGain = microphoneGainPercentToLinearGain(
          settingsRef.current.microphoneGainPercent,
        )
        if (levelGain !== resources.lastLevelGain) {
          resources.lastLevelGain = levelGain
          resources.automaticThreshold = createAutomaticVoiceThresholdState()
        }
        const levelDb = applyVoiceGainToLevelDb(
          rmsToDecibels(calculateVoiceRms(samples)),
          levelGain,
        )
        resources.automaticThreshold = updateAutomaticVoiceThreshold(
          resources.automaticThreshold,
          levelDb,
        )

        if (now - resources.lastPublishedAt >= 50) {
          resources.lastPublishedAt = now
          const currentSettings = settingsRef.current
          const thresholdDb = resolveVoiceThresholdDb(
            currentSettings.thresholdMode,
            currentSettings.manualThresholdDb,
            resources.automaticThreshold,
          )
          const inputTrackIsLive = resources.stream
            .getAudioTracks()
            .some(
              (track) =>
                track.enabled &&
                !track.muted &&
                track.readyState === 'live',
            )

          setTestInputSample({
            levelDb,
            normalizedLevel: normalizeVoiceLevel(levelDb),
            thresholdDb,
            isSpeaking: inputTrackIsLive && levelDb >= thresholdDb,
            isTrackLive:
              inputTrackIsLive && audioContext.state === 'running',
          })
        }
        resources.animationFrameId = requestAnimationFrame(updateLevel)
      }

      resources.animationFrameId = requestAnimationFrame(updateLevel)
      setMicrophoneTestStatus('running')
      if (inputTrack?.applyConstraints) {
        void inputTrack
          .applyConstraints(createVoiceAudioConstraints(requestedSettings))
          .then(() => {
            if (testResourcesRef.current !== resources) {
              return
            }
            setVoiceProcessingCapabilities(
              refineVoiceProcessingCapabilities(
                getVoiceProcessingCapabilities(),
                inputTrack.getSettings(),
              ),
            )
          })
          .catch(() => undefined)
      }
      void refreshDevices(false)
    } catch {
      pendingStream?.getTracks().forEach((track) => track.stop())
      void pendingAudioContext?.close()
      if (sequence !== microphoneTestSequenceRef.current) {
        return
      }

      if (
        previousResources &&
        testResourcesRef.current === previousResources
      ) {
        setMicrophoneTestStatus('running')
        return
      }

      setTestInputSample(null)
      setMicrophoneTestStatus('error')
    }
  }, [refreshDevices])

  const startMicrophoneTest = useCallback(
    () => replaceMicrophoneTest(),
    [replaceMicrophoneTest],
  )

  const switchMicrophoneTestInput = useCallback(
    (inputDeviceId: string) => {
      if (!testResourcesRef.current) {
        return Promise.resolve()
      }

      return replaceMicrophoneTest(inputDeviceId)
    },
    [replaceMicrophoneTest],
  )

  const testSpeaker = useCallback(async (): Promise<
    SpeakerTestResult | null
  > => {
    const sequence = ++speakerTestSequenceRef.current
    const requestedOutputDeviceId = settings.outputDeviceId
    setSpeakerTestStatus('starting')

    try {
      const result = await playAudioOutputTest({
        outputDeviceId: requestedOutputDeviceId,
        outputVolumePercent: settings.outputVolumePercent,
      })
      if (
        sequence !== speakerTestSequenceRef.current ||
        getVoiceSettings().outputDeviceId !== requestedOutputDeviceId
      ) {
        return null
      }

      setSpeakerTestStatus(result.didFallback ? 'fallback' : 'idle')
      return {
        ...result,
        requestedOutputDeviceId,
      }
    } catch {
      if (
        sequence !== speakerTestSequenceRef.current ||
        getVoiceSettings().outputDeviceId !== requestedOutputDeviceId
      ) {
        return null
      }

      setSpeakerTestStatus('error')
      return null
    }
  }, [settings.outputDeviceId, settings.outputVolumePercent])

  const chooseAudioOutput =
    useCallback(async (): Promise<AudioOutputDeviceRequestResult> => {
      const result = await requestAudioOutputDevice(settings.outputDeviceId)
      if (result.status === 'selected') {
        await refreshDevices(false)
      }
      return result
    }, [refreshDevices, settings.outputDeviceId])

  useEffect(() => {
    void refreshDevices(false)

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.addEventListener
    ) {
      return
    }

    const handleDeviceChange = () => {
      void refreshDevices(false)
    }
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        handleDeviceChange,
      )
    }
  }, [refreshDevices])

  useEffect(
    () => subscribeVoiceInputLevel(setRuntimeInputLevel),
    [],
  )

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const resources = testResourcesRef.current
    const inputTrack = resources?.stream.getAudioTracks()[0]
    if (!resources || !inputTrack?.applyConstraints) {
      return
    }

    const constraints = createVoiceAudioConstraints(settingsRef.current)
    void inputTrack
      .applyConstraints(constraints)
      .then(() => {
        if (testResourcesRef.current !== resources) {
          return
        }

        setVoiceProcessingCapabilities(
          refineVoiceProcessingCapabilities(
            getVoiceProcessingCapabilities(),
            inputTrack.getSettings(),
          ),
        )
      })
      .catch(() => undefined)
  }, [
    settings.autoGainControl,
    settings.echoCancellation,
    settings.noiseSuppression,
  ])

  useEffect(() => {
    speakerTestSequenceRef.current += 1
    setSpeakerTestStatus((current) =>
      current === 'starting' ? 'idle' : current,
    )
  }, [settings.outputDeviceId])

  useEffect(() => stopMicrophoneTest, [stopMicrophoneTest])

  useEffect(
    () => () => {
      speakerTestSequenceRef.current += 1
    },
    [],
  )

  return {
    chooseAudioOutput,
    deviceListStatus,
    inputDevices,
    inputLevelDb:
      microphoneTestStatus === 'running'
        ? testInputSample?.levelDb ?? -100
        : runtimeInputLevel?.levelDb ?? -100,
    inputThresholdDb:
      microphoneTestStatus === 'running'
        ? testInputSample?.thresholdDb ?? defaultAutomaticVoiceThresholdDb
        : runtimeInputLevel?.thresholdDb ??
          (settings.thresholdMode === 'manual'
            ? settings.manualThresholdDb
            : defaultAutomaticVoiceThresholdDb),
    isInputSpeaking:
      microphoneTestStatus === 'running'
        ? testInputSample?.isSpeaking === true
        : runtimeInputLevel?.isSpeaking === true,
    isInputLive:
      microphoneTestStatus === 'running'
        ? testInputSample?.isTrackLive === true
        : runtimeInputLevel?.isTrackLive === true,
    microphoneTestStatus,
    outputDevices,
    refreshDevices,
    speakerTestStatus,
    startMicrophoneTest,
    stopMicrophoneTest,
    switchMicrophoneTestInput,
    supportsAudioOutputPrompt: canPromptForAudioOutput,
    supportsAudioOutputRouting: canRouteAudioOutput,
    supportsKeyboardPushToTalk,
    testSpeaker,
    voiceProcessingCapabilities,
  }
}

function disposeMicrophoneTestResources(
  resources: MicrophoneTestResources | null,
) {
  if (!resources) {
    return
  }

  cancelAnimationFrame(resources.animationFrameId)
  resources.stream.getTracks().forEach((track) => track.stop())
  resources.source.disconnect()
  resources.analyser.disconnect()
  resources.silentGain.disconnect()
  void resources.audioContext.close()
}

function isMobileWithoutHardwareKeyboard() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const isMobileUserAgent =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const isTouchIPad =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1

  return isMobileUserAgent || isTouchIPad
}
