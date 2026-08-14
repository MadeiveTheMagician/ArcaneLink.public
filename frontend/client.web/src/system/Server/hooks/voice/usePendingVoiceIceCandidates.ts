import { useRef } from 'react'
import { normalizeUserId } from './voiceChannelUtils'

export function usePendingVoiceIceCandidates() {
  const pendingIceCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>(
    {},
  )

  function queuePendingIceCandidate(
    participantId: string,
    candidate: RTCIceCandidateInit,
  ) {
    const normalizedParticipantId = normalizeUserId(participantId)

    pendingIceCandidatesRef.current[normalizedParticipantId] = [
      ...(pendingIceCandidatesRef.current[normalizedParticipantId] ?? []),
      candidate,
    ]
  }

  function getPendingIceCandidates(participantId: string) {
    return pendingIceCandidatesRef.current[normalizeUserId(participantId)] ?? []
  }

  function forgetPendingIceCandidates(participantId: string) {
    delete pendingIceCandidatesRef.current[normalizeUserId(participantId)]
  }

  return {
    queuePendingIceCandidate,
    getPendingIceCandidates,
    forgetPendingIceCandidates,
  }
}
