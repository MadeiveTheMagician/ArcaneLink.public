import type {
  ServerMemberDetailsResponse,
  ServerMemberResponse,
  ServerRoleResponse,
} from '../../../../shared/types'
import type { VoiceUserAudioSettings } from '../../../shared/types/voicePlayback'
import {
  maximumVoiceParticipantVolumePercent,
  minimumVoiceParticipantVolumePercent,
  voiceParticipantVolumeFromPercent,
  voiceParticipantVolumePercentStep,
  voiceParticipantVolumeToPercent,
} from '../../../shared/voice/voiceParticipantVolume'
import type { ContextMenuItem } from '../../../shared/components/context-menu/ContextMenu'
import { serverCopy, voiceCopy } from '../../../shared/copy'
import type { VoiceParticipant } from '../../hooks/voice/useVoiceChannel'
import {
  canActOnServerMemberByHierarchy,
  canRemoveServerMember,
  getAssignableServerRoles,
} from '../../utils/serverGovernanceCapabilities'

export type VoiceMoveTarget = {
  id: string
  title: string
}

type BuildVoiceParticipantContextMenuItemsOptions = {
  participant: VoiceParticipant
  member: ServerMemberDetailsResponse | null
  currentUserId: string
  currentMember: ServerMemberDetailsResponse | null
  serverRoles: readonly ServerRoleResponse[]
  audioSettings: VoiceUserAudioSettings
  friendUserIds: ReadonlySet<string>
  pendingOutgoingUserIds: ReadonlySet<string>
  inviteServers: readonly ServerMemberResponse[]
  moveTargets: readonly VoiceMoveTarget[]
  canAssignRoles: boolean
  canBanMembers: boolean
  canDeafenVoiceMembers: boolean
  canDisconnectVoiceMembers: boolean
  canKickMembers: boolean
  canManageServer: boolean
  canMoveVoiceMembers: boolean
  canMuteVoiceMembers: boolean
  isOwner: boolean
  isMutatingFriends: boolean
  isMutatingGovernance: boolean
  isMutatingServerMember: boolean
  isMutatingDirectMessageBlock: boolean
  isUserBlockStatusResolved: boolean
  isUserBlocked: boolean
  onOpenMemberProfile?: (member: ServerMemberDetailsResponse) => void
  onMentionUser?: (participant: VoiceParticipant) => void
  onOpenDirectSpace: (userId: string) => void
  onStartCall?: () => void
  onSendFriendRequest: (userId: string) => void
  onRemoveFriend?: (userId: string) => void
  onToggleUserBlock: (userId: string) => void
  onCreateDirectInvite: (serverId: string, userId: string) => void
  onAssignServerRole: (memberId: string, roleId: string) => void
  onMoveParticipant: (targetSpaceId: string) => void
  onSetServerMuted: (isServerMuted: boolean) => void
  onSetServerDeafened: (isServerDeafened: boolean) => void
  onDisconnectVoiceParticipant: () => void
  onRemoveServerMember: (member: ServerMemberDetailsResponse) => void
  onBanServerMember: (member: ServerMemberDetailsResponse) => void
  onChangeAudioSettings: (patch: Partial<VoiceUserAudioSettings>) => void
  onCopyUserId: (userId: string) => void
  onOpenDetachedParticipant?: () => void
  showParticipantsWithoutVideo?: boolean
  onToggleParticipantsWithoutVideo?: () => void
}

