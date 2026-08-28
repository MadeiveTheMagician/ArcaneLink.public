import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { VoiceChannelController } from '../../../Server/hooks/voice/useVoiceChannel'
import type {
  VoicePlaybackState,
  VoiceUserAudioSettings,
} from '../../../shared/types/voicePlayback'
import { voiceCopy } from '../../../shared/copy/voice.ru'
import {
  applyAudioOutputDevice,
  combineVoicePlaybackVolume,
  isDefaultAudioOutputDeviceId,
  subscribeAudioOutputDeviceChanges,
} from '../../../shared/voice/audioOutput'
import {
  clampVoiceParticipantVolume,
  createVoicePlaybackAudioEngine,
} from '../../../shared/voice/voiceSpatialAudio'
import type {
  VoiceSpatialAudioEngine,
  VoiceSpatialAudioPath,
} from '../../../shared/voice/voiceSpatialAudio'
import {
  indexVoiceUserIdsByParticipantId,
  resolveVoicePlaybackUserId,
} from '../../../shared/voice/voicePlaybackParticipantModel'
import {
  getVoiceSettings,
  resolveEffectiveVoiceSpatialAudioMode,
  subscribeVoiceSettings,
} from '../../../shared/voice/voiceSettings'
import {
  requestVoicePlaybackUnlock,
  subscribeVoicePlaybackUnlock,
} from '../../../shared/voice/voicePlaybackUnlock'
import { requiresVoiceParticipantGain } from '../../../shared/voice/voiceParticipantVolume'
import {
  canStartVoiceAudioPlayback,
  resolveVoiceAudioTrackPlaybackState,
} from '../../../shared/voice/voiceAudioPlaybackModel'

type HubVoiceAudioSinksProps = {
  audioSettingsByUserId: Record<string, VoiceUserAudioSettings>
  onPlaybackStateChange: (
    participantId: string,
    state: VoicePlaybackState,
  ) => void
  voice: VoiceChannelController
}

const hiddenAudioContainerStyle = {
  position: 'fixed',
  width: 1,
  height: 1,
  overflow: 'hidden',
  opacity: 0,
  pointerEvents: 'none',
} as const

const unlockButtonStyle = {
  position: 'fixed',
  right: 20,
  bottom: 20,
  zIndex: 1000,
} as const

