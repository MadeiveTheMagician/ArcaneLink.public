import { useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type {
  PrivateSpaceMemberResponse,
  PrivateSpaceResponse,
  ServerMemberResponse,
} from '../../../../shared/types'
import type { ContextMenuItem } from '../../../shared/components/context-menu/ContextMenu'
import { communityCopy } from '../../../shared/copy/community.ru'
import { profileCopy } from '../../../shared/copy/profile.ru'
import { useContextMenuDismiss } from '../../../shared/hooks/useContextMenuDismiss'
import {
  formatPrivateSpaceMuteRemaining,
  getPrivateSpaceOtherMember,
  resolvePrivateSpaceMuteState,
} from './directMessageModel'

type DirectMessageContextMenuState = {
  space: PrivateSpaceResponse
  x: number
  y: number
}

type MuteMode = 'off' | '1h' | '4h' | '8h' | 'indefinite'

type DirectMessageContextMenuOptions = {
  currentUserId: string
  friendUserIds: Set<string>
  isMutatingPrivateSpaces: boolean
  pinnedSpaceIds: Set<string>
  onOpenUserProfile: (space: PrivateSpaceResponse) => void
  onOpenNote: (space: PrivateSpaceResponse) => void
  onOpenNickname: (space: PrivateSpaceResponse) => void
  onChooseCustomAvatar: (space: PrivateSpaceResponse) => void
  onClearCustomAvatar: (spaceId: string) => void
  onOpenGroupSettings: (space: PrivateSpaceResponse) => void
  onTogglePin: (spaceId: string, isPinned: boolean) => void
  onSetMute: (spaceId: string, mode: MuteMode) => void
  onMarkRead: (spaceId: string) => void
  onBlockUser: (member: PrivateSpaceMemberResponse) => void
  onUnblockUser: (member: PrivateSpaceMemberResponse) => void
  onSendFriendRequest: (userId: string) => void
  onLoadInviteTargetServers: (
    targetUserId: string,
  ) => Promise<ServerMemberResponse[]>
  onRequestClearHistory: (space: PrivateSpaceResponse) => void
  onRequestLeaveGroup: (space: PrivateSpaceResponse) => void
  onRequestDeleteDirect: (space: PrivateSpaceResponse) => void
  onCreateDirectServerInvite: (serverId: string, targetUserId: string) => void
  onRemoveFriend: (userId: string) => void
}

export function useDirectMessageContextMenu({
  currentUserId,
  friendUserIds,
  isMutatingPrivateSpaces,
  pinnedSpaceIds,
  onOpenUserProfile,
  onOpenNote,
  onOpenNickname,
  onChooseCustomAvatar,
  onClearCustomAvatar,
  onOpenGroupSettings,
  onTogglePin,
  onSetMute,
  onMarkRead,
  onBlockUser,
  onUnblockUser,
  onSendFriendRequest,
  onLoadInviteTargetServers,
  onRequestClearHistory,
  onRequestLeaveGroup,
  onRequestDeleteDirect,
  onCreateDirectServerInvite,
  onRemoveFriend,
}: DirectMessageContextMenuOptions) {
  const [contextMenu, setContextMenu] =
    useState<DirectMessageContextMenuState | null>(null)
  const [inviteTargetsByUserId, setInviteTargetsByUserId] = useState<
    Record<string, ServerMemberResponse[]>
  >({})
  const [loadingInviteTargetUserId, setLoadingInviteTargetUserId] = useState<
    string | null
  >(null)
  const [muteClockMs, setMuteClockMs] = useState(() => Date.now())

  function closeContextMenu() {
    setContextMenu(null)
  }

  useContextMenuDismiss(Boolean(contextMenu), closeContextMenu)

  function openContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    space: PrivateSpaceResponse,
  ) {
    event.preventDefault()
    event.stopPropagation()
    const openedAt = Date.now()
    setMuteClockMs(openedAt)
    setContextMenu({
      space,
      x: event.clientX,
      y: event.clientY,
    })

    if (space.kind !== 'direct') return
    const otherMember = getPrivateSpaceOtherMember(space, currentUserId)
    if (otherMember && !inviteTargetsByUserId[otherMember.userId]) {
      setLoadingInviteTargetUserId(otherMember.userId)
      void onLoadInviteTargetServers(otherMember.userId)
        .then((memberships) => {
          setInviteTargetsByUserId((current) => ({
            ...current,
            [otherMember.userId]: memberships,
          }))
        })
        .finally(() => {
          setLoadingInviteTargetUserId((current) =>
            current === otherMember.userId ? null : current,
          )
        })
    }
  }

  useEffect(() => {
    if (!contextMenu) {
      return undefined
    }

    const muteState = resolvePrivateSpaceMuteState(
      contextMenu.space.viewerSettings,
      muteClockMs,
    )
    if (
      !muteState.isMuted ||
      muteState.isIndefinite ||
      muteState.remainingMs == null
    ) {
      return undefined
    }

    const timer = window.setTimeout(
      () => setMuteClockMs(Date.now()),
      Math.max(250, Math.min(1_000, muteState.remainingMs)),
    )
    return () => window.clearTimeout(timer)
  }, [contextMenu, muteClockMs])

  const getMuteItems = (
    space: PrivateSpaceResponse,
    nowMs: number,
  ): ContextMenuItem[] => {
    const muteState = resolvePrivateSpaceMuteState(space.viewerSettings, nowMs)
    return [
      {
        type: 'item',
        label: communityCopy.direct.unmute,
        selected: !muteState.isMuted,
        onSelect: () => onSetMute(space.spaceId, 'off'),
      },
      {
        type: 'item',
        label: communityCopy.direct.muteOneHour,
        onSelect: () => onSetMute(space.spaceId, '1h'),
      },
      {
        type: 'item',
        label: communityCopy.direct.muteFourHours,
        onSelect: () => onSetMute(space.spaceId, '4h'),
      },
      {
        type: 'item',
        label: communityCopy.direct.muteEightHours,
        onSelect: () => onSetMute(space.spaceId, '8h'),
      },
      {
        type: 'item',
        label: communityCopy.direct.muteIndefinitely,
        selected: muteState.isIndefinite,
        onSelect: () => onSetMute(space.spaceId, 'indefinite'),
      },
    ]
  }

  function getContextMenuItems(): ContextMenuItem[] {
    if (!contextMenu) return []

    const space = contextMenu.space
    const isPinned = pinnedSpaceIds.has(space.spaceId)
    const muteState = resolvePrivateSpaceMuteState(
      space.viewerSettings,
      muteClockMs,
    )
    const muteRemaining = formatPrivateSpaceMuteRemaining(muteState)
    const sharedItems: ContextMenuItem[] = [
      {
        type: 'item',
        label: isPinned
          ? communityCopy.direct.unpin
          : communityCopy.direct.pin,
        icon: 'space',
        disabled: isMutatingPrivateSpaces,
        onSelect: () => onTogglePin(space.spaceId, !isPinned),
      },
      {
        id: 'private-space-mute',
        type: 'item',
        label: muteRemaining
          ? `${communityCopy.direct.mute} · ${muteRemaining}`
          : communityCopy.direct.mute,
        icon: 'settings',
        submenu: getMuteItems(space, muteClockMs),
      },
    ]
    const personalAvatarItems: ContextMenuItem[] = [
      {
        type: 'item',
        label: space.viewerSettings.customAvatarAssetId
          ? communityCopy.direct.changePersonalAvatar
          : communityCopy.direct.addPersonalAvatar,
        icon: 'profile',
        disabled: isMutatingPrivateSpaces,
        onSelect: () => onChooseCustomAvatar(space),
      },
      ...(space.viewerSettings.customAvatarAssetId
        ? [
            {
              type: 'item' as const,
              label: communityCopy.direct.resetPersonalAvatar,
              icon: 'trash' as const,
              disabled: isMutatingPrivateSpaces,
              onSelect: () => onClearCustomAvatar(space.spaceId),
            },
          ]
        : []),
    ]

    if (space.kind === 'group') {
      return [
        {
          type: 'item',
          label: communityCopy.direct.groupSettings,
          icon: 'settings',
          disabled: space.ownerUserId !== currentUserId,
          onSelect: () => onOpenGroupSettings(space),
        },
        { type: 'separator' },
        ...sharedItems,
        { type: 'separator' },
        ...personalAvatarItems,
        { type: 'separator' },
        {
          type: 'item',
          label: communityCopy.direct.markAllRead,
          icon: 'message',
          disabled: space.unreadCount === 0,
          onSelect: () => onMarkRead(space.spaceId),
        },
        {
          type: 'item',
          label: communityCopy.direct.clearHistory,
          icon: 'trash',
          disabled: isMutatingPrivateSpaces,
          onSelect: () => onRequestClearHistory(space),
        },
        { type: 'separator' },
        {
          type: 'item',
          label: communityCopy.direct.leaveGroup,
          icon: 'leave',
          danger: true,
          disabled: isMutatingPrivateSpaces,
          onSelect: () => onRequestLeaveGroup(space),
        },
      ]
    }

    const otherMember = getPrivateSpaceOtherMember(space, currentUserId)
    const inviteServers = otherMember
      ? (inviteTargetsByUserId[otherMember.userId] ?? [])
      : []
    const isLoadingInviteTargets =
      otherMember?.userId === loadingInviteTargetUserId
    const isFriend = otherMember
      ? friendUserIds.has(otherMember.userId)
      : false

    return [
      {
        type: 'item',
        label: profileCopy.labels.profile,
        icon: 'profile',
        disabled: !otherMember,
        onSelect: () => onOpenUserProfile(space),
      },
      {
        type: 'item',
        label: communityCopy.direct.inviteToServer,
        icon: 'invite',
        disabled:
          !otherMember || isLoadingInviteTargets || inviteServers.length === 0,
        submenu:
          otherMember && inviteServers.length > 0
            ? inviteServers.map((membership) => ({
                type: 'item' as const,
                label: membership.server.title,
                icon: 'invite' as const,
                onSelect: () =>
                  onCreateDirectServerInvite(
                    membership.serverId,
                    otherMember.userId,
                  ),
              }))
            : undefined,
      },
      { type: 'separator' },
      ...sharedItems,
      {
        type: 'item',
        label: communityCopy.direct.markAllRead,
        icon: 'message',
        disabled: space.unreadCount === 0,
        onSelect: () => onMarkRead(space.spaceId),
      },
      { type: 'separator' },
      {
        type: 'item',
        label: space.viewerSettings.note
          ? communityCopy.direct.changeNote
          : communityCopy.direct.addNote,
        icon: 'edit',
        onSelect: () => onOpenNote(space),
      },
      {
        type: 'item',
        label: space.viewerSettings.customNickname
          ? communityCopy.direct.changeNickname
          : communityCopy.direct.addNickname,
        icon: 'edit',
        onSelect: () => onOpenNickname(space),
      },
      ...personalAvatarItems,
      { type: 'separator' },
      {
        type: 'item',
        label: isFriend
          ? communityCopy.direct.removeFriend
          : communityCopy.direct.addFriend,
        icon: 'friend',
        disabled: !otherMember,
        onSelect: () => {
          if (!otherMember) return
          if (isFriend) onRemoveFriend(otherMember.userId)
          else onSendFriendRequest(otherMember.userId)
        },
      },
      {
        type: 'item',
        label: space.viewerSettings.isPeerBlocked
          ? communityCopy.direct.unblock
          : communityCopy.direct.block,
        icon: 'block',
        danger: !space.viewerSettings.isPeerBlocked,
        disabled: !otherMember,
        onSelect: () => {
          if (!otherMember) return
          if (space.viewerSettings.isPeerBlocked) onUnblockUser(otherMember)
          else onBlockUser(otherMember)
        },
      },
      { type: 'separator' },
      {
        type: 'item',
        label: communityCopy.direct.clearHistory,
        icon: 'trash',
        disabled: isMutatingPrivateSpaces,
        onSelect: () => onRequestClearHistory(space),
      },
      {
        type: 'item',
        label: communityCopy.direct.deleteDirect,
        icon: 'leave',
        danger: true,
        disabled: isMutatingPrivateSpaces,
        onSelect: () => onRequestDeleteDirect(space),
      },
    ]
  }

  return {
    contextMenu,
    contextMenuItems: getContextMenuItems(),
    openContextMenu,
    closeContextMenu,
  }
}
