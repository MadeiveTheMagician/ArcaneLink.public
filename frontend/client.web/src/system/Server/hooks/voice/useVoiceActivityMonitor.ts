import { useEffect, useRef, useState } from 'react'
import {
  applyVoiceGainToLevelDb,
  calculateVoiceRms,
  createAutomaticVoiceThresholdState,
  createVoiceActivityState,
  normalizeVoiceLevel,
  resolveVoiceThresholdDb,
  rmsToDecibels,
  updateAutomaticVoiceThreshold,
  updateVoiceActivityState,
} from './voiceActivityModel'
import type {
  AutomaticVoiceThresholdState,
  VoiceActivityState,
  VoiceThresholdMode,
} from './voiceActivityModel'
import { normalizeUserId } from './voiceChannelUtils'
import {
  resolveVoiceAudioContext,
  resumeVoiceAudioContext,
} from './voiceAudioContextRecovery'

export type VoiceActivitySample = {
  rawLevelDb: number
  levelDb: number
  normalizedLevel: number
  thresholdDb: number
  isSpeaking: boolean
  isTrackLive: boolean
  isAudioContextRunning: boolean
}

export type VoiceActivityMonitorOptions = {
  getThresholdSettings?: () => {
    thresholdMode: VoiceThresholdMode
    manualThresholdDb: number
  }
  onSample?: (sample: VoiceActivitySample) => void
  onSpeakingChange?: (isSpeaking: boolean) => void
  getLevelGain?: () => number
}

type VoiceActivityMonitorRuntime = {
  analyser: AnalyserNode
  source: MediaStreamAudioSourceNode
  data: Uint8Array<ArrayBuffer>
  frameId: number
  automaticThreshold: AutomaticVoiceThresholdState
  activity: VoiceActivityState
  lastPublishedAt: number
  lastLevelGain: number
  options: VoiceActivityMonitorOptions
}

const inputLevelPublishIntervalMs = 50

export function useVoiceActivityMonitor() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const voiceActivityMonitorsRef = useRef<
    Record<string, VoiceActivityMonitorRuntime>
  >({})
  const [speakingParticipantIds, setSpeakingParticipantIds] = useState<Record<string, boolean>>(
    {},
  )

  useEffect(() => {
    return () => {
      Object.values(voiceActivityMonitorsRef.current).forEach((monitor) => {
        window.cancelAnimationFrame(monitor.frameId)
        monitor.source.disconnect()
        monitor.analyser.disconnect()
      })
      voiceActivityMonitorsRef.current = {}
      void audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [])

  function getAudioContext() {
    audioContextRef.current = resolveVoiceAudioContext(
      audioContextRef.current,
      () => new AudioContext(),
    )

    return audioContextRef.current
  }

  async function resumeVoiceActivityAudioContext() {
    return resumeVoiceAudioContext(getAudioContext())
  }

  function setSpeakingState(participantId: string, isSpeaking: boolean) {
    setSpeakingParticipantIds((current) => {
      if (Boolean(current[participantId]) === isSpeaking) {
        return current
      }

      return {
        ...current,
        [participantId]: isSpeaking,
      }
    })
  }

  function startVoiceActivityMonitor(
    userId: string,
    stream: MediaStream,
    options: VoiceActivityMonitorOptions = {},
  ) {
    const normalizedUserId = normalizeUserId(userId)
    const audioTracks = stream.getAudioTracks()

    if (audioTracks.length === 0) {
      setSpeakingState(normalizedUserId, false)
      return
    }

    stopVoiceActivityMonitor(normalizedUserId)

    const audioContext = getAudioContext()
    void resumeVoiceActivityAudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.45
    source.connect(analyser)

    const monitor: VoiceActivityMonitorRuntime = {
      analyser,
      source,
      data: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
      frameId: 0,
      automaticThreshold: createAutomaticVoiceThresholdState(),
      activity: createVoiceActivityState(),
      lastPublishedAt: 0,
      lastLevelGain: options.getLevelGain?.() ?? 1,
      options,
    }

    voiceActivityMonitorsRef.current[normalizedUserId] = monitor

    const tick = (now: number) => {
      analyser.getByteTimeDomainData(monitor.data)

      const levelGain = monitor.options.getLevelGain?.() ?? 1
      if (levelGain !== monitor.lastLevelGain) {
        monitor.lastLevelGain = levelGain
        monitor.automaticThreshold = createAutomaticVoiceThresholdState()
        if (monitor.activity.isSpeaking) {
          monitor.options.onSpeakingChange?.(false)
          setSpeakingState(normalizedUserId, false)
        }
        monitor.activity = createVoiceActivityState()
      }
      const rawLevelDb = rmsToDecibels(calculateVoiceRms(monitor.data))
      const levelDb = applyVoiceGainToLevelDb(rawLevelDb, levelGain)
      const isAudioContextRunning = audioContext.state === 'running'
      const isTrackLive = audioTracks.some(
        (track) => track.enabled && !track.muted && track.readyState === 'live',
      ) && isAudioContextRunning
      monitor.automaticThreshold = updateAutomaticVoiceThreshold(
        monitor.automaticThreshold,
        levelDb,
      )
      const thresholdSettings = monitor.options.getThresholdSettings?.() ?? {
        thresholdMode: 'manual',
        manualThresholdDb: -42,
      }
      const thresholdDb = resolveVoiceThresholdDb(
        thresholdSettings.thresholdMode,
        thresholdSettings.manualThresholdDb,
        monitor.automaticThreshold,
      )
      const previousSpeaking = monitor.activity.isSpeaking
      monitor.activity = updateVoiceActivityState(
        monitor.activity,
        isTrackLive && levelDb >= thresholdDb,
      )
      const isSpeaking = monitor.activity.isSpeaking

      if (previousSpeaking !== isSpeaking) {
        setSpeakingState(normalizedUserId, isSpeaking)
        monitor.options.onSpeakingChange?.(isSpeaking)
      }

      if (now - monitor.lastPublishedAt >= inputLevelPublishIntervalMs) {
        monitor.lastPublishedAt = now
        monitor.options.onSample?.({
          rawLevelDb,
          levelDb,
          normalizedLevel: normalizeVoiceLevel(levelDb),
          thresholdDb,
          isSpeaking,
          isTrackLive,
          isAudioContextRunning,
        })
      }

      monitor.frameId = window.requestAnimationFrame(tick)
    }

    monitor.frameId = window.requestAnimationFrame(tick)
  }

  function stopVoiceActivityMonitor(userId: string) {
    const normalizedUserId = normalizeUserId(userId)
    const monitor = voiceActivityMonitorsRef.current[normalizedUserId]

    if (!monitor) {
      return
    }

    window.cancelAnimationFrame(monitor.frameId)
    monitor.source.disconnect()
    monitor.analyser.disconnect()
    monitor.options.onSpeakingChange?.(false)
    delete voiceActivityMonitorsRef.current[normalizedUserId]
    setSpeakingState(normalizedUserId, false)
  }

  function clearSpeakingParticipants() {
    setSpeakingParticipantIds({})
  }

  return {
    speakingParticipantIds,
    resumeVoiceActivityAudioContext,
    startVoiceActivityMonitor,
    stopVoiceActivityMonitor,
    clearSpeakingParticipants,
  }
}
