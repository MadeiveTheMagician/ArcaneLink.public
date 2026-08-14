export type VoicePlaybackParticipantIdentity = {
  participantId: string
  userId: string
}

export function indexVoiceUserIdsByParticipantId(
  participants: readonly VoicePlaybackParticipantIdentity[],
) {
  return Object.fromEntries(
    participants
      .map((participant) => [
        normalizeVoiceIdentity(participant.participantId),
        normalizeVoiceIdentity(participant.userId),
      ] as const)
      .filter(([participantId, userId]) => participantId && userId),
  )
}

export function resolveVoicePlaybackUserId(
  participantId: string,
  userIdByParticipantId: Readonly<Record<string, string>>,
) {
  return userIdByParticipantId[normalizeVoiceIdentity(participantId)] ?? null
}

function normalizeVoiceIdentity(value: string) {
  return value.trim().toLowerCase()
}