export function HubVoiceAudioSinks({
  audioSettingsByUserId,
  onPlaybackStateChange,
  voice,
}: HubVoiceAudioSinksProps) {
  const [unlockToken, setUnlockToken] = useState(0)
  const [blockedParticipantIds, setBlockedParticipantIds] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const [voiceSettings, setVoiceSettings] = useState(getVoiceSettings)
  const [availableOutputDevices, setAvailableOutputDevices] = useState<
    MediaDeviceInfo[] | null
  >(null)
  const [spatialAudioEngine, setSpatialAudioEngine] =
    useState<VoiceSpatialAudioEngine | null>(null)
  const activeParticipants = useMemo(() => {
    const activeSpaceId = voice.connectedChannel?.spaceId
    return activeSpaceId
      ? voice.participantsBySpaceId[activeSpaceId] ?? []
      : []
  }, [voice.connectedChannel?.spaceId, voice.participantsBySpaceId])
  const userIdByParticipantId = useMemo(
    () => indexVoiceUserIdsByParticipantId(activeParticipants),
    [activeParticipants],
  )
  const participantByParticipantId = useMemo(
    () => new Map(activeParticipants.map((participant) => [
      normalizeParticipantId(participant.participantId),
      participant,
    ] as const)),
    [activeParticipants],
  )
  const localParticipant = voice.localParticipantId
    ? participantByParticipantId.get(
        normalizeParticipantId(voice.localParticipantId),
      )
    : null
  const isPlaybackDeafened =
    voice.isDeafened || localParticipant?.isServerDeafened === true
  const participantGainRequired = useMemo(
    () => Object.keys(voice.remoteStreamsByParticipantId).some(
      (participantId) => {
        const userId = resolveVoicePlaybackUserId(
          participantId,
          userIdByParticipantId,
        )
        return requiresVoiceParticipantGain(
          userId
            ? audioSettingsByUserId[userId]?.volume ?? 1
            : 1,
        )
      },
    ),
    [
      audioSettingsByUserId,
      userIdByParticipantId,
      voice.remoteStreamsByParticipantId,
    ],
  )

  useEffect(
    () => subscribeVoiceSettings(setVoiceSettings),
    [],
  )

  useEffect(
    () => subscribeAudioOutputDeviceChanges(setAvailableOutputDevices),
    [],
  )

  useEffect(
    () => subscribeVoicePlaybackUnlock(() => {
      setUnlockToken((current) => current + 1)
      void spatialAudioEngine?.resume()
    }),
    [spatialAudioEngine],
  )

  useEffect(() => {
    function retryForegroundPlayback() {
      if (document.visibilityState !== 'visible') {
        return
      }

      setUnlockToken((current) => current + 1)
      void spatialAudioEngine?.resume()
    }

    window.addEventListener('pageshow', retryForegroundPlayback)
    document.addEventListener('visibilitychange', retryForegroundPlayback)
    return () => {
      window.removeEventListener('pageshow', retryForegroundPlayback)
      document.removeEventListener('visibilitychange', retryForegroundPlayback)
    }
  }, [spatialAudioEngine])

  useEffect(() => {
    const engine = createVoicePlaybackAudioEngine(
      resolveEffectiveVoiceSpatialAudioMode(
        voiceSettings.spatialAudioMode,
      ),
      participantGainRequired,
    )
    setSpatialAudioEngine(engine)

    return () => {
      engine?.dispose()
    }
  }, [participantGainRequired, voiceSettings.spatialAudioMode])

  const updatePlaybackState = useCallback(
    (participantId: string, state: VoicePlaybackState) => {
      onPlaybackStateChange(participantId, state)
      setBlockedParticipantIds((current) => {
        const normalizedParticipantId = normalizeParticipantId(participantId)
        const isBlocked = current.has(normalizedParticipantId)

        if (state === 'blocked' && !isBlocked) {
          const next = new Set(current)
          next.add(normalizedParticipantId)
          return next
        }

        if (state !== 'blocked' && isBlocked) {
          const next = new Set(current)
          next.delete(normalizedParticipantId)
          return next
        }

        return current
      })
    },
    [onPlaybackStateChange],
  )

  return (
    <>
      <div aria-hidden="true" style={hiddenAudioContainerStyle}>
        {Object.entries(voice.remoteStreamsByParticipantId).map(
          ([participantId, stream]) => (
            <VoiceAudioSink
              key={participantId}
              participantId={participantId}
              spatialIdentity={
                resolveVoicePlaybackUserId(
                  participantId,
                  userIdByParticipantId,
                ) ?? participantId
              }
              settings={
                audioSettingsByUserId[
                  resolveVoicePlaybackUserId(
                    participantId,
                    userIdByParticipantId,
                  ) ?? ''
                ] ?? defaultVoiceUserAudioSettings
              }
              stream={stream}
              unlockToken={unlockToken}
              isDeafened={isPlaybackDeafened}
              isServerMuted={
                participantByParticipantId.get(
                  normalizeParticipantId(participantId),
                )?.isServerMuted === true ||
                participantByParticipantId.get(
                  normalizeParticipantId(participantId),
                )?.canSpeak === false
              }
              outputDeviceId={voiceSettings.outputDeviceId}
              outputVolumePercent={voiceSettings.outputVolumePercent}
              spatialAudioEngine={spatialAudioEngine}
              availableOutputDevices={availableOutputDevices}
              onPlaybackStateChange={updatePlaybackState}
            />
          ),
        )}
      </div>
      {blockedParticipantIds.size > 0 && (
        <button
          type="button"
          onClick={() => requestVoicePlaybackUnlock()}
          style={unlockButtonStyle}
        >
          {voiceCopy.controls.playbackUnlock}
        </button>
      )}
    </>
  )
}

