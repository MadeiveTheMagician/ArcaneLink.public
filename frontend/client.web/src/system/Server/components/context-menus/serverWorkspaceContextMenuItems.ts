import type {
  ServerMemberDetailsResponse,
  ServerMemberResponse,
  ServerRoleResponse,
  SpaceResponse,
  SpaceTypeCode
} from '../../../../shared/types';
import type { ContextMenuItem } from '../../../shared/components/context-menu/ContextMenu';
import { serverCopy } from '../../../shared/copy';
import {
  canRemoveServerMember,
  getAssignableServerRoles
} from '../../utils/serverGovernanceCapabilities';

type BuildSpaceContextMenuItemsOptions = {
  space: SpaceResponse | null;
  spaces: SpaceResponse[];
  canManageSpace: boolean;
  isMutatingSpaces: boolean;
  maxCategoryDepth: number;
  onCreateSpace: (
    typeCode: SpaceTypeCode,
    parentSpaceId: string | null
  ) => void;
  onEditSpace: (space: SpaceResponse) => void;
  onDeleteSpace: (space: SpaceResponse) => void;
};

type BuildMemberContextMenuItemsOptions = {
  member: ServerMemberDetailsResponse;
  currentUserId: string;
  currentMember: ServerMemberDetailsResponse | null;
  canAssignRoles: boolean;
  canBanMembers: boolean;
  canKickMembers: boolean;
  canManageServer: boolean;
  isOwner: boolean;
  friendUserIds: Set<string>;
  pendingOutgoingUserIds: Set<string>;
  inviteServers: ServerMemberResponse[];
  serverRoles: ServerRoleResponse[];
  isMutatingFriends: boolean;
  isMutatingGovernance: boolean;
  isMutatingServerMember: boolean;
  isMutatingDirectMessageBlock: boolean;
  isUserBlockStatusResolved: boolean;
  isUserBlocked: boolean;
  onOpenMemberProfile: (member: ServerMemberDetailsResponse) => void;
  onOpenDirectSpace: (userId: string) => void;
  onSendFriendRequest: (userId: string) => void;
  onToggleUserBlock: (userId: string) => void;
  onCreateDirectInvite: (serverId: string, userId: string) => void;
  onAssignServerRole: (memberId: string, roleId: string) => void;
  onTransferOwnership: (member: ServerMemberDetailsResponse) => void;
  onRemoveServerMember: (member: ServerMemberDetailsResponse) => void;
  onBanServerMember: (member: ServerMemberDetailsResponse) => void;
};

export function buildSpaceContextMenuItems({
  space,
  spaces,
  canManageSpace,
  isMutatingSpaces,
  maxCategoryDepth,
  onCreateSpace,
  onEditSpace,
  onDeleteSpace
}: BuildSpaceContextMenuItemsOptions): ContextMenuItem[] {
  if (!canManageSpace) {
    return [];
  }

  const parentSpaceId =
    space?.typeCode === 'category' ? space.id : (space?.parentSpaceId ?? null);

  if (!space) {
    return buildCreateSpaceContextItems({
      parentSpaceId: null,
      spaces,
      isMutatingSpaces,
      maxCategoryDepth,
      onCreateSpace
    });
  }

  return [
    {
      type: 'item',
      label: `${serverCopy.contextMenu.settings} ${
        space.typeCode === 'category'
          ? serverCopy.contextMenu.category
          : serverCopy.contextMenu.space
      }`,
      icon: 'settings',
      onSelect: () => onEditSpace(space)
    },
    {
      type: 'item',
      label: `${serverCopy.contextMenu.delete} ${
        space.typeCode === 'category'
          ? serverCopy.contextMenu.category
          : serverCopy.contextMenu.space
      }`,
      icon: 'trash',
      danger: true,
      disabled: isMutatingSpaces,
      onSelect: () => onDeleteSpace(space)
    },
    ...(space.typeCode === 'category'
      ? ([
          { type: 'separator' },
          ...buildCreateSpaceContextItems({
            parentSpaceId,
            spaces,
            isMutatingSpaces,
            maxCategoryDepth,
            onCreateSpace
          })
        ] satisfies ContextMenuItem[])
      : [])
  ];
}