export function buildVoiceParticipantContextMenuItems({
  participant,
  member,
  currentUserId,
  currentMember,
  serverRoles,
  audioSettings,
  friendUserIds,
  pendingOutgoingUserIds,
  inviteServers,
  moveTargets,
  canAssignRoles,
  canBanMembers,
  canDeafenVoiceMembers,
  canDisconnectVoiceMembers,
  canKickMembers,
  canManageServer,
  canMoveVoiceMembers,
  canMuteVoiceMembers,
  isOwner,
  isMutatingFriends,
  isMutatingGovernance,
  isMutatingServerMember,
  isMutatingDirectMessageBlock,
  isUserBlockStatusResolved,
  isUserBlocked,
  onOpenMemberProfile,
  onMentionUser,
  onOpenDirectSpace,
  onStartCall,
  onSendFriendRequest,
  onRemoveFriend,
  onToggleUserBlock,
  onCreateDirectInvite,
  onAssignServerRole,
  onMoveParticipant,
  onSetServerMuted,
  onSetServerDeafened,
  onDisconnectVoiceParticipant,
  onRemoveServerMember,
  onBanServerMember,
  onChangeAudioSettings,
  onCopyUserId,
  onOpenDetachedParticipant,
  showParticipantsWithoutVideo,
  onToggleParticipantsWithoutVideo,
}: BuildVoiceParticipantContextMenuItemsOptions): ContextMenuItem[] {
  const isSelf = participant.userId === currentUserId
  const isFriend = friendUserIds.has(participant.userId)
  const hasPendingFriendRequest = pendingOutgoingUserIds.has(participant.userId)
  const canActOnMember = member
    ? canActOnServerMemberByHierarchy({
        member,
        currentMember,
        serverRoles,
        currentUserId,
        isOwner,
      })
    : false
  const assignableRoles = getAssignableServerRoles(
    serverRoles,
    currentMember,
    canManageServer,
    isOwner,
  )
  const canKickMember = member
    ? canRemoveServerMember({
        member,
        currentMember,
        serverRoles,
        currentUserId,
        isOwner,
        canManageMembers: canKickMembers,
      })
    : false
  const canBanMember = member
    ? canRemoveServerMember({
        member,
        currentMember,
        serverRoles,
        currentUserId,
        isOwner,
        canManageMembers: canBanMembers,
      })
    : false
  const identityItems: ContextMenuItem[] = [
    ...(member && onOpenMemberProfile
      ? ([{
          type: 'item',
          label: serverCopy.contextMenu.profile,
          icon: 'profile',
          onSelect: () => onOpenMemberProfile(member),
        }] satisfies ContextMenuItem[])
      : []),
    ...(!isSelf && onMentionUser
      ? ([{
          type: 'item',
          label: voiceCopy.participantMenu.mention,
          icon: 'message',
          onSelect: () => onMentionUser(participant),
        }] satisfies ContextMenuItem[])
      : []),
    ...(!isSelf
      ? ([{
          type: 'item',
          label: serverCopy.contextMenu.directMessage,
          icon: 'message',
          onSelect: () => onOpenDirectSpace(participant.userId),
        }] satisfies ContextMenuItem[])
      : []),
    ...(!isSelf && onStartCall
      ? ([{
          type: 'item',
          label: voiceCopy.participantMenu.startCall,
          icon: 'call',
          onSelect: onStartCall,
        }] satisfies ContextMenuItem[])
      : []),
  ]
  const audioItems: ContextMenuItem[] = isSelf
    ? []
    : [
        {
          type: 'range',
          label: voiceCopy.participantMenu.volume,
          icon: 'audio',
          min: minimumVoiceParticipantVolumePercent,
          max: maximumVoiceParticipantVolumePercent,
          step: voiceParticipantVolumePercentStep,
          value: voiceParticipantVolumeToPercent(audioSettings.volume),
          valueLabel: `${voiceParticipantVolumeToPercent(audioSettings.volume)}%`,
          onChange: (volumePercent) =>
            onChangeAudioSettings({
              volume: voiceParticipantVolumeFromPercent(volumePercent),
            }),
        },
        {
          type: 'item',
          label: voiceCopy.participantMenu.localMute,
          icon: 'audio',
          selected: audioSettings.isMuted,
          onSelect: () =>
            onChangeAudioSettings({ isMuted: !audioSettings.isMuted }),
        },
        ...(
          participant.isCameraEnabled || participant.isScreenSharing
            ? ([{
                type: 'item',
                label: voiceCopy.participantMenu.hideVideo,
                icon: 'video',
                selected: audioSettings.isVideoHidden === true,
                onSelect: () =>
                  onChangeAudioSettings({
                    isVideoHidden: audioSettings.isVideoHidden !== true,
                  }),
              }] satisfies ContextMenuItem[])
            : []
        ),
      ]
  const relationshipItems: ContextMenuItem[] = isSelf
    ? []
    : [
        ...(!isMutatingFriends && !hasPendingFriendRequest && !isFriend
          ? ([{
              type: 'item',
              label: serverCopy.contextMenu.addFriend,
              icon: 'friend',
              onSelect: () => onSendFriendRequest(participant.userId),
            }] satisfies ContextMenuItem[])
          : []),
        ...(!isMutatingFriends && isFriend && onRemoveFriend
          ? ([{
              type: 'item',
              label: serverCopy.contextMenu.removeFriend,
              icon: 'friend',
              onSelect: () => onRemoveFriend(participant.userId),
            }] satisfies ContextMenuItem[])
          : []),
        ...(inviteServers.length > 0
          ? ([{
              type: 'item',
              label: serverCopy.contextMenu.inviteToServer,
              icon: 'invite',
              submenu: inviteServers.map((membership) => ({
                type: 'item' as const,
                label: membership.server.title,
                icon: 'invite' as const,
                onSelect: () =>
                  onCreateDirectInvite(membership.serverId, participant.userId),
              })),
            }] satisfies ContextMenuItem[])
          : []),
        ...(!isMutatingDirectMessageBlock && isUserBlockStatusResolved
          ? ([{
              type: 'item',
              label: isUserBlocked
                ? serverCopy.contextMenu.unblock
                : serverCopy.contextMenu.block,
              icon: 'block',
              onSelect: () => onToggleUserBlock(participant.userId),
            }] satisfies ContextMenuItem[])
          : []),
      ]
  const governanceItems: ContextMenuItem[] = [
    ...(member && canActOnMember && canAssignRoles &&
    !isMutatingGovernance && assignableRoles.length > 0
      ? ([{
          type: 'item',
          label: serverCopy.contextMenu.assignRole,
          icon: 'role',
          submenu: assignableRoles.map((role) => ({
            type: 'item' as const,
            label: role.title,
            icon: 'role' as const,
            onSelect: () => onAssignServerRole(member.id, role.id),
          })),
        }] satisfies ContextMenuItem[])
      : []),
    ...(member && canActOnMember && canMoveVoiceMembers &&
    !isMutatingGovernance && moveTargets.length > 0
      ? ([{
          type: 'item',
          label: voiceCopy.participantMenu.moveToSpace,
          icon: 'space',
          submenu: moveTargets.map((space) => ({
            type: 'item' as const,
            label: space.title,
            icon: 'audio' as const,
            onSelect: () => onMoveParticipant(space.id),
          })),
        }] satisfies ContextMenuItem[])
      : []),
    ...(member && canActOnMember && canMuteVoiceMembers &&
    !isMutatingGovernance
      ? ([
          {
            type: 'item',
            label: voiceCopy.participantMenu.serverMute,
            icon: 'audio',
            danger: true,
            selected: participant.isServerMuted === true,
            onSelect: () =>
              onSetServerMuted(participant.isServerMuted !== true),
          },
        ] satisfies ContextMenuItem[])
      : []),
    ...(member && canActOnMember && canDeafenVoiceMembers &&
    !isMutatingGovernance
      ? ([
          {
            type: 'item',
            label: voiceCopy.participantMenu.serverDeafen,
            icon: 'audio',
            danger: true,
            selected: participant.isServerDeafened === true,
            onSelect: () =>
              onSetServerDeafened(participant.isServerDeafened !== true),
          },
        ] satisfies ContextMenuItem[])
      : []),
    ...(member && canActOnMember && canDisconnectVoiceMembers &&
    !isMutatingGovernance
      ? ([{
          type: 'item',
          label: voiceCopy.participantMenu.disconnect,
          icon: 'leave',
          danger: true,
          onSelect: onDisconnectVoiceParticipant,
        }] satisfies ContextMenuItem[])
      : []),
    ...(member && canBanMember && !isMutatingServerMember &&
    !isMutatingGovernance
      ? ([
          {
            type: 'item',
            label: serverCopy.contextMenu.ban,
            icon: 'block',
            danger: true,
            onSelect: () => onBanServerMember(member),
          },
        ] satisfies ContextMenuItem[])
      : []),
    ...(member && canKickMember && !isMutatingServerMember &&
    !isMutatingGovernance
      ? ([
          {
            type: 'item',
            label: serverCopy.contextMenu.kick,
            icon: 'trash',
            danger: true,
            onSelect: () => onRemoveServerMember(member),
          },
        ] satisfies ContextMenuItem[])
      : []),
  ]
  const serverManagementItems: ContextMenuItem[] = governanceItems.length > 0
    ? [{
        type: 'item',
        label: voiceCopy.participantMenu.serverManagement,
        icon: 'settings',
        submenu: governanceItems,
      }]
    : []
  const utilityItems: ContextMenuItem[] = [{
    type: 'item',
    label: voiceCopy.participantMenu.copyUserId,
    icon: 'copy',
    onSelect: () => onCopyUserId(participant.userId),
  }]
  const workspaceItems: ContextMenuItem[] = [
    ...(onOpenDetachedParticipant
      ? ([{
          type: 'item',
          label: voiceCopy.participantMenu.openInWindow,
          icon: 'video',
          onSelect: onOpenDetachedParticipant,
        }] satisfies ContextMenuItem[])
      : []),
    ...(onToggleParticipantsWithoutVideo
      ? ([{
          type: 'item',
          label: voiceCopy.detached.showParticipantsWithoutVideo,
          icon: 'profile',
          selected: showParticipantsWithoutVideo !== false,
          onSelect: onToggleParticipantsWithoutVideo,
        }] satisfies ContextMenuItem[])
      : []),
  ]

  return joinContextMenuSections([
    identityItems,
    audioItems,
    relationshipItems,
    serverManagementItems,
    workspaceItems,
    utilityItems,
  ])
}

function joinContextMenuSections(sections: readonly ContextMenuItem[][]) {
  return sections
    .filter((section) => section.length > 0)
    .flatMap((section, index) =>
      index === 0
        ? section
        : [{ type: 'separator' as const }, ...section],
    )
}
