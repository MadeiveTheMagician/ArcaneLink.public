import { expect, test } from '@playwright/test'

import type {
  PermissionResponse,
  ServerMemberDetailsResponse,
  ServerMemberRoleResponse,
  ServerRoleResponse,
} from '../../src/shared/types'
import { buildVoiceParticipantContextMenuItems } from '../../src/system/Server/components/context-menus/voiceParticipantContextMenuItems'
import type { VoiceParticipant } from '../../src/system/Server/hooks/voice/useVoiceChannel'
import type { ContextMenuItem } from '../../src/system/shared/components/context-menu/ContextMenu'
import { voiceCopy } from '../../src/system/shared/copy'

function permission(code: string): PermissionResponse {
  return {
    id: `permission-${code}`,
    code,
    title: code,
    description: null,
  }
}

function role(
  id: string,
  level: number,
  permissionCodes: string[] = [],
): ServerRoleResponse {
  return {
    id,
    serverId: 'server-1',
    code: null,
    title: id,
    description: null,
    kind: 'standard',
    color: null,
    mentionable: false,
    createdByUserId: null,
    level,
    isSystem: false,
    version: `version-${id}`,
    directAssignmentCount: 0,
    permissionSchemaVersion: 1,
    permissionCodes,
    permissions: permissionCodes.map(permission),
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  }
}

function assignment(
  memberId: string,
  roleId: string,
): ServerMemberRoleResponse {
  return {
    id: `${memberId}:${roleId}`,
    serverId: 'server-1',
    memberId,
    roleId,
    roleTitle: roleId,
    assignedAt: '2026-08-01T00:00:00Z',
    revokedAt: null,
  }
}

function member({
  id,
  userId,
  roleIds = [],
  permissionCodes = [],
  isOwner = false,
}: {
  id: string
  userId: string
  roleIds?: string[]
  permissionCodes?: string[]
  isOwner?: boolean
}): ServerMemberDetailsResponse {
  return {
    id,
    serverId: 'server-1',
    userId,
    statusCode: 'active',
    isOwner,
    joinedAt: '2026-08-01T00:00:00Z',
    leftAt: null,
    addedByUserId: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    permissionCodes,
    roleAssignments: roleIds.map((roleId) => assignment(id, roleId)),
    user: {
      id: userId,
      login: userId,
      displayName: userId,
      avatarAssetId: null,
      avatarCropOffsetX: 0,
      avatarCropOffsetY: 0,
      avatarCropZoom: 1,
    },
  }
}

function participant(userId: string): VoiceParticipant {
  return {
    participantId: `session:${userId}`,
    userId,
    login: userId,
    displayName: userId,
    isMuted: false,
    isDeafened: false,
    isCameraEnabled: false,
    isScreenSharing: false,
    joinedAt: '2026-08-01T00:00:00Z',
  }
}

const actorRole = role('actor-role', 10, ['manage_roles'])
const targetRole = role('target-role', 20)
const protectedRole = role('protected-role', 5)
const assignableRole = role('assignable-role', 30)
const roles = [actorRole, targetRole, protectedRole, assignableRole]
const actor = member({
  id: 'actor-member',
  userId: 'actor-user',
  roleIds: ['actor-role'],
  permissionCodes: ['manage_roles'],
})
const target = member({
  id: 'target-member',
  userId: 'target-user',
  roleIds: ['target-role'],
})

function options(
  overrides: Partial<
    Parameters<typeof buildVoiceParticipantContextMenuItems>[0]
  > = {},
): Parameters<typeof buildVoiceParticipantContextMenuItems>[0] {
  return {
    participant: participant(target.userId),
    member: target,
    currentUserId: actor.userId,
    currentMember: actor,
    serverRoles: roles,
    audioSettings: { volume: 1, isMuted: false },
    friendUserIds: new Set<string>(),
    pendingOutgoingUserIds: new Set<string>(),
    inviteServers: [],
    moveTargets: [{ id: 'voice-2', title: 'Войс 2' }],
    canAssignRoles: true,
    canBanMembers: true,
    canDeafenVoiceMembers: true,
    canDisconnectVoiceMembers: true,
    canKickMembers: true,
    canManageServer: false,
    canMoveVoiceMembers: true,
    canMuteVoiceMembers: true,
    isOwner: false,
    isMutatingFriends: false,
    isMutatingGovernance: false,
    isMutatingServerMember: false,
    isMutatingDirectMessageBlock: false,
    isUserBlockStatusResolved: true,
    isUserBlocked: false,
    onSelectMember: () => undefined,
    onMentionUser: () => undefined,
    onOpenDirectSpace: () => undefined,
    onSendFriendRequest: () => undefined,
    onRemoveFriend: () => undefined,
    onToggleUserBlock: () => undefined,
    onCreateDirectInvite: () => undefined,
    onAssignServerRole: () => undefined,
    onMoveParticipant: () => undefined,
    onSetServerMuted: () => undefined,
    onSetServerDeafened: () => undefined,
    onDisconnectVoiceParticipant: () => undefined,
    onRemoveServerMember: () => undefined,
    onBanServerMember: () => undefined,
    onChangeAudioSettings: () => undefined,
    onCopyUserId: () => undefined,
    ...overrides,
  }
}

