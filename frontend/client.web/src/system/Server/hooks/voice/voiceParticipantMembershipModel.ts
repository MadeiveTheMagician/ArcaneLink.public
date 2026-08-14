import type { VoiceParticipant } from './voiceChannelTypes'
import { normalizeUserId } from './voiceChannelUtils'

type IsLocalVoiceParticipantOptions = {
  participant: VoiceParticipant
  currentUserId: string
  localParticipantId: string | null
  hasConnectedChannel: boolean
}

export function isLocalVoiceParticipant({
  participant,
  currentUserId,
  localParticipantId,
  hasConnectedChannel,
}: IsLocalVoiceParticipantOptions) {
  if (localParticipantId) {
    return normalizeUserId(participant.participantId) === localParticipantId
  }

  // During JoinVoiceChannel the server can broadcast state before the caller
  // receives its participant id. The user-id fallback is valid only while this
  // tab owns an active or pending voice connection.
  return (
    hasConnectedChannel &&
    normalizeUserId(participant.userId) === currentUserId
  )
}
