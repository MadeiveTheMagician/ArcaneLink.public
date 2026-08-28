import { useEffect, useRef, useState } from 'react'
import {
  createStreamingVideoConstraints,
  getStreamingMaxBitrate,
  loadStreamingSettings,
  streamingSettingsChangedEventName,
} from '../../../../shared/streaming/streamingSettings'
import type { StreamingSettings } from '../../../../shared/streaming/streamingSettings'
import { settingsCopy } from '../../../shared/copy'
import { publishVoiceInputLevel } from '../../../shared/voice/voiceInputEvents'
import { subscribeVoicePlaybackUnlock } from '../../../shared/voice/voicePlaybackUnlock'
import {
  createVoiceAudioConstraints,
  getVoiceSettings,
  subscribeVoiceSettings,
  updateVoiceSettings,
} from '../../../shared/voice/voiceSettings'
import type { VoiceSettings } from '../../../shared/voice/voiceSettings'
import { voiceDebug } from './voiceChannelDebug'
import {
  createVoiceInputVadAvailabilityState,
  microphoneGainPercentToLinearGain,
  createSpeakingWhileMutedWarningState,
  isPushToTalkKeyEvent,
  resolveToggledMuteState,
  resolveVoiceInputBackgroundState,
  resolveVoiceInputGateOpen,
  resolveVoiceInputVadGateAvailable,
  updateVoiceInputVadAvailability,
  updateVoiceInputAvailability,
  updateSpeakingWhileMutedWarning,
} from './voiceInputGateModel'
import {
  createVoiceInputPipeline,
  disposeVoiceInputPipeline,
  resumeVoiceInputPipeline,
  setVoiceInputGain,
  setVoiceInputGate,
} from './voiceInputPipeline'
import type { VoiceInputPipeline } from './voiceInputPipeline'
import { resolveVoiceNoiseSuppressionRequest } from './voiceNoiseSuppressionModel'
import type { VoiceNoiseSuppressionTelemetry } from './voiceNoiseSuppressionModel'
import type {
  VoiceActivityMonitorOptions,
  VoiceActivitySample,
} from './useVoiceActivityMonitor'
import type { VoiceVideoSenderKind } from './useVoiceVideoSenders'
import {
  resolveVoiceAudioContext,
  resumeVoiceAudioContext,
} from './voiceAudioContextRecovery'
import {
  resolveVoiceInputTrackRecoveryDelayMs,
  shouldRecoverVoiceInputTrack,
  voiceInputTrackStabilityResetDelayMs,
} from './voiceInputTrackRecovery'

type LocalVoiceState = {
  isMuted: boolean
  isDeafened: boolean
  isCameraEnabled: boolean
  isScreenSharing: boolean
}

type UseLocalVoiceMediaOptions = {
  currentUserId: string
  getLocalParticipantId: () => string | null
  getPeerConnectionIds: () => string[]
  getPeerConnection: (participantId: string) => RTCPeerConnection | null
  getVideoSender: (
    participantId: string,
    kind: VoiceVideoSenderKind,
  ) => RTCRtpSender | null
  renegotiatePeer: (participantId: string) => Promise<void>
  recoverPeerConnection: (participantId: string) => Promise<void>
  onVoiceStateChange: (state: LocalVoiceState) => void
  startVoiceActivityMonitor: (
    participantId: string,
    stream: MediaStream,
    options?: VoiceActivityMonitorOptions,
  ) => void
  resumeVoiceActivityAudioContext: () => Promise<boolean>
  stopVoiceActivityMonitor: (participantId: string) => void
  clearRemoteStreams: () => void
  clearSpeakingParticipants: () => void
}

const retainedPipelineRetryDelaysMs = [1000, 2000, 4000] as const

