import {
  isVoiceDebugEnabled,
  logPeerConnectionStats,
  voiceDebug,
} from './voiceChannelDebug'
import { voiceCopy } from '../../../shared/index'
import { resolveVoicePeerRecoveryDelayMs } from './voicePeerRecoveryModel'


type VoicePeerConnectionHandlersOptions = {
  peer: RTCPeerConnection
  remoteParticipantId: string
  getRemoteStream: (participantId: string) => MediaStream | null
  setRemoteStream: (participantId: string, stream: MediaStream) => void
  startVoiceActivityMonitor: (participantId: string, stream: MediaStream) => void
  rememberCandidateType: (participantId: string, candidateType: string | null) => void
  sendVoiceSignal: (
    targetParticipantId: string,
    kind: 'ice',
    payload: RTCIceCandidateInit,
  ) => Promise<boolean>
  updatePeerStatus: (participantId: string) => void
  reportIceFailure: (participantId: string) => void
  restartPeerIce: (
    participantId: string,
    peer: RTCPeerConnection,
  ) => Promise<void>
  closePeer: (participantId: string) => void
  setVoiceError: (message: string | null) => void
}

export function attachVoicePeerConnectionHandlers({
  peer,
  remoteParticipantId,
  getRemoteStream,
  setRemoteStream,
  startVoiceActivityMonitor,
  rememberCandidateType,
  sendVoiceSignal,
  updatePeerStatus,
  reportIceFailure,
  restartPeerIce,
  closePeer,
  setVoiceError,
}: VoicePeerConnectionHandlersOptions) {
  let pendingIceCandidateErrorTimeout: ReturnType<typeof window.setTimeout> | null =
    null
  let pendingPeerRecoveryTimeout: ReturnType<typeof window.setTimeout> | null =
    null
  let isPeerRecoveryInFlight = false
  let hasAttemptedPeerRecovery = false
  let statsSnapshotGeneration = 0
  const statsSnapshotTimeoutIds = new Set<number>()

  function cancelStatsSnapshots() {
    statsSnapshotGeneration += 1
    statsSnapshotTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
    statsSnapshotTimeoutIds.clear()
  }

  function captureStatsSnapshot(sample: string) {
    void logPeerConnectionStats(remoteParticipantId, peer, sample).catch(
      (error) => {
        voiceDebug('peer:stats-failed', {
          sample,
          message: error instanceof Error ? error.message : String(error),
        })
      },
    )
  }

  function scheduleConnectedStatsSnapshots() {
    cancelStatsSnapshots()
    if (!isVoiceDebugEnabled) {
      return
    }

    const generation = statsSnapshotGeneration
    ;[0, 2_000, 5_000, 10_000].forEach((delayMs) => {
      const timeoutId = window.setTimeout(() => {
        statsSnapshotTimeoutIds.delete(timeoutId)
        if (
          generation !== statsSnapshotGeneration ||
          peer.connectionState !== 'connected' ||
          peer.signalingState === 'closed'
        ) {
          return
        }

        captureStatsSnapshot(
          delayMs === 0 ? 'connected' : `connected+${delayMs}ms`,
        )
      }, delayMs)
      statsSnapshotTimeoutIds.add(timeoutId)
    })
  }

  function isPeerConnected() {
    return (
      peer.connectionState === 'connected' ||
      peer.iceConnectionState === 'connected' ||
      peer.iceConnectionState === 'completed'
    )
  }

  function clearPendingIceCandidateError() {
    if (pendingIceCandidateErrorTimeout) {
      window.clearTimeout(pendingIceCandidateErrorTimeout)
      pendingIceCandidateErrorTimeout = null
    }
  }

  function isPeerRecoveryState() {
    return resolveVoicePeerRecoveryDelayMs(
      peer.connectionState,
      hasAttemptedPeerRecovery,
      peer.iceConnectionState,
    ) !== null
  }

  function clearPendingPeerRecovery() {
    if (pendingPeerRecoveryTimeout !== null) {
      window.clearTimeout(pendingPeerRecoveryTimeout)
      pendingPeerRecoveryTimeout = null
    }
  }

  function schedulePeerRecovery() {
    const delayMs = resolveVoicePeerRecoveryDelayMs(
      peer.connectionState,
      hasAttemptedPeerRecovery,
      peer.iceConnectionState,
    )
    if (
      delayMs === null ||
      pendingPeerRecoveryTimeout !== null ||
      isPeerRecoveryInFlight
    ) {
      return
    }

    pendingPeerRecoveryTimeout = window.setTimeout(() => {
      pendingPeerRecoveryTimeout = null
      if (!isPeerRecoveryState()) {
        return
      }

      isPeerRecoveryInFlight = true
      void restartPeerIce(remoteParticipantId, peer)
        .catch((error) => {
          voiceDebug('ice:recovery-loop-failed', {
            remoteParticipantId,
            message: error instanceof Error ? error.message : String(error),
          })
        })
        .finally(() => {
          isPeerRecoveryInFlight = false
          const shouldContinueRecovery = isPeerRecoveryState()
          hasAttemptedPeerRecovery = shouldContinueRecovery
          if (shouldContinueRecovery) {
            schedulePeerRecovery()
          }
        })
    }, delayMs)
  }

  peer.onicecandidateerror = (event) => {
    voiceDebug('ice:candidate-error', {
      remoteParticipantId,
      errorCode: event.errorCode,
      errorText: event.errorText,
    })
    if (isPeerConnected()) {
      return
    }

    if (event.errorCode === 401 || event.errorCode === 438) {
      setVoiceError(voiceCopy.errors.turnAuthRejected)
    } else if (event.errorCode >= 700) {
      clearPendingIceCandidateError()
      pendingIceCandidateErrorTimeout = window.setTimeout(() => {
        pendingIceCandidateErrorTimeout = null

        if (isPeerConnected() || getRemoteStream(remoteParticipantId)) {
          return
        }

        setVoiceError(voiceCopy.errors.turnConnectionFailed)
      }, 2500)
    }
  }

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      clearPendingIceCandidateError()
      rememberCandidateType(remoteParticipantId, event.candidate.type)
      voiceDebug('ice:local-candidate', {
        remoteParticipantId,
        candidateType: event.candidate.type,
        protocol: event.candidate.protocol,
      })
      if (event.candidate.type === 'relay') {
        setVoiceError(null)
      }
      void sendVoiceSignal(remoteParticipantId, 'ice', event.candidate).catch(
        (error) => {
          voiceDebug('ice:signal-send-failed', {
            remoteParticipantId,
            message: error instanceof Error ? error.message : String(error),
          })
        },
      )
    } else {
      voiceDebug('ice:gathering-complete', {
        remoteParticipantId,
      })
    }
  }

  peer.ontrack = (event) => {
    const remoteStream =
      getRemoteStream(remoteParticipantId) ??
      event.streams[0] ??
      new MediaStream()

    if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
      remoteStream.addTrack(event.track)
    }
    event.track.onended = () => {
      remoteStream.removeTrack(event.track)
      setRemoteStream(remoteParticipantId, remoteStream)
      updatePeerStatus(remoteParticipantId)
    }
    event.track.onmute = () => {
      updatePeerStatus(remoteParticipantId)
    }
    event.track.onunmute = () => {
      updatePeerStatus(remoteParticipantId)
    }

    voiceDebug('track:remote', {
      remoteParticipantId,
      trackId: event.track.id,
      kind: event.track.kind,
      enabled: event.track.enabled,
      muted: event.track.muted,
      readyState: event.track.readyState,
      streamlessTrack: event.streams.length === 0,
      streamAudioTracks: remoteStream.getAudioTracks().length,
      streamVideoTracks: remoteStream.getVideoTracks().length,
    })
    clearPendingIceCandidateError()
    setVoiceError(null)
    if (remoteStream.getAudioTracks().length > 0) {
      startVoiceActivityMonitor(remoteParticipantId, remoteStream)
    }
    setRemoteStream(remoteParticipantId, remoteStream)
    updatePeerStatus(remoteParticipantId)
  }

  peer.oniceconnectionstatechange = () => {
    voiceDebug('peer:ice-state', {
      remoteParticipantId,
      iceConnectionState: peer.iceConnectionState,
    })
    updatePeerStatus(remoteParticipantId)

    if (peer.iceConnectionState === 'failed') {
      reportIceFailure(remoteParticipantId)
      clearPendingPeerRecovery()
      schedulePeerRecovery()
      return
    }
    if (peer.iceConnectionState === 'disconnected') {
      schedulePeerRecovery()
      return
    }
    if (
      (peer.iceConnectionState === 'connected' ||
        peer.iceConnectionState === 'completed') &&
      peer.connectionState !== 'failed' &&
      peer.connectionState !== 'disconnected'
    ) {
      clearPendingPeerRecovery()
      hasAttemptedPeerRecovery = false
    }
  }
  peer.onicegatheringstatechange = () => {
    voiceDebug('peer:ice-gathering-state', {
      remoteParticipantId,
      iceGatheringState: peer.iceGatheringState,
    })
  }
  peer.onsignalingstatechange = () => {
    voiceDebug('peer:signaling-state', {
      remoteParticipantId,
      signalingState: peer.signalingState,
    })
    updatePeerStatus(remoteParticipantId)
  }
  peer.onconnectionstatechange = () => {
    voiceDebug('peer:connection-state', {
      remoteParticipantId,
      connectionState: peer.connectionState,
    })
    if (peer.connectionState === 'connected') {
      scheduleConnectedStatsSnapshots()
    } else if (peer.connectionState === 'failed') {
      cancelStatsSnapshots()
      captureStatsSnapshot('failed')
    } else if (peer.connectionState === 'closed') {
      cancelStatsSnapshots()
    }
    updatePeerStatus(remoteParticipantId)

    if (
      peer.connectionState === 'connected' &&
      peer.iceConnectionState !== 'failed' &&
      peer.iceConnectionState !== 'disconnected'
    ) {
      clearPendingIceCandidateError()
      clearPendingPeerRecovery()
      hasAttemptedPeerRecovery = false
      setVoiceError(null)
      return
    }

    if (isPeerRecoveryState()) {
      if (
        peer.connectionState === 'failed' ||
        peer.iceConnectionState === 'failed'
      ) {
        reportIceFailure(remoteParticipantId)
        clearPendingPeerRecovery()
      }
      schedulePeerRecovery()
      return
    }

    clearPendingPeerRecovery()
    if (peer.connectionState === 'closed') {
      closePeer(remoteParticipantId)
    }
  }
}
