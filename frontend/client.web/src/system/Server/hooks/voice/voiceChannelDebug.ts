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
  remoteUserId: string,
  peer: RTCPeerConnection,
) {
  if (!isVoiceDebugEnabled) {
    return
  }

  const stats = await peer.getStats()
  const selectedPairs: unknown[] = []
  const candidates: unknown[] = []
  const inboundAudio: unknown[] = []
  const outboundAudio: unknown[] = []

  stats.forEach((report) => {
    if (
      report.type === 'candidate-pair' &&
      (report.selected || report.nominated)
    ) {
      selectedPairs.push({
        id: report.id,
        state: report.state,
        selected: report.selected,
        nominated: report.nominated,
        bytesSent: report.bytesSent,
        bytesReceived: report.bytesReceived,
        localCandidateId: report.localCandidateId,
        remoteCandidateId: report.remoteCandidateId,
      })
    }

    if (
      report.type === 'local-candidate' ||
      report.type === 'remote-candidate'
    ) {
      candidates.push({
        id: report.id,
        type: report.type,
        candidateType: report.candidateType,
        protocol: report.protocol,
        address: report.address ?? report.ip,
        port: report.port,
        relayProtocol: report.relayProtocol,
      })
    }

    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
      inboundAudio.push({
        packetsReceived: report.packetsReceived,
        packetsLost: report.packetsLost,
        bytesReceived: report.bytesReceived,
        jitter: report.jitter,
      })
    }

    if (report.type === 'outbound-rtp' && report.kind === 'audio') {
      outboundAudio.push({
        packetsSent: report.packetsSent,
        bytesSent: report.bytesSent,
      })
    }
  })

  voiceDebug('peer:stats', {
    remoteUserId,
    selectedPairs,
    candidates,
    inboundAudio,
    outboundAudio,
  })
}