export function useLocalVoiceMedia({
  currentUserId,
  getLocalParticipantId,
  getPeerConnectionIds,
  getPeerConnection,
  getVideoSender,
  renegotiatePeer,
  recoverPeerConnection,
  onVoiceStateChange,
  startVoiceActivityMonitor,
  resumeVoiceActivityAudioContext,
  stopVoiceActivityMonitor,
  clearRemoteStreams,
  clearSpeakingParticipants,
}: UseLocalVoiceMediaOptions) {
  const localStreamRef = useRef<MediaStream | null>(null)
  const rawAudioStreamRef = useRef<MediaStream | null>(null)
  const voiceInputPipelineRef = useRef<VoiceInputPipeline | null>(null)
  const retainedVoiceInputPipelinesRef = useRef<Set<VoiceInputPipeline>>(
    new Set(),
  )
  const retainedPipelineRetryCountRef = useRef<
    Map<VoiceInputPipeline, number>
  >(new Map())
  const retainedPipelineCleanupTimerRef = useRef<number | null>(null)
  const voiceInputAudioContextRef = useRef<AudioContext | null>(null)
  const noiseSuppressionTelemetryUnsubscribeRef = useRef<
    (() => void) | null
  >(null)
  const voiceSettingsRef = useRef<VoiceSettings>(getVoiceSettings())
  const activeCaptureSettingsRef = useRef<VoiceSettings | null>(null)
  const ensureAudioPromiseRef = useRef<Promise<MediaStream> | null>(null)
  const audioReconfigureChainRef = useRef<Promise<void>>(Promise.resolve())
  const audioReconfigureRequestRef = useRef(0)
  const audioSessionGenerationRef = useRef(0)
  const isVoiceActiveRef = useRef(false)
  const isVoiceActivityContextReadyRef = useRef(true)
  const voiceInputVadAvailabilityRef = useRef(
    createVoiceInputVadAvailabilityState(),
  )
  const lastOutboundAudioGateStateRef = useRef<boolean | null>(null)
  const isPushToTalkPressedRef = useRef(false)
  const speakingWarningRef = useRef(
    createSpeakingWhileMutedWarningState(),
  )
  const lastInputUnavailableWarningAtRef = useRef<number | null>(null)
  const inputUnavailableSinceRef = useRef<number | null>(null)
  const inputTrackRecoveryTimerRef = useRef<number | null>(null)
  const inputTrackStabilityTimerRef = useRef<number | null>(null)
  const inputTrackRecoveryAttemptRef = useRef(0)
  const localVideoStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const stateRef = useRef<LocalVoiceState>({
    isMuted: false,
    isDeafened: false,
    isCameraEnabled: false,
    isScreenSharing: false,
  })
  const [localCameraPreviewStream, setLocalCameraPreviewStream] =
    useState<MediaStream | null>(null)
  const [localScreenPreviewStream, setLocalScreenPreviewStream] =
    useState<MediaStream | null>(null)
  const [hasLocalAudioTrack, setHasLocalAudioTrack] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isCameraEnabled, setIsCameraEnabled] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [noiseSuppressionTelemetry, setNoiseSuppressionTelemetry] =
    useState<VoiceNoiseSuppressionTelemetry | null>(null)

  useEffect(() => {
    return subscribeVoiceSettings((settings) => {
      const previousSettings = voiceSettingsRef.current
      voiceSettingsRef.current = settings
      const activePipeline = voiceInputPipelineRef.current
      const shouldReconfigureInputTransport =
        previousSettings.microphoneGainPercent !==
          settings.microphoneGainPercent &&
        (activePipeline?.transportMode === 'direct' ||
          (settings.microphoneGainPercent === 100 && !settings.mlNoiseSuppression))
      forEachVoiceInputPipeline((pipeline) => {
        setVoiceInputGain(pipeline, settings.microphoneGainPercent)
      })

      if (
        previousSettings.inputMode !== settings.inputMode ||
        previousSettings.pushToTalkKeyCode !== settings.pushToTalkKeyCode
      ) {
        isPushToTalkPressedRef.current = false
      }

      updateRawAudioTrackState()
      updateOutboundAudioGate()
      if (voiceInputPipelineRef.current) {
        void resumeVoiceAudioContexts()
      }

      if (
        localStreamRef.current &&
        (hasCaptureSettingsChanged(
          activeCaptureSettingsRef.current,
          settings,
        ) ||
          shouldReconfigureInputTransport)
      ) {
        queueAudioInputReconfigure()
      }
    })
  })

  useEffect(
    () =>
      subscribeVoicePlaybackUnlock(() => {
        void prepareVoiceAudioContextsForUserGesture()
      }),
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const settings = voiceSettingsRef.current
      if (
        settings.inputMode !== 'push-to-talk' ||
        !settings.pushToTalkKeyCode ||
        isEditableKeyboardTarget(event.target) ||
        !isPushToTalkKeyEvent(event, settings.pushToTalkKeyCode)
      ) {
        return
      }

      isPushToTalkPressedRef.current = true
      void resumeVoiceAudioContexts()
      updateOutboundAudioGate()
      event.preventDefault()
    }

    function handleKeyUp(event: KeyboardEvent) {
      const settings = voiceSettingsRef.current
      if (
        settings.inputMode !== 'push-to-talk' ||
        !settings.pushToTalkKeyCode ||
        event.code !== settings.pushToTalkKeyCode
      ) {
        return
      }

      resetPushToTalkState()
      event.preventDefault()
    }

    function resumeForegroundAudio() {
      void resumeVoiceAudioContexts()
      updateOutboundAudioGate(true)
      const pipeline = voiceInputPipelineRef.current
      if (pipeline) {
        inputTrackRecoveryAttemptRef.current = 0
        scheduleInputTrackRecovery(pipeline)
      }
    }

    function handleBackgroundInputLifecycle() {
      clearInputTrackRecoveryTimer()
      const previousPushToTalkPressed = isPushToTalkPressedRef.current
      const backgroundState = resolveVoiceInputBackgroundState({
        isPushToTalkPressed: previousPushToTalkPressed,
        isVoiceActive: isVoiceActiveRef.current,
      })
      isPushToTalkPressedRef.current = backgroundState.isPushToTalkPressed
      isVoiceActiveRef.current = backgroundState.isVoiceActive
      updateOutboundAudioGate(true)
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') {
        handleBackgroundInputLifecycle()
        return
      }

      resumeForegroundAudio()
    }

    function handlePageShow() {
      if (document.visibilityState === 'visible') {
        resumeForegroundAudio()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', resetPushToTalkState)
    window.addEventListener('pagehide', handleBackgroundInputLifecycle)
    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', resetPushToTalkState)
      window.removeEventListener('pagehide', handleBackgroundInputLifecycle)
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  useEffect(() => {
    let timeoutId: number | null = null

    function handleDeviceChange() {
      if (!localStreamRef.current) {
        return
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(() => {
        timeoutId = null
        queueAudioInputReconfigure()
      }, 250)
    }

    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange)

    return () => {
      navigator.mediaDevices?.removeEventListener?.(
        'devicechange',
        handleDeviceChange,
      )
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  })

  useEffect(() => {
    function handleStreamingSettingsChanged(event: Event) {
      const settings =
        event instanceof CustomEvent
          ? event.detail as StreamingSettings
          : loadStreamingSettings()

      void applyStreamingSettingsToActiveTracks(settings)
    }

    function handleStreamingSettingsStorageChanged(event: StorageEvent) {
      if (event.key === 'arcanelink.streamingSettings.v1') {
        void applyStreamingSettingsToActiveTracks(loadStreamingSettings())
      }
    }

    window.addEventListener(
      streamingSettingsChangedEventName,
      handleStreamingSettingsChanged,
    )
    window.addEventListener('storage', handleStreamingSettingsStorageChanged)

    return () => {
      window.removeEventListener(
        streamingSettingsChangedEventName,
        handleStreamingSettingsChanged,
      )
      window.removeEventListener('storage', handleStreamingSettingsStorageChanged)
    }
  })

  function getLocalStream() {
    return localStreamRef.current
  }

  function getLocalActivityStream() {
    return rawAudioStreamRef.current
  }

  function getLocalVoiceState() {
    return stateRef.current
  }

  async function ensureLocalStream() {
    if (localStreamRef.current) {
      return localStreamRef.current
    }

    if (ensureAudioPromiseRef.current) {
      return await ensureAudioPromiseRef.current
    }

    const pending = installVoiceInputPipeline(
      voiceSettingsRef.current,
      true,
      audioSessionGenerationRef.current,
    )
    ensureAudioPromiseRef.current = pending

    try {
      return await pending
    } finally {
      if (ensureAudioPromiseRef.current === pending) {
        ensureAudioPromiseRef.current = null
      }
    }
  }

  async function installVoiceInputPipeline(
    requestedSettings: VoiceSettings,
    allowEmptyFallback: boolean,
    sessionGeneration: number,
  ) {
    let captureSettings = requestedSettings
    let didFallBackToDefaultDevice = false
    let rawStream: MediaStream

    try {
      const capture = await captureVoiceInput(requestedSettings)
      rawStream = capture.stream
      captureSettings = capture.settings
      didFallBackToDefaultDevice = capture.didFallBackToDefaultDevice
    } catch (error) {
      if (!isAudioDeviceUnavailableError(error)) {
        throw error
      }

      notifyInputUnavailable(error)
      voiceDebug('local-stream:audio-unavailable', {
        message: error instanceof Error ? error.message : String(error),
      })

      if (!allowEmptyFallback && localStreamRef.current) {
        return localStreamRef.current
      }

      rawStream = new MediaStream()
      updateLocalVoiceState(
        true,
        stateRef.current.isDeafened,
        stateRef.current.isCameraEnabled,
        stateRef.current.isScreenSharing,
      )
    }

    const nextPipeline = await createVoiceInputPipeline(
      rawStream,
      requestedSettings.microphoneGainPercent,
      voiceInputAudioContextRef.current,
      {
        noiseSuppression: resolveVoiceNoiseSuppressionRequest({
          mlNoiseSuppression: requestedSettings.mlNoiseSuppression,
          nativeNoiseSuppression: requestedSettings.noiseSuppression,
          nativeNoiseSuppressionActive:
            isNativeNoiseSuppressionActive(rawStream),
        }),
      },
    )
    if (sessionGeneration !== audioSessionGenerationRef.current) {
      disposeVoiceInputPipeline(
        nextPipeline,
        nextPipeline.audioContext !== voiceInputAudioContextRef.current,
      )
      return localStreamRef.current ?? new MediaStream()
    }

    const previousPipeline = voiceInputPipelineRef.current
    const nextOutboundStream = nextPipeline.outboundStream
    const nextOutboundTrack =
      nextOutboundStream.getAudioTracks()[0] ?? null

    stopLocalVoiceActivityMonitors()
    clearInputTrackRecoveryTimer()
    clearInputTrackStabilityTimer()
    voiceInputPipelineRef.current = nextPipeline
    observeNoiseSuppressionRuntime(nextPipeline)
    voiceInputAudioContextRef.current =
      nextPipeline.audioContext ?? voiceInputAudioContextRef.current
    rawAudioStreamRef.current = rawStream
    localStreamRef.current = nextOutboundStream
    activeCaptureSettingsRef.current = captureSettings

    const rawTrack = rawStream.getAudioTracks()[0] ?? null
    if (rawTrack) {
      rawTrack.onended = () => {
        if (voiceInputPipelineRef.current !== nextPipeline) {
          return
        }

        clearInputTrackRecoveryTimer()
        clearInputTrackStabilityTimer()
        setHasLocalAudioTrack(false)
        updateLocalVoiceState(
          true,
          stateRef.current.isDeafened,
          stateRef.current.isCameraEnabled,
          stateRef.current.isScreenSharing,
        )
        notifyInputUnavailable(
          new DOMException('The selected microphone ended.', 'NotReadableError'),
        )
        queueAudioInputReconfigure()
      }
      rawTrack.onmute = () => {
        if (voiceInputPipelineRef.current !== nextPipeline) {
          return
        }

        inputUnavailableSinceRef.current = Date.now()
        setHasLocalAudioTrack(false)
        clearInputTrackStabilityTimer()
        scheduleInputTrackRecovery(nextPipeline)
      }
      rawTrack.onunmute = () => {
        if (voiceInputPipelineRef.current !== nextPipeline) {
          return
        }

        clearInputTrackRecoveryTimer()
        clearInputTrackStabilityTimer()
        inputUnavailableSinceRef.current = null
        void resumeVoiceAudioContexts()
        scheduleInputTrackStabilityReset(nextPipeline, rawTrack)
      }
      if (rawTrack.muted) {
        scheduleInputTrackRecovery(nextPipeline)
      } else {
        scheduleInputTrackStabilityReset(nextPipeline, rawTrack)
      }
      startLocalVoiceActivityMonitor(
        getLocalParticipantId() ?? currentUserId,
        rawStream,
      )
    } else {
      publishVoiceInputLevel({
        levelDb: -100,
        normalizedLevel: 0,
        thresholdDb: requestedSettings.manualThresholdDb,
        isSpeaking: false,
        isTrackLive: false,
      })
    }

    updateRawAudioTrackState()
    const areAudioContextsReady = await resumeVoiceAudioContexts()
    updateOutboundAudioGate(true)
    setHasLocalAudioTrack(
      Boolean(rawTrack && nextOutboundTrack && areAudioContextsReady),
    )
    await replaceAudioTrackForAllPeers(nextOutboundTrack, nextOutboundStream)
    if (previousPipeline) {
      retainedVoiceInputPipelinesRef.current.add(previousPipeline)
      retainedPipelineRetryCountRef.current.set(previousPipeline, 0)
      scheduleRetainedPipelineCleanup()
    }

    voiceDebug('local-stream:created', {
      transportMode: nextPipeline.transportMode,
      directTransportCanTransmit: nextPipeline.directTransportCanTransmit,
      inputAudioContextState:
        nextPipeline.audioContext?.state ?? 'not-required',
      areAudioContextsReady,
      rawAudioTracks: rawStream.getAudioTracks().map(describeMediaTrack),
      outboundAudioTracks:
        nextOutboundStream.getAudioTracks().map(describeMediaTrack),
      inputDeviceId: captureSettings.inputDeviceId,
      didFallBackToDefaultDevice,
    })

    if (didFallBackToDefaultDevice) {
      updateVoiceSettings({ inputDeviceId: 'default' })
    }

    return nextOutboundStream
  }

  function startLocalVoiceActivityMonitor(
    participantId: string,
    stream: MediaStream,
  ) {
    startVoiceActivityMonitor(participantId, stream, {
      getLevelGain: () =>
        microphoneGainPercentToLinearGain(
          voiceSettingsRef.current.microphoneGainPercent,
        ),
      getThresholdSettings: () => ({
        thresholdMode: voiceSettingsRef.current.thresholdMode,
        manualThresholdDb: voiceSettingsRef.current.manualThresholdDb,
      }),
      onSpeakingChange: (isSpeaking) => {
        isVoiceActiveRef.current = isSpeaking
        updateOutboundAudioGate()
      },
      onSample: handleLocalVoiceActivitySample,
    })
  }

  function handleLocalVoiceActivitySample(sample: VoiceActivitySample) {
    if (
      isVoiceActivityContextReadyRef.current !==
      sample.isAudioContextRunning
    ) {
      isVoiceActivityContextReadyRef.current =
        sample.isAudioContextRunning
      updateOutboundAudioGate(true)
    }

    publishVoiceInputLevel(sample)
    updateInputAvailabilityWarning(sample)

    const settings = voiceSettingsRef.current
    const isOutboundBlocked =
      sample.isSpeaking &&
      !resolveVoiceInputGateOpen({
        isMuted: stateRef.current.isMuted,
        isDeafened: stateRef.current.isDeafened,
        inputMode: settings.inputMode,
        pushToTalkKeyCode: settings.pushToTalkKeyCode,
        isPushToTalkPressed: isPushToTalkPressedRef.current,
        isVoiceActive: isVoiceActiveRef.current,
        isVoiceActivityAvailable: isVoiceActivityGateAvailable(),
      })
    const warningResult = updateSpeakingWhileMutedWarning(
      speakingWarningRef.current,
      {
        nowMs: Date.now(),
        isSpeaking: sample.isSpeaking,
        isOutboundBlocked,
        isEnabled: settings.warnSpeakingWhileMuted,
      },
    )
    speakingWarningRef.current = warningResult.state

    if (warningResult.shouldWarn) {
      notifySpeakingWhileTransmissionIsClosed()
    }
  }

  function updateInputAvailabilityWarning(sample: VoiceActivitySample) {
    if (!sample.isAudioContextRunning) {
      inputUnavailableSinceRef.current = null
      return
    }

    const settings = voiceSettingsRef.current
    const availability = updateVoiceInputAvailability(
      { unavailableSinceMs: inputUnavailableSinceRef.current },
      {
        nowMs: Date.now(),
        shouldObserve:
          (!stateRef.current.isMuted && !stateRef.current.isDeafened) ||
          settings.warnSpeakingWhileMuted,
        isTrackLive: sample.isTrackLive,
        levelDb: sample.rawLevelDb,
      },
    )
    inputUnavailableSinceRef.current =
      availability.state.unavailableSinceMs

    const previousVadAvailability = voiceInputVadAvailabilityRef.current
    const nextVadAvailability = updateVoiceInputVadAvailability(
      previousVadAvailability,
      availability.status,
    )
    voiceInputVadAvailabilityRef.current = nextVadAvailability
    if (
      previousVadAvailability.isAvailable !==
      nextVadAvailability.isAvailable
    ) {
      updateOutboundAudioGate(true)
    }

    if (availability.status === 'available') {
      const pipeline = voiceInputPipelineRef.current
      if (
        pipeline &&
        (pipeline.transportMode === 'direct' ||
          pipeline.audioContext?.state === 'running') &&
        pipeline.outboundStream.getAudioTracks().some(
          (track) => track.readyState === 'live',
        )
      ) {
        setHasLocalAudioTrack(true)
      }
      return
    }
    if (availability.status === 'silent') {
      // Digital silence is valid with hardware/native noise suppression. The
      // track still exists; only the rAF-based VAD becomes non-authoritative.
      setHasLocalAudioTrack(sample.isTrackLive)
      return
    }
    if (availability.status !== 'unavailable') {
      return
    }

    setHasLocalAudioTrack(false)
    notifyInputUnavailable(
      new DOMException(
        'The selected microphone has no meaningful signal.',
        'NotReadableError',
      ),
    )
  }

  function isVoiceActivityGateAvailable() {
    return resolveVoiceInputVadGateAvailable({
      documentVisibility: document.visibilityState,
      isAudioContextReady: isVoiceActivityContextReadyRef.current,
      isSignalAvailable: voiceInputVadAvailabilityRef.current.isAvailable,
    })
  }

  function updateOutboundAudioGate(immediate = false) {
    const settings = voiceSettingsRef.current
    const isVoiceActivityAvailable = isVoiceActivityGateAvailable()
    const isOpen = resolveVoiceInputGateOpen({
      isMuted: stateRef.current.isMuted,
      isDeafened: stateRef.current.isDeafened,
      inputMode: settings.inputMode,
      pushToTalkKeyCode: settings.pushToTalkKeyCode,
      isPushToTalkPressed: isPushToTalkPressedRef.current,
      isVoiceActive: isVoiceActiveRef.current,
      isVoiceActivityAvailable,
    })

    const didGateStateChange = lastOutboundAudioGateStateRef.current !== isOpen
    forEachVoiceInputPipeline((pipeline) => {
      setVoiceInputGate(pipeline, isOpen, immediate)
    })

    if (didGateStateChange) {
      lastOutboundAudioGateStateRef.current = isOpen
      const pipeline = voiceInputPipelineRef.current
      voiceDebug('local-stream:outbound-gate-transition', {
        isOpen,
        immediate,
        inputs: {
          isMuted: stateRef.current.isMuted,
          isDeafened: stateRef.current.isDeafened,
          inputMode: settings.inputMode,
          hasPushToTalkKey: Boolean(settings.pushToTalkKeyCode),
          isPushToTalkPressed: isPushToTalkPressedRef.current,
          isVoiceActive: isVoiceActiveRef.current,
          isVoiceActivityContextReady:
            isVoiceActivityContextReadyRef.current,
          isVoiceActivitySignalAvailable:
            voiceInputVadAvailabilityRef.current.isAvailable,
          isVoiceActivityAvailable,
          documentVisibility: document.visibilityState,
        },
        transportMode: pipeline?.transportMode ?? 'none',
        rawAudioTracks:
          pipeline?.rawStream.getAudioTracks().map(describeAudioGateTrack) ?? [],
        outboundAudioTracks:
          pipeline?.outboundStream
            .getAudioTracks()
            .map(describeAudioGateTrack) ?? [],
      })
    }
  }

  function updateRawAudioTrackState() {
    const settings = voiceSettingsRef.current
    const shouldKeepRawTrackEnabled =
      (!stateRef.current.isMuted && !stateRef.current.isDeafened) ||
      settings.warnSpeakingWhileMuted

    forEachVoiceInputPipeline((pipeline) => {
      pipeline.rawStream.getAudioTracks().forEach((track) => {
        track.enabled = shouldKeepRawTrackEnabled
      })
    })

    if (!shouldKeepRawTrackEnabled) {
      inputUnavailableSinceRef.current = null
    }
  }

  async function prepareVoiceAudioContextsForUserGesture() {
    const inputAudioContext = resolveVoiceAudioContext(
      voiceInputAudioContextRef.current,
      () => new AudioContext(),
    )
    voiceInputAudioContextRef.current = inputAudioContext

    const [, isActivityContextReady] = await Promise.all([
      resumeVoiceAudioContext(inputAudioContext),
      resumeVoiceActivityAudioContext(),
    ])
    if (voiceInputAudioContextRef.current !== inputAudioContext) {
      return
    }

    isVoiceActivityContextReadyRef.current = isActivityContextReady
    if (voiceInputPipelineRef.current) {
      await resumeVoiceAudioContexts()
    }
  }

  async function resumeVoiceAudioContexts() {
    const pipeline = voiceInputPipelineRef.current
    if (!pipeline) {
      setHasLocalAudioTrack(false)
      return false
    }

    const [isInputContextReady, isActivityContextReady] = await Promise.all([
      resumeVoiceInputPipeline(pipeline),
      resumeVoiceActivityAudioContext(),
    ])
    if (pipeline !== voiceInputPipelineRef.current) {
      return false
    }

    const wasActivityContextReady =
      isVoiceActivityContextReadyRef.current
    isVoiceActivityContextReadyRef.current = isActivityContextReady
    const isReady =
      isInputContextReady &&
      pipeline.rawStream.getAudioTracks().some(
        (track) => track.readyState === 'live' && !track.muted,
      ) &&
      pipeline.outboundStream.getAudioTracks().some(
        (track) => track.readyState === 'live',
      )
    setHasLocalAudioTrack(isReady)
    if (wasActivityContextReady !== isActivityContextReady) {
      updateOutboundAudioGate(true)
    }

    if (!isReady) {
      notifyInputUnavailable(
        new DOMException(
          'The browser audio context is not running.',
          'NotReadableError',
        ),
      )
    }

    return isReady
  }

  function forEachVoiceInputPipeline(
    callback: (pipeline: VoiceInputPipeline) => void,
  ) {
    const activePipeline = voiceInputPipelineRef.current
    if (activePipeline) {
      callback(activePipeline)
    }
    retainedVoiceInputPipelinesRef.current.forEach((pipeline) => {
      if (pipeline !== activePipeline) {
        callback(pipeline)
      }
    })
  }

  function resetPushToTalkState() {
    if (!isPushToTalkPressedRef.current) {
      return
    }

    isPushToTalkPressedRef.current = false
    updateOutboundAudioGate()
  }

  function queueAudioInputReconfigure() {
    const requestId = audioReconfigureRequestRef.current + 1
    audioReconfigureRequestRef.current = requestId

    const reconfigure = async () => {
      await ensureAudioPromiseRef.current?.catch(() => undefined)
      if (
        requestId !== audioReconfigureRequestRef.current ||
        !localStreamRef.current
      ) {
        return
      }

      const previousPipeline = voiceInputPipelineRef.current
      try {
        await installVoiceInputPipeline(
          voiceSettingsRef.current,
          false,
          audioSessionGenerationRef.current,
        )
      } finally {
        if (
          previousPipeline &&
          voiceInputPipelineRef.current === previousPipeline &&
          previousPipeline.rawStream.getAudioTracks().some(
            (track) => track.readyState === 'live' && track.muted,
          )
        ) {
          scheduleInputTrackRecovery(previousPipeline)
        }
      }
    }

    audioReconfigureChainRef.current =
      audioReconfigureChainRef.current.then(reconfigure, reconfigure)
    void audioReconfigureChainRef.current.catch((error) => {
      voiceDebug('local-stream:reconfigure-failed', {
        message: error instanceof Error ? error.message : String(error),
      })
    })
  }

  function clearInputTrackRecoveryTimer() {
    if (inputTrackRecoveryTimerRef.current === null) {
      return
    }

    window.clearTimeout(inputTrackRecoveryTimerRef.current)
    inputTrackRecoveryTimerRef.current = null
  }

  function clearInputTrackStabilityTimer() {
    if (inputTrackStabilityTimerRef.current === null) {
      return
    }

    window.clearTimeout(inputTrackStabilityTimerRef.current)
    inputTrackStabilityTimerRef.current = null
  }

  function scheduleInputTrackStabilityReset(
    pipeline: VoiceInputPipeline,
    rawTrack: MediaStreamTrack,
  ) {
    clearInputTrackStabilityTimer()
    if (inputTrackRecoveryAttemptRef.current === 0 || rawTrack.muted) {
      return
    }

    const sessionGeneration = audioSessionGenerationRef.current
    inputTrackStabilityTimerRef.current = window.setTimeout(() => {
      inputTrackStabilityTimerRef.current = null
      if (
        sessionGeneration === audioSessionGenerationRef.current &&
        voiceInputPipelineRef.current === pipeline &&
        rawTrack.readyState === 'live' &&
        !rawTrack.muted
      ) {
        inputTrackRecoveryAttemptRef.current = 0
      }
    }, voiceInputTrackStabilityResetDelayMs)
  }

  function scheduleInputTrackRecovery(pipeline: VoiceInputPipeline) {
    clearInputTrackRecoveryTimer()
    const sessionGeneration = audioSessionGenerationRef.current
    const recoveryAttempt = inputTrackRecoveryAttemptRef.current
    const recoveryDelayMs = resolveVoiceInputTrackRecoveryDelayMs(
      recoveryAttempt,
    )
    if (recoveryDelayMs === null) {
      return
    }

    inputTrackRecoveryTimerRef.current = window.setTimeout(() => {
      inputTrackRecoveryTimerRef.current = null
      if (
        sessionGeneration !== audioSessionGenerationRef.current ||
        voiceInputPipelineRef.current !== pipeline
      ) {
        return
      }

      const rawTrack = pipeline.rawStream.getAudioTracks()[0] ?? null
      if (
        !rawTrack ||
        !shouldRecoverVoiceInputTrack({
          documentVisibility: document.visibilityState,
          isMuted: stateRef.current.isMuted,
          isDeafened: stateRef.current.isDeafened,
          trackMuted: rawTrack.muted,
          trackReadyState: rawTrack.readyState,
        })
      ) {
        return
      }

      voiceDebug('local-stream:recover-muted-input-track', {
        trackId: rawTrack.id,
        readyState: rawTrack.readyState,
        recoveryAttempt: recoveryAttempt + 1,
      })
      inputTrackRecoveryAttemptRef.current = recoveryAttempt + 1
      queueAudioInputReconfigure()
    }, recoveryDelayMs)
  }

  function notifyInputUnavailable(error: unknown) {
    const settings = voiceSettingsRef.current
    if (!settings.warnInputUnavailable) {
      return
    }

    const now = Date.now()
    if (
      lastInputUnavailableWarningAtRef.current !== null &&
      now - lastInputUnavailableWarningAtRef.current < 30_000
    ) {
      return
    }

    lastInputUnavailableWarningAtRef.current = now
    dispatchVoiceSystemNotification(
      `voice-input-unavailable:${Math.floor(now / 30_000)}`,
      settingsCopy.voice.inputUnavailableNotification,
    )
    voiceDebug('local-stream:input-unavailable-notification', {
      message: error instanceof Error ? error.message : String(error),
    })
  }

  function notifySpeakingWhileTransmissionIsClosed() {
    const settings = voiceSettingsRef.current
    const isPushToTalkClosed =
      settings.inputMode === 'push-to-talk' &&
      !isPushToTalkPressedRef.current &&
      !stateRef.current.isMuted &&
      !stateRef.current.isDeafened
    const body = isPushToTalkClosed
      ? settingsCopy.voice.pushToTalkNotHeldNotification.replace(
          '{key}',
          formatPushToTalkKey(settings.pushToTalkKeyCode),
        )
      : settingsCopy.voice.speakingWhileMutedNotification

    dispatchVoiceSystemNotification(
      `voice-speaking-while-blocked:${Math.floor(Date.now() / 30_000)}`,
      body,
    )
  }

  function updateLocalVoiceState(
    nextMuted: boolean,
    nextDeafened: boolean,
    nextCameraEnabled = stateRef.current.isCameraEnabled,
    nextScreenSharing = stateRef.current.isScreenSharing,
  ) {
    const wasTransmissionBlocked =
      stateRef.current.isMuted || stateRef.current.isDeafened
    const nextState = {
      isMuted: nextMuted,
      isDeafened: nextDeafened,
      isCameraEnabled: nextCameraEnabled,
      isScreenSharing: nextScreenSharing,
    }

    stateRef.current = nextState
    setIsMuted(nextMuted)
    setIsDeafened(nextDeafened)
    setIsCameraEnabled(nextCameraEnabled)
    setIsScreenSharing(nextScreenSharing)

    updateRawAudioTrackState()
    if (!nextMuted && !nextDeafened) {
      void resumeVoiceAudioContexts()
      if (wasTransmissionBlocked) {
        const pipeline = voiceInputPipelineRef.current
        if (pipeline) {
          inputTrackRecoveryAttemptRef.current = 0
          scheduleInputTrackRecovery(pipeline)
        }
      }
    } else {
      clearInputTrackRecoveryTimer()
      clearInputTrackStabilityTimer()
    }
    updateOutboundAudioGate()
    voiceDebug('local-state:update', {
      muted: nextMuted,
      deafened: nextDeafened,
      rawTracks:
        rawAudioStreamRef.current?.getAudioTracks().map(describeMediaTrack) ??
        [],
      outboundTracks:
        localStreamRef.current?.getAudioTracks().map(describeMediaTrack) ?? [],
    })

    onVoiceStateChange(nextState)
  }

  function toggleMuted() {
    const nextState = resolveToggledMuteState(stateRef.current)
    updateLocalVoiceState(nextState.isMuted, nextState.isDeafened)
  }

  async function enforceServerMediaCapabilities({
    canSpeak,
    canUseVideo,
    canShareScreen,
  }: {
    canSpeak: boolean
    canUseVideo: boolean
    canShareScreen: boolean
  }) {
    if (!canSpeak && !stateRef.current.isMuted) {
      updateLocalVoiceState(true, stateRef.current.isDeafened)
    }
    if (!canUseVideo && stateRef.current.isCameraEnabled) {
      await disableCamera()
    }
    if (!canShareScreen && stateRef.current.isScreenSharing) {
      await disableScreenShare()
    }
  }

  function toggleDeafened() {
    const nextDeafened = !stateRef.current.isDeafened
    updateLocalVoiceState(
      nextDeafened ? true : stateRef.current.isMuted,
      nextDeafened,
    )
  }

  async function enableCamera() {
    if (stateRef.current.isCameraEnabled && localVideoStreamRef.current) {
      return
    }

    const streamingSettings = loadStreamingSettings()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: createStreamingVideoConstraints(streamingSettings),
    })
    await applyStreamingTrackConstraints(stream.getVideoTracks()[0] ?? null)
    localVideoStreamRef.current = stream
    setLocalCameraPreviewStream(stream)
    await replaceVideoTrackForAllPeers('camera', stream.getVideoTracks()[0] ?? null)
    updateLocalVoiceState(
      stateRef.current.isMuted,
      stateRef.current.isDeafened,
      true,
      stateRef.current.isScreenSharing,
    )
  }

  async function disableCamera() {
    localVideoStreamRef.current?.getTracks().forEach((track) => track.stop())
    localVideoStreamRef.current = null

    setLocalCameraPreviewStream(null)
    await replaceVideoTrackForAllPeers('camera', null)

    updateLocalVoiceState(
      stateRef.current.isMuted,
      stateRef.current.isDeafened,
      false,
      stateRef.current.isScreenSharing,
    )
  }

  async function toggleCamera() {
    if (stateRef.current.isCameraEnabled) {
      await disableCamera()
      return
    }

    await enableCamera()
  }

  async function enableScreenShare() {
    if (stateRef.current.isScreenSharing && screenStreamRef.current) {
      return
    }

    const streamingSettings = loadStreamingSettings()
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: createStreamingVideoConstraints(streamingSettings),
    })
    const [screenTrack] = stream.getVideoTracks()
    await applyStreamingTrackConstraints(screenTrack ?? null)
    if (screenTrack) {
      screenTrack.onended = () => {
        void disableScreenShare()
      }
    }
    screenStreamRef.current = stream
    setLocalScreenPreviewStream(stream)
    await replaceVideoTrackForAllPeers('screen', screenTrack ?? null)
    updateLocalVoiceState(
      stateRef.current.isMuted,
      stateRef.current.isDeafened,
      stateRef.current.isCameraEnabled,
      true,
    )
  }

  async function disableScreenShare() {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenStreamRef.current = null

    setLocalScreenPreviewStream(null)
    await replaceVideoTrackForAllPeers('screen', null)

    updateLocalVoiceState(
      stateRef.current.isMuted,
      stateRef.current.isDeafened,
      stateRef.current.isCameraEnabled,
      false,
    )
  }

  async function toggleScreenShare() {
    if (stateRef.current.isScreenSharing) {
      await disableScreenShare()
      return
    }

    await enableScreenShare()
  }

  async function replaceAudioTrackForAllPeers(
    track: MediaStreamTrack | null,
    stream: MediaStream,
  ) {
    await Promise.all(
      getPeerConnectionIds().map(async (participantId) => {
        try {
          const needsRenegotiation = await replaceAudioTrackForPeer(
            participantId,
            track,
            stream,
          )
          if (needsRenegotiation) {
            await renegotiatePeer(participantId)
          }
        } catch (error) {
          voiceDebug('local-stream:replace-audio-track-failed', {
            participantId,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }),
    )
  }

  async function syncAudioTrackForPeer(
    participantId: string,
    scheduleCleanup = true,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const pipeline = voiceInputPipelineRef.current
      const stream = pipeline?.outboundStream ?? new MediaStream()
      const track = stream.getAudioTracks()[0] ?? null

      try {
        await replaceAudioTrackForPeer(participantId, track, stream)
      } catch (error) {
        voiceDebug('local-stream:sync-audio-track-failed', {
          participantId,
          attempt,
          message: error instanceof Error ? error.message : String(error),
        })
        continue
      }

      if (
        pipeline === voiceInputPipelineRef.current &&
        getPeerAudioSenderTrack(participantId) === track
      ) {
        if (
          scheduleCleanup &&
          retainedVoiceInputPipelinesRef.current.size > 0
        ) {
          scheduleRetainedPipelineCleanup()
        }
        return
      }
    }

    voiceDebug('local-stream:sync-audio-track-stale', { participantId })
  }

  async function replaceAudioTrackForPeer(
    participantId: string,
    track: MediaStreamTrack | null,
    stream: MediaStream,
  ) {
    const peer = getPeerConnection(participantId)
    if (!peer) {
      return false
    }

    const audioTransceiver = peer.getTransceivers().find(
      (transceiver) =>
        transceiver.sender.track?.kind === 'audio' ||
        transceiver.receiver.track.kind === 'audio',
    )
    if (audioTransceiver) {
      await audioTransceiver.sender.replaceTrack(track)

      if (
        track &&
        (audioTransceiver.direction === 'recvonly' ||
          audioTransceiver.direction === 'inactive')
      ) {
        audioTransceiver.direction =
          audioTransceiver.direction === 'recvonly'
            ? 'sendrecv'
            : 'sendonly'
        return true
      }

      return false
    }

    if (!track) {
      return false
    }

    peer.addTrack(track, stream)
    return true
  }

  function getPeerAudioSenderTrack(participantId: string) {
    const peer = getPeerConnection(participantId)
    return (
      peer
        ?.getSenders()
        .find((sender) => sender.track?.kind === 'audio')
        ?.track ?? null
    )
  }

  function scheduleRetainedPipelineCleanup() {
    if (retainedVoiceInputPipelinesRef.current.size === 0) {
      return
    }

    if (retainedPipelineCleanupTimerRef.current !== null) {
      window.clearTimeout(retainedPipelineCleanupTimerRef.current)
    }

    const nextRetryIndex = Math.min(
      ...Array.from(retainedVoiceInputPipelinesRef.current).map((pipeline) =>
        Math.min(
          retainedPipelineRetryCountRef.current.get(pipeline) ?? 0,
          retainedPipelineRetryDelaysMs.length - 1,
        ),
      ),
    )
    retainedPipelineCleanupTimerRef.current = window.setTimeout(() => {
      retainedPipelineCleanupTimerRef.current = null
      void retryAndDisposeRetainedPipelines()
    }, retainedPipelineRetryDelaysMs[nextRetryIndex])
  }

  async function retryAndDisposeRetainedPipelines() {
    const retainedTrackIds = new Set(
      Array.from(retainedVoiceInputPipelinesRef.current).flatMap((pipeline) =>
        pipeline.outboundStream.getAudioTracks().map((track) => track.id),
      ),
    )
    const peersUsingRetainedTracks = getPeerConnectionIds().filter(
      (participantId) => {
        const track = getPeerAudioSenderTrack(participantId)
        return Boolean(track && retainedTrackIds.has(track.id))
      },
    )

    await Promise.all(
      peersUsingRetainedTracks.map((participantId) =>
        syncAudioTrackForPeer(participantId, false),
      ),
    )
    disposeUnusedRetainedPipelines()

    const exhaustedPipelines = Array.from(
      retainedVoiceInputPipelinesRef.current,
    ).filter((pipeline) => {
      const nextRetryCount =
        (retainedPipelineRetryCountRef.current.get(pipeline) ?? 0) + 1
      retainedPipelineRetryCountRef.current.set(pipeline, nextRetryCount)
      return nextRetryCount >= retainedPipelineRetryDelaysMs.length
    })

    for (const pipeline of exhaustedPipelines) {
      const pipelineTrackIds = new Set(
        pipeline.outboundStream.getAudioTracks().map((track) => track.id),
      )
      const peersUsingPipeline = getPeerConnectionIds().filter(
        (participantId) => {
          const track = getPeerAudioSenderTrack(participantId)
          return Boolean(track && pipelineTrackIds.has(track.id))
        },
      )

      await Promise.all(
        peersUsingPipeline.map(async (participantId) => {
          const didRebuild = await rebuildAudioSenderForPeer(participantId)
          if (!didRebuild) {
            try {
              await recoverPeerConnection(participantId)
            } catch (error) {
              voiceDebug('local-stream:audio-peer-recovery-failed', {
                participantId,
                message:
                  error instanceof Error ? error.message : String(error),
              })
            }
          }
        }),
      )
      disposeUnusedRetainedPipelines()

      if (retainedVoiceInputPipelinesRef.current.delete(pipeline)) {
        retainedPipelineRetryCountRef.current.delete(pipeline)
        disposeVoiceInputPipeline(pipeline)
        voiceDebug('local-stream:retained-pipeline-released', {
          peerIds: peersUsingPipeline,
          reason: 'retry-limit',
        })
      }
    }

    if (retainedVoiceInputPipelinesRef.current.size > 0) {
      scheduleRetainedPipelineCleanup()
    }
  }

  async function rebuildAudioSenderForPeer(participantId: string) {
    const peer = getPeerConnection(participantId)
    const pipeline = voiceInputPipelineRef.current
    const stream = pipeline?.outboundStream ?? new MediaStream()
    const track = stream.getAudioTracks()[0] ?? null
    if (!peer || peer.signalingState === 'closed') {
      return false
    }

    try {
      peer
        .getSenders()
        .filter((sender) => sender.track?.kind === 'audio')
        .forEach((sender) => peer.removeTrack(sender))
      if (track) {
        peer.addTrack(track, stream)
      }
      await renegotiatePeer(participantId)
      voiceDebug('local-stream:audio-sender-rebuilt', {
        participantId,
        trackId: track?.id ?? null,
      })
      return getPeerAudioSenderTrack(participantId) === track
    } catch (error) {
      voiceDebug('local-stream:audio-sender-rebuild-failed', {
        participantId,
        message: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  function disposeUnusedRetainedPipelines() {
    const activeSenderTrackIds = new Set(
      getPeerConnectionIds().flatMap((participantId) => {
        const track = getPeerAudioSenderTrack(participantId)
        return track ? [track.id] : []
      }),
    )

    retainedVoiceInputPipelinesRef.current.forEach((pipeline) => {
      const isStillUsed = pipeline.outboundStream
        .getAudioTracks()
        .some((track) => activeSenderTrackIds.has(track.id))
      if (isStillUsed) {
        return
      }

      retainedVoiceInputPipelinesRef.current.delete(pipeline)
      retainedPipelineRetryCountRef.current.delete(pipeline)
      disposeVoiceInputPipeline(pipeline)
    })
  }

  async function replaceVideoTrackForAllPeers(
    kind: VoiceVideoSenderKind,
    track: MediaStreamTrack | null,
  ) {
    const participantIds = getPeerConnectionIds()

    await Promise.all(
      participantIds.map((participantId) =>
        replaceVideoTrackForPeer(participantId, kind, track),
      ),
    )

    await Promise.all(
      participantIds.map((participantId) => renegotiatePeer(participantId)),
    )
  }

  async function replaceVideoTrackForPeer(
    participantId: string,
    kind?: VoiceVideoSenderKind,
    explicitTrack?: MediaStreamTrack | null,
  ) {
    const senderKind = kind ?? 'camera'
    const sender = getVideoSender(participantId, senderKind)
    if (!sender) {
      return
    }

    const track =
      explicitTrack !== undefined
        ? explicitTrack
        : senderKind === 'screen'
          ? screenStreamRef.current?.getVideoTracks()[0] ?? null
          : localVideoStreamRef.current?.getVideoTracks()[0] ??
          null
    await sender.replaceTrack(track)
    await applyStreamingSenderParameters(sender, senderKind, track)
  }

  async function applyStreamingSettingsToActiveTracks(
    settings = loadStreamingSettings(),
  ) {
    const cameraTrack =
      localVideoStreamRef.current?.getVideoTracks()[0] ?? null
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0] ?? null

    await Promise.all([
      applyStreamingTrackConstraints(cameraTrack, settings),
      applyStreamingTrackConstraints(screenTrack, settings),
    ])

    await Promise.all(
      getPeerConnectionIds().flatMap((participantId) => [
        applyStreamingSenderParameters(
          getVideoSender(participantId, 'camera'),
          'camera',
          cameraTrack,
          settings,
        ),
        applyStreamingSenderParameters(
          getVideoSender(participantId, 'screen'),
          'screen',
          screenTrack,
          settings,
        ),
      ]),
    )
  }

  function stopLocalStream() {
    audioSessionGenerationRef.current += 1
    audioReconfigureRequestRef.current += 1
    ensureAudioPromiseRef.current = null
    stopLocalVoiceActivityMonitors()

    const pipeline = voiceInputPipelineRef.current
    voiceInputPipelineRef.current = null
    noiseSuppressionTelemetryUnsubscribeRef.current?.()
    noiseSuppressionTelemetryUnsubscribeRef.current = null
    setNoiseSuppressionTelemetry(null)
    rawAudioStreamRef.current = null
    localStreamRef.current = null
    activeCaptureSettingsRef.current = null
    isVoiceActiveRef.current = false
    isVoiceActivityContextReadyRef.current = true
    voiceInputVadAvailabilityRef.current =
      createVoiceInputVadAvailabilityState()
    lastOutboundAudioGateStateRef.current = null
    isPushToTalkPressedRef.current = false
    speakingWarningRef.current = createSpeakingWhileMutedWarningState()
    inputUnavailableSinceRef.current = null
    clearInputTrackRecoveryTimer()
    clearInputTrackStabilityTimer()
    inputTrackRecoveryAttemptRef.current = 0
    if (retainedPipelineCleanupTimerRef.current !== null) {
      window.clearTimeout(retainedPipelineCleanupTimerRef.current)
      retainedPipelineCleanupTimerRef.current = null
    }
    if (pipeline) {
      disposeVoiceInputPipeline(pipeline)
    }
    retainedVoiceInputPipelinesRef.current.forEach((retainedPipeline) => {
      disposeVoiceInputPipeline(retainedPipeline)
    })
    retainedVoiceInputPipelinesRef.current.clear()
    retainedPipelineRetryCountRef.current.clear()
    void voiceInputAudioContextRef.current?.close()
    voiceInputAudioContextRef.current = null
    localVideoStreamRef.current?.getTracks().forEach((track) => track.stop())
    localVideoStreamRef.current = null
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenStreamRef.current = null
    setLocalCameraPreviewStream(null)
    setLocalScreenPreviewStream(null)
    setHasLocalAudioTrack(false)
    publishVoiceInputLevel({
      levelDb: -100,
      normalizedLevel: 0,
      thresholdDb: voiceSettingsRef.current.manualThresholdDb,
      isSpeaking: false,
      isTrackLive: false,
    })
    clearRemoteStreams()
    clearSpeakingParticipants()
  }

  function stopLocalVoiceActivityMonitors() {
    stopVoiceActivityMonitor(currentUserId)
    const localParticipantId = getLocalParticipantId()
    if (localParticipantId) {
      stopVoiceActivityMonitor(localParticipantId)
    }
  }

  function observeNoiseSuppressionRuntime(pipeline: VoiceInputPipeline) {
    noiseSuppressionTelemetryUnsubscribeRef.current?.()
    noiseSuppressionTelemetryUnsubscribeRef.current = null
    const runtime = pipeline.noiseSuppressionRuntime
    if (!runtime) {
      setNoiseSuppressionTelemetry(null)
      return
    }

    setNoiseSuppressionTelemetry(runtime.getTelemetry())
    noiseSuppressionTelemetryUnsubscribeRef.current =
      runtime.subscribeTelemetry((telemetry) => {
        if (voiceInputPipelineRef.current === pipeline) {
          setNoiseSuppressionTelemetry(telemetry)
        }
      })
  }

  return {
    localCameraPreviewStream,
    localScreenPreviewStream,
    hasLocalAudioTrack,
    isMuted,
    isDeafened,
    isCameraEnabled,
    isScreenSharing,
    noiseSuppressionTelemetry,
    getLocalStream,
    getLocalActivityStream,
    startLocalVoiceActivityMonitor,
    syncAudioTrackForPeer,
    getLocalVoiceState,
    enforceServerMediaCapabilities,
    ensureLocalStream,
    stopLocalStream,
    toggleMuted,
    toggleDeafened,
    enableCamera,
    disableCamera,
    toggleCamera,
    enableScreenShare,
    disableScreenShare,
    toggleScreenShare,
    replaceVideoTrackForPeer,
  }
}

type CapturedVoiceInput = {
  stream: MediaStream
  settings: VoiceSettings
  didFallBackToDefaultDevice: boolean
}

async function captureVoiceInput(
  settings: VoiceSettings,
): Promise<CapturedVoiceInput> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException(
      'Audio capture is unavailable in this browser.',
      'NotSupportedError',
    )
  }

  try {
    return {
      stream: await navigator.mediaDevices.getUserMedia({
        audio: createVoiceAudioConstraints(settings),
        video: false,
      }),
      settings,
      didFallBackToDefaultDevice: false,
    }
  } catch (error) {
    if (
      settings.inputDeviceId === 'default' ||
      !isSelectedAudioDeviceUnavailableError(error)
    ) {
      throw error
    }

    const fallbackSettings: VoiceSettings = {
      ...settings,
      inputDeviceId: 'default',
    }
    return {
      stream: await navigator.mediaDevices.getUserMedia({
        audio: createVoiceAudioConstraints(fallbackSettings),
        video: false,
      }),
      settings: fallbackSettings,
      didFallBackToDefaultDevice: true,
    }
  }
}

function hasCaptureSettingsChanged(
  activeSettings: VoiceSettings | null,
  nextSettings: VoiceSettings,
) {
  return (
    !activeSettings ||
    activeSettings.inputDeviceId !== nextSettings.inputDeviceId ||
    activeSettings.echoCancellation !== nextSettings.echoCancellation ||
    activeSettings.noiseSuppression !== nextSettings.noiseSuppression ||
    activeSettings.mlNoiseSuppression !== nextSettings.mlNoiseSuppression ||
    activeSettings.autoGainControl !== nextSettings.autoGainControl
  )
}

function isNativeNoiseSuppressionActive(stream: MediaStream) {
  const track = stream.getAudioTracks()[0]
  if (!track) {
    return false
  }

  const settings = track.getSettings() as MediaTrackSettings & {
    noiseSuppression?: boolean
  }
  return settings.noiseSuppression === true
}

function describeMediaTrack(track: MediaStreamTrack) {
  return {
    id: track.id,
    label: track.label,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
  }
}

function describeAudioGateTrack(track: MediaStreamTrack) {
  return {
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
  }
}

function dispatchVoiceSystemNotification(id: string, body: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('arcanelink:system-notification', {
      detail: {
        id,
        title: settingsCopy.voice.notificationTitle,
        body,
      },
    }),
  )
}

function formatPushToTalkKey(keyCode: string | null) {
  if (!keyCode) {
    return settingsCopy.voice.pushToTalkKeyMissing
  }

  if (keyCode.startsWith('Key')) {
    return keyCode.slice(3)
  }
  if (keyCode.startsWith('Digit')) {
    return keyCode.slice(5)
  }

  return keyCode
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

async function applyStreamingTrackConstraints(
  track: MediaStreamTrack | null,
  settings = loadStreamingSettings(),
) {
  if (!track || track.readyState !== 'live') {
    return
  }

  try {
    await track.applyConstraints(createStreamingVideoConstraints(settings))
  } catch (error) {
    voiceDebug('streaming:constraints-skipped', {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

async function applyStreamingSenderParameters(
  sender: RTCRtpSender | null,
  kind: VoiceVideoSenderKind,
  track: MediaStreamTrack | null,
  settings = loadStreamingSettings(),
) {
  if (!sender || !track || track.readyState !== 'live') {
    return
  }

  const maxBitrate = await getStreamingMaxBitrate(settings)
  if (!maxBitrate) {
    return
  }

  try {
    const parameters = sender.getParameters()
    const [firstEncoding, ...restEncodings] = parameters.encodings ?? [{}]
    parameters.encodings = [
      {
        ...firstEncoding,
        maxBitrate,
        maxFramerate: settings.frameRate,
      },
      ...restEncodings,
    ]
    await sender.setParameters(parameters)
  } catch (error) {
    voiceDebug('streaming:sender-parameters-skipped', {
      kind,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function isAudioDeviceUnavailableError(error: unknown) {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return true
  }

  if (!(error instanceof DOMException)) {
    return false
  }

  return [
    'NotAllowedError',
    'NotFoundError',
    'NotReadableError',
    'NotSupportedError',
    'SecurityError',
    'OverconstrainedError',
  ].includes(error.name)
}

function isSelectedAudioDeviceUnavailableError(error: unknown) {
  return (
    error instanceof DOMException &&
    ['NotFoundError', 'OverconstrainedError'].includes(error.name)
  )
}
