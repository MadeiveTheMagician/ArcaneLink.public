import {
  createSafeVoicePeerStatsSummary,
  serializeSafeVoicePeerStatsSummary,
} from './voicePeerStatsSummary'

export const isVoiceDebugEnabled = resolveVoiceDebugEnabled()

function resolveVoiceDebugEnabled() {
  if (import.meta.env?.VITE_VOICE_DEBUG === 'true') {
    return true
  }

  try {
    return localStorage.getItem('arcanelink.voiceDebug') === '1'
  } catch {
    return false
  }
}

export function voiceDebug(event: string, details?: unknown) {
  if (!isVoiceDebugEnabled) {
    return
  }

  console.info(`[voice] ${event}`, details ?? '')
}

export async function logPeerConnectionStats(
  _remoteUserId: string,
  peer: RTCPeerConnection,
  sample: string = 'event',
) {
  if (!isVoiceDebugEnabled) {
    return
  }

  const stats = await peer.getStats()
  const statsRecords: unknown[] = []
  stats.forEach((report) => statsRecords.push(report))
  const summary = createSafeVoicePeerStatsSummary({
    sample,
    connectionState: peer.connectionState,
    iceConnectionState: peer.iceConnectionState,
    signalingState: peer.signalingState,
    transceivers: peer.getTransceivers().map((transceiver) => ({
      direction: transceiver.direction,
      currentDirection: transceiver.currentDirection,
      senderTrack: describeTrack(transceiver.sender.track),
      receiverTrack: describeTrack(transceiver.receiver.track),
    })),
    stats: statsRecords,
  })

  voiceDebug('peer:stats', serializeSafeVoicePeerStatsSummary(summary))
}

function describeTrack(track: MediaStreamTrack | null) {
  return track
    ? {
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      }
    : null
}
