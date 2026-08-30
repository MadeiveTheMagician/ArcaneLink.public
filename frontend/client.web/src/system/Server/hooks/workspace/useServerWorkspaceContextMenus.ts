import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState
} from 'react';

import { apiJson, apiNoContent } from '../../../../shared/api/api';
import type {
  CreateServerInviteRequest,
  DirectMessageBlockStatusResponse,
  DirectMessageBlockedUserResponse,
  ServerInviteResponse,
  ServerMemberDetailsResponse,
  ServerMemberResponse,
  ServerRoleResponse,
  SpaceResponse,
  SpaceTypeCode
} from '../../../../shared/types';
import {
  type UserBlockDialogTarget,
  dispatchUserBlockChanged,
  getUserBlockedNotice,
  isUserBlockChangedEvent,
  userBlockChangedEventName
} from '../../../shared';
import { serverCopy } from '../../../shared/copy';
import { useContextMenuDismiss } from '../../../shared/hooks/useContextMenuDismiss';
import type { VoiceUserAudioSettings } from '../../../shared/types/voicePlayback';
import {
  defaultVoiceUserAudioSettings,
  normalizeVoiceUserId
} from '../../../shared/voice/voicePlaybackPreferences';
import {
  buildMemberContextMenuItems,
  buildSpaceContextMenuItems
} from '../../components/context-menus/serverWorkspaceContextMenuItems';
import { buildVoiceParticipantContextMenuItems } from '../../components/context-menus/voiceParticipantContextMenuItems';
import { canManageSpace } from '../../utils/spaceCapabilities';
import type { VoiceParticipant } from '../voice/useVoiceChannel';

export type MemberContextMenuState = {
  x: number;
  y: number;
  member: ServerMemberDetailsResponse;
  focusTarget: HTMLElement | null;
};

export type SpaceContextMenuState = {
  x: number;
  y: number;
  space: SpaceResponse | null;
};

export type VoiceParticipantContextMenuState = {
  x: number;
  y: number;
  participant: VoiceParticipant;
  sourceSpaceId: string;
  focusTarget: HTMLElement | null;
  onOpenDetachedParticipant?: () => void;
  showParticipantsWithoutVideo?: boolean;
  onToggleParticipantsWithoutVideo?: () => void;
};

type UseServerWorkspaceContextMenusOptions = {
  accessToken: string;
  selectedServerMembership: ServerMemberResponse;
  serverMemberships: ServerMemberResponse[];
  userId: string;
  canInviteMembers: boolean;
  canAssignRoles: boolean;
  canBanMembers: boolean;
  canDeafenVoiceMembers: boolean;
  canDisconnectVoiceMembers: boolean;
  canKickMembers: boolean;
  canManageServer: boolean;
  canMoveVoiceMembers: boolean;
  canMuteVoiceMembers: boolean;
  currentMember: ServerMemberDetailsResponse | null;
  currentUserPermissionCodes: readonly string[];
  serverMembers: ServerMemberDetailsResponse[];
  onResolveServerMember: (member: ServerMemberDetailsResponse) => void;
  isOwner: boolean;
  friendUserIds: Set<string>;
  pendingOutgoingUserIds: Set<string>;
  serverRoles: ServerRoleResponse[];
  serverSpaces: SpaceResponse[];
  voiceAudioSettingsByUserId: Record<string, VoiceUserAudioSettings>;
  isMutatingSpaces: boolean;
  isMutatingFriends: boolean;
  isMutatingGovernance: boolean;
  isMutatingServerMember: boolean;
  maxCategoryDepth: number;
  onCreateServerInvite: (
    request?: CreateServerInviteRequest
  ) => Promise<ServerInviteResponse | null>;
  onCreateSpace: (
    typeCode: SpaceTypeCode,
    parentSpaceId: string | null
  ) => void;
  onEditSpace: (space: SpaceResponse) => void;
  onDeleteSpace: (space: SpaceResponse) => void;
  onOpenMemberProfile: (
    member: ServerMemberDetailsResponse,
    focusTarget?: HTMLElement | null
  ) => void;
  onOpenDirectSpace: (userId: string) => void;
  onStartDirectVoice: (user: { id: string; displayName: string }) => void;
  onSendFriendRequest: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onMentionVoiceParticipant?: (participant: VoiceParticipant) => void;
  onChangeVoiceAudioSettings: (
    userId: string,
    patch: Partial<VoiceUserAudioSettings>
  ) => void;
  onMoveVoiceParticipant: (
    sourceSpaceId: string,
    targetSpaceId: string,
    participantId: string
  ) => Promise<void>;
  onUpdateVoiceParticipantModeration: (request: {
    spaceId: string;
    participantId: string;
    isServerMuted?: boolean;
    isServerDeafened?: boolean;
  }) => Promise<boolean>;
  onDisconnectVoiceParticipant: (request: {
    spaceId: string;
    participantId: string;
  }) => Promise<boolean>;
  onAssignServerRole: (memberId: string, roleId: string) => void;
  onTransferOwnership: (member: ServerMemberDetailsResponse) => void;
  onRemoveServerMember: (member: ServerMemberDetailsResponse) => void;
  onBanServerMember: (member: ServerMemberDetailsResponse) => void;
};

