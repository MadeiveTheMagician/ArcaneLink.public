const enabled = isEnabled()
const maxEntries = 160
const entries: string[] = []
const peers = new Map<string, number>()
const startedAt = enabled ? performance.now() : 0

// Keep this allowlist narrow. In particular, never record SDP, ICE URLs,
// candidate addresses, participant IDs or raw browser error text.
const events = {
  'peer:created': ['iceTransportPolicy'],
  'peer:closed': [],
  'peer:ice-state': ['iceConnectionState'],
  'peer:ice-gathering-state': ['iceGatheringState'],
  'peer:signaling-state': ['signalingState'],
  'peer:connection-state': ['connectionState'],
  'ice:local-candidate': ['candidateType', 'protocol'],
  'ice:candidate-error': ['errorCode'],
  'ice:gathering-complete': [],
  'ice:queued': [],
  'ice:applied': [],
  'ice:failed': [],
  'ice:signal-send-failed': [],
  'ice:restart-offer-created': [],
  'ice:restart-failed': [],
  'signal:sent': ['kind'],
  'offer:created': [],
  'offer:send-failed': [],
  'offer:answer-timeout': [],
  'answer:created': [],
  'answer:applied': [],
  'track:remote': ['kind', 'muted', 'streamAudioTracks', 'streamVideoTracks'],
} as const

const safeValues = new Set([
  'all', 'relay', 'host', 'srflx', 'prflx', 'udp', 'tcp', 'offer', 'answer', 'ice',
  'audio', 'video', 'new', 'connecting', 'connected', 'disconnected', 'failed',
  'closed', 'checking', 'completed', 'gathering', 'complete', 'stable',
  'have-local-offer', 'have-remote-offer', 'have-local-pranswer', 'have-remote-pranswer',
])

declare global {
  interface Window {
    arcaneLinkVoiceTrace?: () => string
  }
}

if (enabled) {
  window.arcaneLinkVoiceTrace = () => entries.join('\n')
}

export function recordVoiceTransportTrace(event: string, details: unknown) {
  if (!enabled || !Object.hasOwn(events, event)) {
    return
  }

  const data = typeof details === 'object' && details !== null
    ? details as Record<string, unknown>
    : {}
  const fields: Record<string, string | number | boolean> = {}
  const remoteId = data.remoteParticipantId ?? data.targetParticipantId ?? data.participantId
  if (typeof remoteId === 'string') {
    let peer = peers.get(remoteId)
    if (peer === undefined && peers.size < maxEntries) {
      peer = peers.size + 1
      peers.set(remoteId, peer)
    }
    if (peer !== undefined) fields.peer = peer
  }

  for (const key of events[event as keyof typeof events]) {
    const value = data[key]
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && safeValues.has(value))) {
      fields[key] = value
    }
  }
  if (event === 'peer:created' && Array.isArray(data.iceServers)) {
    fields.iceServerCount = data.iceServers.length
  }

  const line = JSON.stringify({ ms: Math.round(performance.now() - startedAt), event, ...fields })
  entries.push(line)
  if (entries.length > maxEntries) entries.shift()
  console.info('[voice-trace]', line)
}

function isEnabled() {
  try {
    return typeof window !== 'undefined' &&
      window.localStorage.getItem('arcanelink.voiceTransportTrace') === '1'
  } catch {
    return false
  }
}