function VoiceAudioSink({
  participantId,
  spatialIdentity,
  settings,
  stream,
  unlockToken,
  isDeafened,
  isServerMuted,
  outputDeviceId,
  outputVolumePercent,
  spatialAudioEngine,
  availableOutputDevices,
  onPlaybackStateChange,
}: {
  participantId: string
  spatialIdentity: string
  settings: VoiceUserAudioSettings
  stream: MediaStream
  unlockToken: number
  isDeafened: boolean
  isServerMuted: boolean
  outputDeviceId: string
  outputVolumePercent: number
  spatialAudioEngine: VoiceSpatialAudioEngine | null
  availableOutputDevices: readonly MediaDeviceInfo[] | null
  onPlaybackStateChange: (
    participantId: string,
    state: VoicePlaybackState,
  ) => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const outputDeviceApplicationRef = useRef<Promise<void>>(Promise.resolve())
  const outputDeviceGenerationRef = useRef(0)
  const isOutputRoutingReadyRef = useRef(false)
  const playbackGenerationRef = useRef(0)
  const isPlaybackMutedRef = useRef<boolean | null>(null)
  const spatialAudioPathRef = useRef<VoiceSpatialAudioPath | null>(null)
  const applyPlaybackMixRef = useRef<() => boolean>(() => false)

  const applyPlaybackMix = useCallback(() => {
    const audio = audioRef.current
    if (!audio) {
      return false
    }

    const participantVolume = clampVoiceParticipantVolume(settings.volume)
    const spatialAudioPath = spatialAudioPathRef.current
    spatialAudioPath?.setParticipantVolume(participantVolume)

    const outputVolume = combineVoicePlaybackVolume(outputVolumePercent, 1)
    spatialAudioPath?.setOutputVolume(outputVolume)
    const playbackVolume = spatialAudioPath
      ? 1
      : combineVoicePlaybackVolume(outputVolumePercent, participantVolume)
    const isPlaybackMuted =
      settings.isMuted ||
      isDeafened ||
      isServerMuted ||
      outputVolume === 0 ||
      participantVolume === 0

    isPlaybackMutedRef.current = isPlaybackMuted
    audio.volume = playbackVolume
    audio.muted = isPlaybackMuted
    return isPlaybackMuted
  }, [
    isDeafened,
    isServerMuted,
    outputVolumePercent,
    settings.isMuted,
    settings.volume,
  ])
  useEffect(() => {
    applyPlaybackMixRef.current = applyPlaybackMix
  }, [applyPlaybackMix])

  const playAudio = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const playbackGeneration = ++playbackGenerationRef.current
    if (isPlaybackMutedRef.current) {
      onPlaybackStateChange(participantId, 'silent')
      return
    }
    if (spatialAudioEngine && !(await spatialAudioEngine.resume())) {
      onPlaybackStateChange(participantId, 'blocked')
      return
    }

    const playbackStream = audio.srcObject
    const sourceTrackState = resolveVoiceAudioTrackPlaybackState(
      stream.getAudioTracks(),
    )
    if (
      !(playbackStream instanceof MediaStream) ||
      !canStartVoiceAudioPlayback(sourceTrackState)
    ) {
      onPlaybackStateChange(participantId, 'silent')
      return
    }

    await outputDeviceApplicationRef.current.catch(() => undefined)
    if (
      playbackGeneration !== playbackGenerationRef.current ||
      audioRef.current !== audio ||
      isPlaybackMutedRef.current ||
      !isOutputRoutingReadyRef.current
    ) {
      return
    }

    try {
      await audio.play()
      if (
        playbackGeneration !== playbackGenerationRef.current ||
        audioRef.current !== audio
      ) {
        return
      }

      const settledTrackState = resolveVoiceAudioTrackPlaybackState(
        stream.getAudioTracks(),
      )
      onPlaybackStateChange(
        participantId,
        settledTrackState === 'available' ? 'playing' : 'silent',
      )
      const spatialTelemetry = spatialAudioPathRef.current?.getTelemetry()
      voiceAudioDebug('play-ok', {
        participantId,
        paused: audio.paused,
        muted: audio.muted,
        volume: audio.volume,
        spatialMode: spatialTelemetry?.activeMode ?? 'off',
        spatialPosition: spatialTelemetry?.position ?? null,
        spatialContextState: spatialTelemetry?.contextState ?? 'not-required',
        sourceTrackState: settledTrackState,
      })
    } catch {
      if (
        playbackGeneration !== playbackGenerationRef.current ||
        audioRef.current !== audio
      ) {
        return
      }

      onPlaybackStateChange(participantId, 'blocked')
      voiceAudioDebug('play-blocked', { participantId })
    }
  }, [
    onPlaybackStateChange,
    participantId,
    spatialAudioEngine,
    stream,
  ])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const wasPlaybackMuted = isPlaybackMutedRef.current
    const isPlaybackMuted = applyPlaybackMix()

    if (isPlaybackMuted) {
      if (wasPlaybackMuted !== true) {
        playbackGenerationRef.current += 1
        onPlaybackStateChange(participantId, 'silent')
      }
      return
    }

    if (wasPlaybackMuted === true) {
      void playAudio()
    }
  }, [
    isDeafened,
    isServerMuted,
    applyPlaybackMix,
    onPlaybackStateChange,
    participantId,
    playAudio,
  ])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const outputDeviceGeneration = ++outputDeviceGenerationRef.current
    isOutputRoutingReadyRef.current = false

    if (
      availableOutputDevices === null &&
      !isDefaultAudioOutputDeviceId(outputDeviceId)
    ) {
      return () => {
        if (outputDeviceGenerationRef.current === outputDeviceGeneration) {
          outputDeviceGenerationRef.current += 1
        }
      }
    }

    const outputRequest = outputDeviceApplicationRef.current
      .catch(() => undefined)
      .then(async () => {
        if (
          outputDeviceGeneration !== outputDeviceGenerationRef.current ||
          audioRef.current !== audio
        ) {
          return
        }

        const outputSelection = await applyAudioOutputDevice(
          audio,
          outputDeviceId,
          availableOutputDevices ?? [],
        )
        if (
          outputDeviceGeneration !== outputDeviceGenerationRef.current ||
          audioRef.current !== audio
        ) {
          return
        }

        voiceAudioDebug('output-device', {
          participantId,
          requestedDeviceId: outputDeviceId,
          activeDeviceId: outputSelection.deviceId || 'default',
          didFallback: outputSelection.didFallback,
        })
        isOutputRoutingReadyRef.current = true
      })
    outputDeviceApplicationRef.current = outputRequest.then(
      () => undefined,
      () => undefined,
    )
    void outputDeviceApplicationRef.current.then(() => {
      if (
        outputDeviceGeneration === outputDeviceGenerationRef.current &&
        isOutputRoutingReadyRef.current
      ) {
        void playAudio()
      }
    })

    return () => {
      if (outputDeviceGenerationRef.current === outputDeviceGeneration) {
        outputDeviceGenerationRef.current += 1
      }
    }
  }, [
    availableOutputDevices,
    outputDeviceId,
    participantId,
    playAudio,
  ])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    let spatialAudioPath: VoiceSpatialAudioPath | null = null
    let playbackStream = stream
    if (spatialAudioEngine) {
      try {
        spatialAudioPath = spatialAudioEngine.attachParticipant(
          spatialIdentity,
          stream,
          1,
        )
        spatialAudioPathRef.current = spatialAudioPath
        playbackStream = spatialAudioPath.outputStream
        const telemetry = spatialAudioPath.getTelemetry()
        voiceAudioDebug('spatial-audio-attached', {
          participantId,
          requestedMode: telemetry.requestedMode,
          activeMode: telemetry.activeMode,
          status: telemetry.status,
          fallbackReason: telemetry.fallbackReason,
          position: telemetry.position,
          contextState: telemetry.contextState,
        })
      } catch (error) {
        voiceAudioDebug('spatial-audio-fallback', {
          participantId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    audio.srcObject = playbackStream
    applyPlaybackMixRef.current()

    function updateTrackState() {
      const tracks = stream.getAudioTracks()
      const trackPlaybackState = resolveVoiceAudioTrackPlaybackState(tracks)
      voiceAudioDebug('track-state', {
        participantId,
        playbackState: trackPlaybackState,
        tracks: tracks.map((track) => ({
          id: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      })

      if (!canStartVoiceAudioPlayback(trackPlaybackState)) {
        playbackGenerationRef.current += 1
        onPlaybackStateChange(participantId, 'silent')
        return
      }

      if (trackPlaybackState === 'pending') {
        onPlaybackStateChange(participantId, 'silent')
      }
      void playAudio()
    }

    function retryPlayback(event: Event) {
      voiceAudioDebug('media-ready', {
        participantId,
        event: event.type,
        readyState: (event.currentTarget as HTMLAudioElement).readyState,
      })
      void playAudio()
    }

    const tracks = stream.getAudioTracks()
    tracks.forEach((track) => {
      track.addEventListener('mute', updateTrackState)
      track.addEventListener('unmute', updateTrackState)
      track.addEventListener('ended', updateTrackState)
    })
    audio.addEventListener('loadedmetadata', retryPlayback)
    audio.addEventListener('canplay', retryPlayback)
    updateTrackState()

    return () => {
      playbackGenerationRef.current += 1
      tracks.forEach((track) => {
        track.removeEventListener('mute', updateTrackState)
        track.removeEventListener('unmute', updateTrackState)
        track.removeEventListener('ended', updateTrackState)
      })
      audio.removeEventListener('loadedmetadata', retryPlayback)
      audio.removeEventListener('canplay', retryPlayback)
      if (audio.srcObject === playbackStream) {
        audio.pause()
        audio.srcObject = null
      }
      if (spatialAudioPathRef.current === spatialAudioPath) {
        spatialAudioPathRef.current = null
      }
      spatialAudioPath?.dispose()
      onPlaybackStateChange(participantId, 'idle')
    }
  }, [
    onPlaybackStateChange,
    participantId,
    playAudio,
    spatialAudioEngine,
    spatialIdentity,
    stream,
  ])

  useEffect(() => {
    if (unlockToken > 0) {
      void playAudio()
    }
  }, [
    playAudio,
    unlockToken,
  ])

  return <audio ref={audioRef} playsInline preload="auto" />
}

function normalizeParticipantId(participantId: string) {
  return participantId.trim().toLowerCase()
}

const defaultVoiceUserAudioSettings: VoiceUserAudioSettings = {
  volume: 1,
  isMuted: false,
  isVideoHidden: false,
}

function voiceAudioDebug(event: string, details?: unknown) {
  try {
    if (localStorage.getItem('arcanelink.voiceDebug') !== '1') {
      return
    }
  } catch {
    return
  }

  console.info(`[voice-audio] ${event}`, details ?? '')
}
