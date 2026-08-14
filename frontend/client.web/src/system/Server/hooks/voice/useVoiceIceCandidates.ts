import { useRef } from 'react'
import { normalizeUserId } from './voiceChannelUtils'

export function useVoiceIceCandidates() {
  const peerCandidateTypesRef = useRef<Record<string, Set<string>>>({})

  function rememberCandidateType(participantId: string, candidateType: string | null) {
    if (!candidateType) {
      return
    }

    const normalizedParticipantId = normalizeUserId(participantId)
    const candidateTypes =
      peerCandidateTypesRef.current[normalizedParticipantId] ?? new Set<string>()
    candidateTypes.add(candidateType)
    peerCandidateTypesRef.current[normalizedParticipantId] = candidateTypes
  }

  function getCandidateTypes(participantId: string) {
    const normalizedParticipantId = normalizeUserId(participantId)

    return [
      ...(peerCandidateTypesRef.current[normalizedParticipantId] ?? new Set<string>()),
    ]
  }

  function forgetCandidateTypes(participantId: string) {
    delete peerCandidateTypesRef.current[normalizeUserId(participantId)]
  }

  return {
    rememberCandidateType,
    getCandidateTypes,
    forgetCandidateTypes,
  }
}
