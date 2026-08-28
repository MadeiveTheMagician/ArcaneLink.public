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
  const avatarAssetId = member?.user.avatarAssetId ?? participant.avatarAssetId
  const avatarUrl = avatarAssetId
    ? `/api/assets/${avatarAssetId}/content`
    : null
  const avatarCropOffsetX =
    member?.user.avatarCropOffsetX ?? participant.avatarCropOffsetX ?? 0
  const avatarCropOffsetY =
    member?.user.avatarCropOffsetY ?? participant.avatarCropOffsetY ?? 0
  const avatarCropZoom =
    member?.user.avatarCropZoom ?? participant.avatarCropZoom ?? 1

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
            transform: `translate(${avatarCropOffsetX * 100}%, ${
              avatarCropOffsetY * 100
            }%) scale(${avatarCropZoom})`,
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
