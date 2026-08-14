import type { SyntheticEvent } from 'react'
import type { ServerMemberDetailsResponse } from '../../../../../shared/types'
import {
  fallbackAvatarAccent,
  toAvatarAccent,
} from '../../../../shared/utils/avatarAccent'
import type { VoiceParticipant } from '../../../hooks/voice/useVoiceChannel'

export function normalizeVoiceParticipantUserId(userId: string) {
  return userId.trim().toLowerCase()
}

export function getVoiceParticipantMember(
  participant: VoiceParticipant,
  serverMembers: ServerMemberDetailsResponse[],
) {
  const participantUserId = normalizeVoiceParticipantUserId(participant.userId)

  return serverMembers.find(
    (member) =>
      normalizeVoiceParticipantUserId(member.userId) === participantUserId,
  )
}

export function VoiceParticipantAvatar({
  participant,
  member,
  className,
  onAccentChange,
}: {
  participant: VoiceParticipant
  member: ServerMemberDetailsResponse | undefined
  className: string
  onAccentChange?: (accent: string) => void
}) {
  const avatarUrl = member?.user.avatarAssetId
    ? `/api/assets/${member.user.avatarAssetId}/content`
    : null

  function handleAvatarLoad(event: SyntheticEvent<HTMLImageElement>) {
    if (!onAccentChange) {
      return
    }

    try {
      onAccentChange(toAvatarAccent(event.currentTarget))
    } catch {
      onAccentChange(fallbackAvatarAccent)
    }
  }

  return (
    <span className={`${className} ui-frame`} draggable={false} aria-hidden="true">
      {avatarUrl ? (
        <img
          className="ui-media-fit"
          src={avatarUrl}
          alt=""
          draggable={false}
          style={{
            transform: `translate(${(member?.user.avatarCropOffsetX ?? 0) * 100}%, ${
              (member?.user.avatarCropOffsetY ?? 0) * 100
            }%) scale(${member?.user.avatarCropZoom ?? 1})`,
          }}
          onLoad={onAccentChange ? handleAvatarLoad : undefined}
          onError={
            onAccentChange
              ? () => onAccentChange(fallbackAvatarAccent)
              : undefined
          }
        />
      ) : (
        participant.displayName.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}