function labels(items: readonly ContextMenuItem[]): string[] {
  return items.flatMap((item) => {
    if (item.type === 'separator') return []
    if (item.type === 'item' && item.submenu) {
      return [item.label, ...labels(item.submenu)]
    }
    return [item.label]
  })
}

function topLevelLabels(
  items: readonly ContextMenuItem[],
) {
  return items.flatMap((item) => item.type === 'separator' ? [] : [item.label])
}

function findItem(
  items: readonly ContextMenuItem[],
  label: string,
): Extract<ContextMenuItem, { type: 'item' }> | undefined {
  for (const item of items) {
    if (item.type !== 'item') continue
    if (item.label === label) return item
    if (item.submenu) {
      const nestedItem = findItem(item.submenu, label)
      if (nestedItem) return nestedItem
    }
  }

  return undefined
}

test.describe('voice participant context menu', () => {
  test('keeps the self menu limited to meaningful actions', () => {
    const self = participant(actor.userId)
    const items = buildVoiceParticipantContextMenuItems(options({
      participant: self,
      member: actor,
    }))

    expect(labels(items)).toEqual(['Профиль', 'Копировать ID пользователя'])
    expect(items.some((item) => item.type === 'range')).toBe(false)
    expect(items[0]?.type).not.toBe('separator')
    expect(items.at(-1)?.type).not.toBe('separator')
  })

  test('exposes persistent 0-200 percent playback controls for another user', () => {
    const patches: Array<{
      volume?: number
      isMuted?: boolean
      isVideoHidden?: boolean
    }> = []
    const items = buildVoiceParticipantContextMenuItems(options({
      participant: {
        ...participant(target.userId),
        isCameraEnabled: true,
      },
      audioSettings: { volume: 1.35, isMuted: true },
      onChangeAudioSettings: (patch) => patches.push(patch),
    }))
    const volume = items.find((item) => item.type === 'range')
    const localMute = items.find(
      (item) => item.type === 'item' && item.label === 'Заглушить локально',
    )
    const hideVideo = items.find(
      (item) =>
        item.type === 'item' &&
        item.label === voiceCopy.participantMenu.hideVideo,
    )

    expect(volume?.type).toBe('range')
    if (volume?.type === 'range') {
      expect(volume.min).toBe(0)
      expect(volume.max).toBe(200)
      expect(volume.value).toBe(135)
      volume.onChange(175)
    }
    expect(localMute?.type).toBe('item')
    if (localMute?.type === 'item') {
      expect(localMute.selected).toBe(true)
      localMute.onSelect?.()
    }
    expect(hideVideo?.type).toBe('item')
    if (hideVideo?.type === 'item') {
      expect(hideVideo.selected).toBe(false)
      hideVideo.onSelect?.()
    }
    expect(patches).toEqual([
      { volume: 1.75 },
      { isMuted: false },
      { isVideoHidden: true },
    ])
  })

  test('shows role, move, kick and ban only for a lower hierarchy target', () => {
    const allowedItems = buildVoiceParticipantContextMenuItems(options())
    const allowedLabels = labels(allowedItems)
    const allowedTopLevelLabels = topLevelLabels(allowedItems)

    expect(allowedTopLevelLabels).toContain(
      voiceCopy.participantMenu.serverManagement,
    )
    expect(allowedTopLevelLabels).not.toContain('Выдать роль')
    expect(allowedTopLevelLabels).not.toContain('Бан на сервере')
    expect(allowedLabels).toContain('Выдать роль')
    expect(allowedLabels).toContain('Переместить в голосовой спейс')
    expect(allowedLabels).toContain('Бан на сервере')
    expect(allowedLabels).toContain('Выгнать')

    const protectedTarget = member({
      id: 'protected-member',
      userId: 'protected-user',
      roleIds: ['protected-role'],
    })
    const protectedLabels = labels(buildVoiceParticipantContextMenuItems(
      options({
        participant: participant(protectedTarget.userId),
        member: protectedTarget,
      }),
    ))

    expect(protectedLabels).not.toContain('Выдать роль')
    expect(protectedLabels).not.toContain('Переместить в голосовой спейс')
    expect(protectedLabels).not.toContain('Бан на сервере')
    expect(protectedLabels).not.toContain('Выгнать')
    expect(protectedLabels).toContain('Заблокировать')
  })

  test('omits unresolved or unavailable moderation actions instead of disabling them', () => {
    const items = buildVoiceParticipantContextMenuItems(options({
      member: null,
      isUserBlockStatusResolved: false,
      isMutatingGovernance: true,
      isMutatingServerMember: true,
    }))
    const itemLabels = labels(items)

    expect(itemLabels).not.toContain('Проверяем блокировку…')
    expect(itemLabels).not.toContain('Заблокировать')
    expect(itemLabels).not.toContain('Выдать роль')
    expect(itemLabels).not.toContain('Переместить в голосовой спейс')
    expect(itemLabels).not.toContain('Бан на сервере')
    expect(itemLabels).toContain('Написать сообщение')
    expect(itemLabels).toContain('Копировать ID пользователя')
    expect(items.some(
      (item, index) =>
        item.type === 'separator' && items[index + 1]?.type === 'separator',
    )).toBe(false)
  })

  test('shows server voice moderation only with permission and lower hierarchy', () => {
    const updates: Array<{ kind: 'mute' | 'deafen'; value: boolean }> = []
    const items = buildVoiceParticipantContextMenuItems(options({
      participant: {
        ...participant(target.userId),
        isServerMuted: true,
        isServerDeafened: false,
      },
      onSetServerMuted: (value) => updates.push({ kind: 'mute', value }),
      onSetServerDeafened: (value) => updates.push({ kind: 'deafen', value }),
    }))
    const mute = findItem(items, voiceCopy.participantMenu.serverMute)
    const deafen = findItem(items, voiceCopy.participantMenu.serverDeafen)

    expect(mute?.type).toBe('item')
    expect(deafen?.type).toBe('item')
    if (mute?.type === 'item' && deafen?.type === 'item') {
      expect(mute.selected).toBe(true)
      expect(deafen.selected).toBe(false)
      mute.onSelect?.()
      deafen.onSelect?.()
    }
    expect(updates).toEqual([
      { kind: 'mute', value: false },
      { kind: 'deafen', value: true },
    ])

    const withoutPermission = labels(buildVoiceParticipantContextMenuItems(
      options({
        canDeafenVoiceMembers: false,
        canMuteVoiceMembers: false,
      }),
    ))
    expect(withoutPermission).not.toContain(
      voiceCopy.participantMenu.serverMute,
    )
    expect(withoutPermission).not.toContain(
      voiceCopy.participantMenu.serverDeafen,
    )

    const protectedTarget = member({
      id: 'protected-member',
      userId: 'protected-user',
      roleIds: ['protected-role'],
    })
    const protectedLabels = labels(buildVoiceParticipantContextMenuItems(
      options({
        participant: participant(protectedTarget.userId),
        member: protectedTarget,
      }),
    ))
    expect(protectedLabels).not.toContain(
      voiceCopy.participantMenu.serverMute,
    )
    expect(protectedLabels).not.toContain(
      voiceCopy.participantMenu.serverDeafen,
    )
  })

  test('keeps voice moderation permissions independent and wires disconnect', () => {
    let disconnectCount = 0
    const items = buildVoiceParticipantContextMenuItems(options({
      canAssignRoles: false,
      canBanMembers: false,
      canDeafenVoiceMembers: false,
      canDisconnectVoiceMembers: true,
      canKickMembers: false,
      canMoveVoiceMembers: false,
      canMuteVoiceMembers: false,
      onDisconnectVoiceParticipant: () => {
        disconnectCount += 1
      },
    }))
    const itemLabels = labels(items)
    const disconnectItem = findItem(
      items,
      voiceCopy.participantMenu.disconnect,
    )

    expect(itemLabels).toContain(voiceCopy.participantMenu.disconnect)
    expect(itemLabels).not.toContain(voiceCopy.participantMenu.serverMute)
    expect(itemLabels).not.toContain(voiceCopy.participantMenu.serverDeafen)
    expect(itemLabels).not.toContain(voiceCopy.participantMenu.moveToSpace)
    expect(disconnectItem?.type).toBe('item')
    disconnectItem?.onSelect?.()
    expect(disconnectCount).toBe(1)
  })

  test('adds workspace-only participant window and video roster actions', () => {
    const calls: string[] = []
    const items = buildVoiceParticipantContextMenuItems(options({
      onOpenDetachedParticipant: () => calls.push('window'),
      showParticipantsWithoutVideo: false,
      onToggleParticipantsWithoutVideo: () => calls.push('roster'),
    }))
    const participantWindow = items.find(
      (item) =>
        item.type === 'item' &&
        item.label === voiceCopy.participantMenu.openInWindow,
    )
    const rosterToggle = items.find(
      (item) =>
        item.type === 'item' &&
        item.label === voiceCopy.detached.showParticipantsWithoutVideo,
    )

    expect(participantWindow?.type).toBe('item')
    expect(rosterToggle?.type).toBe('item')
    if (participantWindow?.type === 'item' && rosterToggle?.type === 'item') {
      expect(rosterToggle.selected).toBe(false)
      participantWindow.onSelect?.()
      rosterToggle.onSelect?.()
    }
    expect(calls).toEqual(['window', 'roster'])
  })
})
