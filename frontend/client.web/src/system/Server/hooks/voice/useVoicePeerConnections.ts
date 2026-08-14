import { useRef } from 'react'
import { normalizeUserId } from './voiceChannelUtils'

export function useVoicePeerConnections() {
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({})

  function getPeerConnection(participantId: string) {
    return peerConnectionsRef.current[normalizeUserId(participantId)] ?? null
  }

  function hasPeerConnection(participantId: string) {
    return Boolean(getPeerConnection(participantId))
  }

  function setPeerConnection(
    participantId: string,
    peerConnection: RTCPeerConnection,
  ) {
    peerConnectionsRef.current[normalizeUserId(participantId)] = peerConnection
  }

  function getPeerConnectionIds() {
    return Object.keys(peerConnectionsRef.current)
  }

  function getPeerConnectionsSnapshot() {
    return Object.entries(peerConnectionsRef.current)
  }

  function isCurrentPeerConnection(
    participantId: string,
    peerConnection: RTCPeerConnection,
  ) {
    return getPeerConnection(participantId) === peerConnection
  }

  function closePeerConnection(participantId: string) {
    const normalizedParticipantId = normalizeUserId(participantId)
    peerConnectionsRef.current[normalizedParticipantId]?.close()
    delete peerConnectionsRef.current[normalizedParticipantId]
  }

  return {
    getPeerConnection,
    hasPeerConnection,
    setPeerConnection,
    getPeerConnectionIds,
    getPeerConnectionsSnapshot,
    isCurrentPeerConnection,
    closePeerConnection,
  }
}