export function buildMemberContextMenuItems({
  member,
  currentUserId,
  currentMember,
  canAssignRoles,
  canBanMembers,
  canKickMembers,
  canManageServer,
  isOwner,
  friendUserIds,
  pendingOutgoingUserIds,
  inviteServers,
  serverRoles,
  isMutatingFriends,
  isMutatingGovernance,
  isMutatingServerMember,
  isMutatingDirectMessageBlock,
  isUserBlockStatusResolved,
  isUserBlocked,
  onOpenMemberProfile,
  onOpenDirectSpace,
  onSendFriendRequest,
  onToggleUserBlock,
  onCreateDirectInvite,
  onAssignServerRole,
  onTransferOwnership,
  onRemoveServerMember,
  onBanServerMember
}: BuildMemberContextMenuItemsOptions): ContextMenuItem[] {
  const isSelf = member.userId === currentUserId;
  const isGovernanceTarget = !member.isOwner && !isSelf;
  const assignableRoles = getAssignableServerRoles(
    serverRoles,
    currentMember,
    canManageServer,
    isOwner
  );
  const canAssignRole = canAssignRoles && isGovernanceTarget;
  const canTransferOwnership = isOwner && isGovernanceTarget;
  const canKickMember = canRemoveServerMember({
    member,
    currentMember,
    serverRoles,
    currentUserId,
    isOwner,
    canManageMembers: canKickMembers
  });
  const canBanMember = canRemoveServerMember({
    member,
    currentMember,
    serverRoles,
    currentUserId,
    isOwner,
    canManageMembers: canBanMembers
  });
  const isFriend = friendUserIds.has(member.userId);
  const hasPendingFriendRequest = pendingOutgoingUserIds.has(member.userId);
  const governanceItems: ContextMenuItem[] = [
    ...(canAssignRole
      ? ([
          {
            type: 'item',
            label: serverCopy.contextMenu.assignRole,
            icon: 'role',
            disabled: assignableRoles.length === 0 || isMutatingGovernance,
            submenu:
              assignableRoles.length > 0
                ? assignableRoles.map((role) => ({
                    type: 'item' as const,
                    label: role.title,
                    icon: 'role' as const,
                    disabled: isMutatingGovernance,
                    onSelect: () => onAssignServerRole(member.id, role.id)
                  }))
                : undefined
          }
        ] satisfies ContextMenuItem[])
      : []),
    ...(canTransferOwnership
      ? ([
          {
            type: 'item',
            label: serverCopy.contextMenu.transferOwnership,
            icon: 'role',
            disabled: isMutatingGovernance,
            onSelect: () => onTransferOwnership(member)
          }
        ] satisfies ContextMenuItem[])
      : []),
    ...(canBanMember
      ? ([
          {
            type: 'item',
            label: serverCopy.contextMenu.ban,
            icon: 'block',
            danger: true,
            disabled: isMutatingServerMember || isMutatingGovernance,
            onSelect: () => onBanServerMember(member)
          }
        ] satisfies ContextMenuItem[])
      : []),
    ...(canKickMember
      ? ([
          {
            type: 'item',
            label: serverCopy.contextMenu.kick,
            icon: 'trash',
            danger: true,
            disabled: isMutatingServerMember,
            onSelect: () => onRemoveServerMember(member)
          }
        ] satisfies ContextMenuItem[])
      : [])
  ];

  return [
    {
      type: 'item',
      label: serverCopy.contextMenu.profile,
      icon: 'profile',
      onSelect: () => onOpenMemberProfile(member)
    },
    {
      type: 'item',
      label: serverCopy.contextMenu.directMessage,
      icon: 'message',
      disabled: isSelf,
      onSelect: () => onOpenDirectSpace(member.userId)
    },
    {
      type: 'item',
      label: isFriend
        ? serverCopy.contextMenu.alreadyFriends
        : hasPendingFriendRequest
          ? serverCopy.contextMenu.pendingFriendRequest
          : serverCopy.contextMenu.addFriend,
      icon: 'friend',
      disabled:
        isSelf || isFriend || hasPendingFriendRequest || isMutatingFriends,
      onSelect: () => onSendFriendRequest(member.userId)
    },
    {
      type: 'item',
      label: serverCopy.contextMenu.inviteToServer,
      icon: 'invite',
      disabled: inviteServers.length === 0,
      submenu:
        inviteServers.length > 0
          ? inviteServers.map((membership) => ({
              type: 'item',
              label: membership.server.title,
              icon: 'invite',
              onSelect: () =>
                onCreateDirectInvite(membership.serverId, member.userId)
            }))
          : undefined
    },
    ...(!isSelf
      ? ([
          {
            type: 'item',
            label: !isUserBlockStatusResolved
              ? serverCopy.contextMenu.blockStatusLoading
              : isUserBlocked
                ? serverCopy.contextMenu.unblock
                : serverCopy.contextMenu.block,
            icon: 'block',
            disabled:
              isMutatingDirectMessageBlock || !isUserBlockStatusResolved,
            onSelect: () => onToggleUserBlock(member.userId)
          }
        ] satisfies ContextMenuItem[])
      : []),
    ...(governanceItems.length > 0
      ? ([
          { type: 'separator' },
          ...governanceItems
        ] satisfies ContextMenuItem[])
      : [])
  ];
}

function buildCreateSpaceContextItems({
  parentSpaceId,
  spaces,
  isMutatingSpaces,
  maxCategoryDepth,
  onCreateSpace
}: {
  parentSpaceId: string | null;
  spaces: SpaceResponse[];
  isMutatingSpaces: boolean;
  maxCategoryDepth: number;
  onCreateSpace: (
    typeCode: SpaceTypeCode,
    parentSpaceId: string | null
  ) => void;
}): ContextMenuItem[] {
  const parentDepth = parentSpaceId
    ? getCategoryDepth(parentSpaceId, spaces, maxCategoryDepth)
    : 0;
  const canCreateCategory = parentDepth < maxCategoryDepth;

  return [
    {
      type: 'item',
      label: canCreateCategory
        ? serverCopy.contextMenu.createCategory
        : serverCopy.contextMenu.nestingLimit,
      icon: 'space',
      disabled: isMutatingSpaces || !canCreateCategory,
      onSelect: () => onCreateSpace('category', parentSpaceId)
    },
    {
      type: 'item',
      label: serverCopy.contextMenu.createTextSpace,
      icon: 'message',
      disabled: isMutatingSpaces,
      onSelect: () => onCreateSpace('text_room', parentSpaceId)
    },
    {
      type: 'item',
      label: serverCopy.contextMenu.createVoiceSpace,
      icon: 'space',
      disabled: isMutatingSpaces,
      onSelect: () => onCreateSpace('voice_room', parentSpaceId)
    }
  ];
}

function getCategoryDepth(
  spaceId: string,
  spaces: SpaceResponse[],
  maxCategoryDepth: number
) {
  let depth = 0;
  let currentId: string | null = spaceId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      return maxCategoryDepth;
    }

    visited.add(currentId);

    const space = spaces.find((item) => item.id === currentId);

    if (!space || space.typeCode !== 'category') {
      return depth;
    }

    depth += 1;
    currentId = space.parentSpaceId;
  }

  return depth;
}
