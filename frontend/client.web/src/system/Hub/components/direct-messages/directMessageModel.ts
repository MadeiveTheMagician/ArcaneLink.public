import type {
  PrivateSpaceMemberResponse,
  PrivateSpaceResponse,
} from '../../../../shared/types'
import { communityCopy } from '../../../shared/copy/community.ru'

type PrivateSpaceMuteSettings = Pick<
  PrivateSpaceResponse['viewerSettings'],
  'isMutedIndefinitely' | 'mutedUntil'
>

export type PrivateSpaceMuteState = {
  isMuted: boolean
  isIndefinite: boolean
  expiresAtMs: number | null
  remainingMs: number | null
}

export type PrivateSpaceTooltipModel = {
  title: string
  note: string | null
}

const visibleDefaultGroupMemberCount = 3

export function getDefaultPrivateSpaceGroupTitle(
  members: readonly PrivateSpaceMemberResponse[],
) {
  const names = members
    .filter((member) => member.statusCode === 'active')
    .map((member) => member.user.displayName.trim())
    .filter(Boolean)
    .slice(0, visibleDefaultGroupMemberCount + 1)

  if (names.length === 0) {
    return communityCopy.direct.newGroup
  }

  return communityCopy.direct.defaultGroupTitle(
    names.slice(0, visibleDefaultGroupMemberCount),
    names.length > visibleDefaultGroupMemberCount,
  )
}

export function getPrivateSpaceOtherMember(
  space: PrivateSpaceResponse,
  currentUserId: string,
): PrivateSpaceMemberResponse | null {
  return (
    space.members.find(
      (member) =>
        member.userId !== currentUserId && member.statusCode === 'active',
    ) ??
    space.members.find((member) => member.userId !== currentUserId) ??
    null
  )
}

export function getPrivateSpaceTitle(
  space: PrivateSpaceResponse | null | undefined,
  currentUserId: string,
) {
  if (!space) {
    return communityCopy.direct.defaultDirectTitle
  }

  if (space.kind === 'direct') {
    if (space.viewerSettings.customNickname?.trim()) {
      return space.viewerSettings.customNickname.trim()
    }

    return (
      getPrivateSpaceOtherMember(space, currentUserId)?.user.displayName ??
      communityCopy.direct.defaultDirectTitle
    )
  }

  return space.title?.trim() || getDefaultPrivateSpaceGroupTitle(space.members)
}

export function getPrivateSpaceTooltipModel(
  space: PrivateSpaceResponse,
  currentUserId: string,
): PrivateSpaceTooltipModel {
  const originalTitle =
    space.kind === 'direct'
      ? getPrivateSpaceOtherMember(space, currentUserId)?.user.displayName.trim() ||
        communityCopy.direct.defaultDirectTitle
      : space.title?.trim() || getDefaultPrivateSpaceGroupTitle(space.members)
  const customTitle =
    space.kind === 'direct'
      ? space.viewerSettings.customNickname?.trim() || null
      : null

  return {
    title: customTitle ? `${originalTitle}: ${customTitle}` : originalTitle,
    note: space.viewerSettings.note?.trim() || null,
  }
}

export function resolvePrivateSpaceMuteState(
  settings: PrivateSpaceMuteSettings,
  nowMs = Date.now(),
): PrivateSpaceMuteState {
  if (settings.isMutedIndefinitely) {
    return {
      isMuted: true,
      isIndefinite: true,
      expiresAtMs: null,
      remainingMs: null,
    }
  }

  const expiresAtMs = settings.mutedUntil
    ? Date.parse(settings.mutedUntil)
    : Number.NaN
  const isFiniteMute =
    Number.isFinite(expiresAtMs) && expiresAtMs > nowMs

  return {
    isMuted: isFiniteMute,
    isIndefinite: false,
    expiresAtMs: isFiniteMute ? expiresAtMs : null,
    remainingMs: isFiniteMute ? expiresAtMs - nowMs : null,
  }
}

export function formatPrivateSpaceMuteRemaining(
  state: PrivateSpaceMuteState,
): string | null {
  if (!state.isMuted) {
    return null
  }

  if (state.isIndefinite) {
    return '∞'
  }

  const totalSeconds = Math.max(
    0,
    Math.ceil((state.remainingMs ?? 0) / 1000),
  )
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function getPrivateSpacePresenceStatus(
  space: PrivateSpaceResponse,
  currentUserId: string,
) {
  if (space.kind !== 'direct') {
    return null
  }

  const otherMember = getPrivateSpaceOtherMember(space, currentUserId)

  if (!otherMember) {
    return null
  }

  return otherMember.user.presenceStatus
}

export function getPrivateSpacePreview(space: PrivateSpaceResponse) {
  const body = space.lastMessage?.body?.trim()

  if (body) {
    return body
  }

  if (space.lastMessage?.assets.length) {
    return communityCopy.direct.attachment
  }

  return communityCopy.direct.noMessages
}

export function formatPrivateSpaceTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