export function useServerWorkspaceContextMenus({
  accessToken,
  selectedServerMembership,
  serverMemberships,
  userId,
  canInviteMembers,
  canAssignRoles,
  canBanMembers,
  canDeafenVoiceMembers,
  canDisconnectVoiceMembers,
  canKickMembers,
  canManageServer,
  canMoveVoiceMembers,
  canMuteVoiceMembers,
  currentMember,
  currentUserPermissionCodes,
  serverMembers,
  onResolveServerMember,
  isOwner,
  friendUserIds,
  pendingOutgoingUserIds,
  serverRoles,
  serverSpaces,
  voiceAudioSettingsByUserId,
  isMutatingSpaces,
  isMutatingFriends,
  isMutatingGovernance,
  isMutatingServerMember,
  maxCategoryDepth,
  onCreateServerInvite,
  onCreateSpace,
  onEditSpace,
  onDeleteSpace,
  onOpenMemberProfile,
  onOpenDirectSpace,
  onStartDirectVoice,
  onSendFriendRequest,
  onRemoveFriend,
  onMentionVoiceParticipant,
  onChangeVoiceAudioSettings,
  onMoveVoiceParticipant,
  onUpdateVoiceParticipantModeration,
  onDisconnectVoiceParticipant,
  onAssignServerRole,
  onTransferOwnership,
  onRemoveServerMember,
  onBanServerMember
}: UseServerWorkspaceContextMenusOptions) {
  const authorizationCurrentMember = currentMember
    ? {
        ...currentMember,
        permissionCodes: [...currentUserPermissionCodes]
      }
    : null;
  const [
    mutatingDirectMessageBlockUserId,
    setMutatingDirectMessageBlockUserId
  ] = useState<string | null>(null);
  const [blockStatusByUserId, setBlockStatusByUserId] = useState<
    Record<string, DirectMessageBlockStatusResponse>
  >({});
  const [userBlockDialogTarget, setUserBlockDialogTarget] =
    useState<UserBlockDialogTarget | null>(null);
  const [memberContextMenu, setMemberContextMenu] =
    useState<MemberContextMenuState | null>(null);
  const [spaceContextMenu, setSpaceContextMenu] =
    useState<SpaceContextMenuState | null>(null);
  const [voiceParticipantContextMenu, setVoiceParticipantContextMenu] =
    useState<VoiceParticipantContextMenuState | null>(null);
  const [resolvedVoiceMembersByUserId, setResolvedVoiceMembersByUserId] =
    useState<Record<string, ServerMemberDetailsResponse | null>>({});
  const loadingVoiceMemberKeysRef = useRef(new Set<string>());
  const voiceMemberServerIdRef = useRef(selectedServerMembership.serverId);

  useEffect(() => {
    voiceMemberServerIdRef.current = selectedServerMembership.serverId;
    loadingVoiceMemberKeysRef.current.clear();
    setResolvedVoiceMembersByUserId({});
  }, [selectedServerMembership.serverId]);

  useContextMenuDismiss(
    Boolean(
      memberContextMenu || spaceContextMenu || voiceParticipantContextMenu
    ),
    () => {
      setMemberContextMenu(null);
      setSpaceContextMenu(null);
      setVoiceParticipantContextMenu(null);
    }
  );

  useEffect(() => {
    function syncBlockChange(event: Event) {
      if (!isUserBlockChangedEvent(event)) return;

      setBlockStatusByUserId((current) => ({
        ...current,
        [event.detail.userId]: {
          userId: event.detail.userId,
          isBlocked: event.detail.isBlocked,
          comment: event.detail.comment,
          createdAt: event.detail.isBlocked
            ? (current[event.detail.userId]?.createdAt ??
              new Date().toISOString())
            : null
        }
      }));
    }

    window.addEventListener(userBlockChangedEventName, syncBlockChange);
    return () =>
      window.removeEventListener(userBlockChangedEventName, syncBlockChange);
  }, []);

  function openSpaceContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    space: SpaceResponse | null = null
  ) {
    const canManageTarget = space ? canManageSpace(space) : canManageServer;

    if (!canManageTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setMemberContextMenu(null);
    setVoiceParticipantContextMenu(null);
    setSpaceContextMenu({
      x: event.clientX,
      y: event.clientY,
      space
    });
  }

  function openMemberContextMenu(
    member: ServerMemberDetailsResponse,
    event: ReactMouseEvent<HTMLElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    setSpaceContextMenu(null);
    setVoiceParticipantContextMenu(null);
    setMemberContextMenu({
      x: event.clientX,
      y: event.clientY,
      member,
      focusTarget: event.currentTarget
    });

    if (member.userId !== userId) {
      void loadUserBlockStatus(member.userId);
    }
  }

  function openVoiceParticipantContextMenu(
    participant: VoiceParticipant,
    sourceSpaceId: string,
    event: ReactMouseEvent<HTMLElement>,
    workspaceActions?: {
      onOpenDetachedParticipant?: () => void;
      showParticipantsWithoutVideo?: boolean;
      onToggleParticipantsWithoutVideo?: () => void;
    }
  ) {
    event.preventDefault();
    event.stopPropagation();
    const anchor = resolveContextMenuAnchor(event);

    setMemberContextMenu(null);
    setSpaceContextMenu(null);
    setVoiceParticipantContextMenu({
      ...anchor,
      participant,
      sourceSpaceId,
      focusTarget: event.currentTarget,
      onOpenDetachedParticipant: workspaceActions?.onOpenDetachedParticipant,
      showParticipantsWithoutVideo:
        workspaceActions?.showParticipantsWithoutVideo,
      onToggleParticipantsWithoutVideo:
        workspaceActions?.onToggleParticipantsWithoutVideo
    });

    if (participant.userId !== userId) {
      void loadUserBlockStatus(participant.userId);
    }

    if (!serverMembers.some((member) => member.userId === participant.userId)) {
      void loadVoiceParticipantMember(participant.userId);
    }
  }

  function getSpaceContextItems() {
    if (!spaceContextMenu) {
      return [];
    }

    const selectedSpace = spaceContextMenu.space
      ? (serverSpaces.find(
          (space) => space.id === spaceContextMenu.space?.id
        ) ?? spaceContextMenu.space)
      : null;
    const canManageTarget = selectedSpace
      ? canManageSpace(selectedSpace)
      : canManageServer;

    return buildSpaceContextMenuItems({
      space: selectedSpace,
      spaces: serverSpaces,
      canManageSpace: canManageTarget,
      isMutatingSpaces,
      maxCategoryDepth,
      onCreateSpace,
      onEditSpace,
      onDeleteSpace
    });
  }

  function getMemberContextItems() {
    if (!memberContextMenu) {
      return [];
    }

    const { member } = memberContextMenu;
    const blockStatus = blockStatusByUserId[member.userId];

    return buildMemberContextMenuItems({
      member,
      currentUserId: userId,
      currentMember: authorizationCurrentMember,
      canAssignRoles,
      canBanMembers,
      canKickMembers,
      canManageServer,
      isOwner,
      friendUserIds,
      pendingOutgoingUserIds,
      inviteServers: getInviteTargetServers(member),
      serverRoles,
      isMutatingFriends,
      isMutatingGovernance,
      isMutatingServerMember,
      isMutatingDirectMessageBlock: mutatingDirectMessageBlockUserId != null,
      isUserBlockStatusResolved: blockStatus != null,
      isUserBlocked: blockStatus?.isBlocked === true,
      onOpenMemberProfile: (targetMember) =>
        onOpenMemberProfile(targetMember, memberContextMenu.focusTarget),
      onOpenDirectSpace,
      onSendFriendRequest,
      onToggleUserBlock: (targetUserId) => {
        setMemberContextMenu(null);
        if (blockStatus?.isBlocked) {
          void unblockUser(targetUserId, member.user.displayName);
          return;
        }

        setUserBlockDialogTarget({
          userId: targetUserId,
          displayName: member.user.displayName,
          login: member.user.login
        });
      },
      onCreateDirectInvite: (serverId, targetUserId) => {
        void createDirectInviteForServer(serverId, targetUserId);
      },
      onAssignServerRole,
      onTransferOwnership,
      onRemoveServerMember,
      onBanServerMember
    });
  }

  function getVoiceParticipantContextItems() {
    if (!voiceParticipantContextMenu) {
      return [];
    }

    const {
      participant,
      sourceSpaceId,
      focusTarget,
      onOpenDetachedParticipant,
      showParticipantsWithoutVideo,
      onToggleParticipantsWithoutVideo
    } = voiceParticipantContextMenu;
    const member =
      serverMembers.find(
        (candidate) => candidate.userId === participant.userId
      ) ??
      resolvedVoiceMembersByUserId[participant.userId] ??
      null;
    const blockStatus = blockStatusByUserId[participant.userId];
    const sourceSpace = serverSpaces.find(
      (space) => space.id === sourceSpaceId
    );
    const moveTargets =
      canMoveVoiceMembers && sourceSpace?.effectiveCapabilities.canConnectVoice
        ? serverSpaces
            .filter(
              (space) =>
                space.id !== sourceSpaceId &&
                space.typeCode === 'voice_room' &&
                space.deletedAt == null &&
                space.effectiveCapabilities.canConnectVoice
            )
            .map((space) => ({ id: space.id, title: space.title }))
        : [];
    const normalizedUserId = normalizeVoiceUserId(participant.userId);
    const audioSettings =
      voiceAudioSettingsByUserId[normalizedUserId] ??
      defaultVoiceUserAudioSettings;

    return buildVoiceParticipantContextMenuItems({
      participant,
      member,
      currentUserId: userId,
      currentMember: authorizationCurrentMember,
      serverRoles,
      audioSettings,
      friendUserIds,
      pendingOutgoingUserIds,
      inviteServers: member ? getInviteTargetServers(member) : [],
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
      isMutatingDirectMessageBlock: mutatingDirectMessageBlockUserId != null,
      isUserBlockStatusResolved: blockStatus != null,
      isUserBlocked: blockStatus?.isBlocked === true,
      onOpenMemberProfile: member
        ? (targetMember) => onOpenMemberProfile(targetMember, focusTarget)
        : undefined,
      onMentionUser: onMentionVoiceParticipant,
      onOpenDirectSpace,
      onStartCall: () =>
        onStartDirectVoice({
          id: participant.userId,
          displayName: participant.displayName
        }),
      onSendFriendRequest,
      onRemoveFriend,
      onToggleUserBlock: () => {
        setVoiceParticipantContextMenu(null);
        if (blockStatus?.isBlocked) {
          void unblockUser(participant.userId, participant.displayName);
          return;
        }

        setUserBlockDialogTarget({
          userId: participant.userId,
          displayName: participant.displayName,
          login: participant.login
        });
      },
      onCreateDirectInvite: (serverId, targetUserId) => {
        void createDirectInviteForServer(serverId, targetUserId);
      },
      onAssignServerRole,
      onMoveParticipant: (targetSpaceId) => {
        void onMoveVoiceParticipant(
          sourceSpaceId,
          targetSpaceId,
          participant.participantId
        );
      },
      onSetServerMuted: (isServerMuted) => {
        void onUpdateVoiceParticipantModeration({
          spaceId: sourceSpaceId,
          participantId: participant.participantId,
          isServerMuted
        });
      },
      onSetServerDeafened: (isServerDeafened) => {
        void onUpdateVoiceParticipantModeration({
          spaceId: sourceSpaceId,
          participantId: participant.participantId,
          isServerDeafened
        });
      },
      onDisconnectVoiceParticipant: () => {
        void onDisconnectVoiceParticipant({
          spaceId: sourceSpaceId,
          participantId: participant.participantId
        });
      },
      onRemoveServerMember,
      onBanServerMember,
      onChangeAudioSettings: (patch) =>
        onChangeVoiceAudioSettings(participant.userId, patch),
      onCopyUserId: copyUserId,
      onOpenDetachedParticipant,
      showParticipantsWithoutVideo,
      onToggleParticipantsWithoutVideo
    });
  }

  async function createDirectInviteForServer(
    serverId: string,
    targetUserId: string
  ) {
    if (serverId === selectedServerMembership.serverId) {
      await onCreateServerInvite({
        kindCode: 'direct',
        targetUserId
      });
      return;
    }

    await apiJson<ServerInviteResponse>(`/api/servers/${serverId}/invites`, {
      method: 'POST',
      accessToken,
      body: {
        kindCode: 'direct',
        targetUserId
      }
    });
  }

  async function loadUserBlockStatus(targetUserId: string) {
    try {
      const status = await apiJson<DirectMessageBlockStatusResponse>(
        `/api/users/me/direct-message-blocks/${targetUserId}`,
        { accessToken }
      );
      setBlockStatusByUserId((current) => ({
        ...current,
        [targetUserId]: status
      }));
    } catch {
      // The menu remains usable with the safe default action.
    }
  }

  async function loadVoiceParticipantMember(targetUserId: string) {
    const serverId = selectedServerMembership.serverId;
    const requestKey = `${serverId}:${targetUserId}`;
    if (
      loadingVoiceMemberKeysRef.current.has(requestKey) ||
      Object.prototype.hasOwnProperty.call(
        resolvedVoiceMembersByUserId,
        targetUserId
      )
    ) {
      return;
    }

    loadingVoiceMemberKeysRef.current.add(requestKey);
    try {
      const member = await apiJson<ServerMemberDetailsResponse>(
        `/api/servers/${serverId}/members/by-user/${targetUserId}`,
        { accessToken }
      );
      if (voiceMemberServerIdRef.current !== serverId) return;

      setResolvedVoiceMembersByUserId((current) => ({
        ...current,
        [targetUserId]: member
      }));
      onResolveServerMember(member);
    } catch {
      if (voiceMemberServerIdRef.current !== serverId) return;

      setResolvedVoiceMembersByUserId((current) => ({
        ...current,
        [targetUserId]: null
      }));
    } finally {
      loadingVoiceMemberKeysRef.current.delete(requestKey);
    }
  }

  async function blockUser(
    target: UserBlockDialogTarget,
    comment: string | null
  ) {
    const targetUserId = target.userId;
    if (targetUserId === userId || mutatingDirectMessageBlockUserId != null) {
      return;
    }

    setMutatingDirectMessageBlockUserId(targetUserId);

    try {
      await apiJson<DirectMessageBlockedUserResponse>(
        `/api/users/me/direct-message-blocks/${targetUserId}`,
        {
          method: 'PUT',
          accessToken,
          body: { comment }
        }
      );
      setBlockStatusByUserId((current) => ({
        ...current,
        [targetUserId]: {
          userId: targetUserId,
          isBlocked: true,
          comment,
          createdAt: new Date().toISOString()
        }
      }));
      dispatchUserBlockChanged({
        userId: targetUserId,
        isBlocked: true,
        comment
      });
      setUserBlockDialogTarget(null);
      dispatchBlockNotification(
        `direct-message-blocked:${targetUserId}:${Date.now()}`,
        serverCopy.contextMenu.blockSuccessTitle,
        getUserBlockedNotice(target.displayName, comment),
        true
      );
    } catch {
      dispatchBlockNotification(
        `direct-message-block-failed:${targetUserId}:${Date.now()}`,
        serverCopy.contextMenu.blockFailedTitle,
        serverCopy.contextMenu.blockFailed,
        true
      );
    } finally {
      setMutatingDirectMessageBlockUserId(null);
    }
  }

  async function unblockUser(targetUserId: string, displayName: string) {
    if (targetUserId === userId || mutatingDirectMessageBlockUserId != null) {
      return;
    }

    setMutatingDirectMessageBlockUserId(targetUserId);

    try {
      await apiNoContent(
        `/api/users/me/direct-message-blocks/${targetUserId}`,
        { method: 'DELETE', accessToken }
      );
      setBlockStatusByUserId((current) => ({
        ...current,
        [targetUserId]: {
          userId: targetUserId,
          isBlocked: false,
          comment: null,
          createdAt: null
        }
      }));
      dispatchUserBlockChanged({
        userId: targetUserId,
        isBlocked: false,
        comment: null
      });
      dispatchBlockNotification(
        `direct-message-unblocked:${targetUserId}:${Date.now()}`,
        serverCopy.contextMenu.unblock,
        serverCopy.contextMenu.unblockSuccess(displayName),
        true
      );
    } catch {
      dispatchBlockNotification(
        `direct-message-unblock-failed:${targetUserId}:${Date.now()}`,
        serverCopy.contextMenu.unblock,
        serverCopy.contextMenu.unblockFailed,
        true
      );
    } finally {
      setMutatingDirectMessageBlockUserId(null);
    }
  }

  function getInviteTargetServers(member: ServerMemberDetailsResponse) {
    return serverMemberships.filter((membership) => {
      if (membership.serverId === selectedServerMembership.serverId) {
        return canInviteMembers && member.serverId !== membership.serverId;
      }

      return membership.server.ownerUserId === userId;
    });
  }

  return {
    closeMemberContextMenu: () => setMemberContextMenu(null),
    closeSpaceContextMenu: () => setSpaceContextMenu(null),
    getMemberContextItems,
    getSpaceContextItems,
    getVoiceParticipantContextItems,
    memberContextMenu,
    openMemberContextMenu,
    openSpaceContextMenu,
    openVoiceParticipantContextMenu,
    spaceContextMenu,
    voiceParticipantContextMenu,
    closeVoiceParticipantContextMenu: () =>
      setVoiceParticipantContextMenu(null),
    userBlockDialogTarget,
    closeUserBlockDialog: () => setUserBlockDialogTarget(null),
    confirmUserBlock: (comment: string | null) =>
      userBlockDialogTarget
        ? blockUser(userBlockDialogTarget, comment)
        : Promise.resolve(),
    isMutatingUserBlock:
      userBlockDialogTarget?.userId === mutatingDirectMessageBlockUserId
  };
}

function resolveContextMenuAnchor(event: ReactMouseEvent<HTMLElement>) {
  if (event.clientX > 0 || event.clientY > 0) {
    return { x: event.clientX, y: event.clientY };
  }

  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: bounds.left + 18, y: bounds.top + 18 };
}

function copyUserId(userId: string) {
  void navigator.clipboard?.writeText(userId);
}

function dispatchBlockNotification(
  id: string,
  title: string,
  body: string,
  force = false
) {
  window.dispatchEvent(
    new CustomEvent('arcanelink:system-notification', {
      detail: { id, title, body, force }
    })
  );
}
