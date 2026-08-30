import { type PointerEvent, useEffect, useId, useRef, useState } from 'react';

import type {
  CreateServerInviteRequest,
  CreateSpaceRequest,
  DeleteSpaceRequest,
  FriendUserResponse,
  MessageDisplayFormat,
  PermissionResponse,
  ReorderSpacesRequest,
  ServerAuditLogResponse,
  ServerBanResponse,
  ServerEffectivePermissionsResponse,
  ServerInviteResponse,
  ServerJoinRequestResponse,
  ServerMemberDetailsResponse,
  ServerMemberResponse,
  ServerResponse,
  ServerRoleResponse,
  SpacePermissionOverrideResponse,
  SpaceResponse,
  UpdateServerRequest,
  UpdateSpaceRequest,
  UpsertSpacePermissionOverrideRequest,
  UserFriendResponse,
  UserResponse
} from '../../../../shared/types';
import {
  UserBlockDialog,
  defaultMessageBubbleAlignment,
  defaultMessageBubbleWidth,
  serverCopy
} from '../../../shared';
import type {
  MessageBubbleAlignment,
  MessageBubbleWidth
} from '../../../shared';
import type { MessageFocusRequest } from '../../../shared/messages/messageFocusModel';
import {
  type VoicePlaybackState,
  type VoiceUserAudioSettings
} from '../../../shared/types/voicePlayback';
import { useSpaceMessages } from '../../hooks/messages/useSpaceMessages';
import type { VoiceChannelController } from '../../hooks/voice/useVoiceChannel';
import { useServerMemberProfileOverlay } from '../../hooks/workspace/useServerMemberProfileOverlay';
import { useServerSpaceDialogs } from '../../hooks/workspace/useServerSpaceDialogs';
import { useServerWorkspaceContextMenus } from '../../hooks/workspace/useServerWorkspaceContextMenus';
import { useServerWorkspaceNavigation } from '../../hooks/workspace/useServerWorkspaceNavigation';
import {
  type ServerCoreTab,
  toChannelDetail
} from '../../utils/serverWorkspaceModel';
import {
  canApplySpaceReorder,
  canManageAnySpace,
  canManageSpace,
  canSendMessagesToSpace
} from '../../utils/spaceCapabilities';
import { ServerChannelTree } from '../channel-tree/ServerChannelTree';
import { ServerChannelDetail } from '../detail/ServerChannelDetail';
import { ServerWorkspaceLayout } from '../layout/ServerWorkspaceLayout';
import {
  ServerMemberCompactProfile,
  ServerMemberFullProfile
} from '../member-profile/ServerMemberProfileSurfaces';
import type { MessageComposerMentionInsertionRequest } from '../messages/MessageComposer';
import { ServerWorkspaceOverlays } from '../overlays/ServerWorkspaceOverlays';
import {
  getActiveMessageSpaceId,
  getVoiceChatSpaceIdAfterSelection,
  isVoiceSpaceChatOpen,
  toggleVoiceChatSpaceId
} from '../voice/chat/voiceSpaceChatModel';
import { ServerMembersPanel } from './ServerWorkspaceSections';

const MAX_CATEGORY_DEPTH = 3;
type ServerWorkspaceProps = {
  accessToken: string;
  selectedServerMembership: ServerMemberResponse;
  serverMemberships: ServerMemberResponse[];
  user: UserResponse;
  serverMembers: ServerMemberDetailsResponse[];
  onResolveServerMember: (member: ServerMemberDetailsResponse) => void;
  serverInvites: ServerInviteResponse[];
  serverJoinRequests: ServerJoinRequestResponse[];
  serverJoinRequestTotalCount: number;
  serverJoinRequestError: string | null;
  hasMoreServerJoinRequests: boolean;
  serverRoles: ServerRoleResponse[];
  serverSpaces: SpaceResponse[];
  spacePermissions: PermissionResponse[];
  serverPermissions: PermissionResponse[];
  serverEffectivePermissions: ServerEffectivePermissionsResponse | null;
  serverAuditLogs: ServerAuditLogResponse[];
  serverBans: ServerBanResponse[];
  friends: UserFriendResponse[];
  friendUserIds: Set<string>;
  pendingOutgoingUserIds: Set<string>;
  serverCoreTab: ServerCoreTab;
  isMemberPanelCompact: boolean;
  isLoadingServerMembers: boolean;
  isLoadingMoreServerMembers: boolean;
  hasMoreServerMembers: boolean;
  serverMemberCount: number;
  isLoadingGovernance: boolean;
  isLoadingMoreServerJoinRequests: boolean;
  isLoadingSpaces: boolean;
  isMutatingServerMember: boolean;
  isMutatingGovernance: boolean;
  isMutatingSpaces: boolean;
  isMutatingFriends: boolean;
  defaultAttachmentExpanded: boolean;
  loadExternalMediaPreviews: boolean;
  horizontalVideoCardSize: number;
  verticalVideoCardSize: number;
  selectedThemeCode: string;
  profileColor: string | null;
  applySystemThemeToOtherProfiles: boolean;
  messageDisplayFormat?: MessageDisplayFormat;
  messageBubbleAlignment?: MessageBubbleAlignment;
  messageBubbleWidth?: MessageBubbleWidth;
  voiceAudioSettingsByUserId: Record<string, VoiceUserAudioSettings>;
  voicePlaybackStatesByParticipantId: Record<string, VoicePlaybackState>;
  onStartPaneResize: (
    pane: 'spaces' | 'members',
    event: PointerEvent<HTMLButtonElement>
  ) => void;
  onChangeVoiceAudioSettings: (
    participantId: string,
    patch: Partial<VoiceUserAudioSettings>
  ) => void;
  onOpenSettings: () => void;
  onOpenServerCoreTab: (tab: ServerCoreTab) => void;
  onLoadServerInvites: () => Promise<void>;
  onCreateServerInvite: (
    request?: CreateServerInviteRequest
  ) => Promise<ServerInviteResponse | null>;
  onUpdateServer: (
    request: UpdateServerRequest
  ) => Promise<ServerResponse | null>;
  onDeleteServer: () => Promise<void>;
  onRevokeServerInvite: (inviteId: string) => void;
  onLoadMoreServerJoinRequests: () => void;
  onApproveServerJoinRequest: (requestId: string) => void;
  onDeclineServerJoinRequest: (requestId: string) => void;
  onReloadServerRoles: () => Promise<readonly ServerRoleResponse[]>;
  onReloadServerMembers: () => Promise<void>;
  onCreateSpace: (request: CreateSpaceRequest) => Promise<SpaceResponse | null>;
  onUpdateSpace: (
    spaceId: string,
    request: UpdateSpaceRequest
  ) => Promise<SpaceResponse | null>;
  onDeleteSpace: (
    spaceId: string,
    request?: DeleteSpaceRequest
  ) => Promise<boolean>;
  onReorderSpaces: (request: ReorderSpacesRequest) => Promise<boolean>;
  onUpsertSpacePermissionOverride: (
    spaceId: string,
    request: UpsertSpacePermissionOverrideRequest
  ) => Promise<SpacePermissionOverrideResponse | null>;
  onDeleteSpacePermissionOverride: (
    spaceId: string,
    overrideId: string
  ) => Promise<boolean>;
  onRemoveServerMember: (member: ServerMemberDetailsResponse) => void;
  onLoadMoreServerMembers: () => Promise<boolean>;
  onBanServerMember: (
    member: ServerMemberDetailsResponse,
    reason: string
  ) => void;
  onUnbanServerMember: (memberId: string) => void;
  onTransferServerOwnership: (member: ServerMemberDetailsResponse) => void;
  onAssignServerRole: (memberId: string, roleId: string) => void;
  onSendFriendRequest: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onStartDirectVoice: (
    user: Pick<FriendUserResponse, 'id' | 'displayName'>
  ) => void;
  onOpenDirectSpace: (userId: string) => void;
  onCloseSettings: () => void;
  isSettingsOpen: boolean;
  voice: VoiceChannelController;
  externalMessageFocus?: MessageFocusRequest | null;
  onExternalMessageFocusConsumed?: () => void;
};

export function ServerWorkspace({
  accessToken,
  selectedServerMembership,
  serverMemberships,
  user,
  serverMembers,
  onResolveServerMember,
  serverInvites,
  serverJoinRequests,
  serverJoinRequestTotalCount,
  serverJoinRequestError,
  hasMoreServerJoinRequests,
  serverRoles,
  serverSpaces,
  spacePermissions,
  serverPermissions,
  serverEffectivePermissions,
  serverAuditLogs,
  serverBans,
  friends,
  friendUserIds,
  pendingOutgoingUserIds,
  serverCoreTab,
  isMemberPanelCompact,
  isLoadingServerMembers,
  isLoadingMoreServerMembers,
  hasMoreServerMembers,
  serverMemberCount,
  isLoadingGovernance,
  isLoadingMoreServerJoinRequests,
  isLoadingSpaces,
  isMutatingServerMember,
  isMutatingGovernance,
  isMutatingSpaces,
  isMutatingFriends,
  defaultAttachmentExpanded,
  loadExternalMediaPreviews,
  horizontalVideoCardSize,
  verticalVideoCardSize,
  selectedThemeCode,
  profileColor,
  applySystemThemeToOtherProfiles,
  messageDisplayFormat = 'wall-scroll',
  messageBubbleAlignment = defaultMessageBubbleAlignment,
  messageBubbleWidth = defaultMessageBubbleWidth,
  onStartPaneResize,
  onOpenSettings,
  onOpenServerCoreTab,
  onLoadServerInvites,
  onCreateServerInvite,
  onUpdateServer,
  onDeleteServer,
  onRevokeServerInvite,
  onLoadMoreServerJoinRequests,
  onApproveServerJoinRequest,
  onDeclineServerJoinRequest,
  onReloadServerRoles,
  onReloadServerMembers,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace,
  onReorderSpaces,
  onUpsertSpacePermissionOverride,
  onDeleteSpacePermissionOverride,
  onRemoveServerMember,
  onLoadMoreServerMembers,
  onBanServerMember,
  onUnbanServerMember,
  onTransferServerOwnership,
  onAssignServerRole,
  onSendFriendRequest,
  onRemoveFriend,
  onStartDirectVoice,
  onOpenDirectSpace,
  isSettingsOpen,
  onCloseSettings,
  voice,
  voiceAudioSettingsByUserId,
  voicePlaybackStatesByParticipantId,
  onChangeVoiceAudioSettings,
  externalMessageFocus,
  onExternalMessageFocusConsumed
}: ServerWorkspaceProps) {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isLoadingInviteDialog, setIsLoadingInviteDialog] = useState(false);
  const [inviteDialogLoadError, setInviteDialogLoadError] = useState<
    string | null
  >(null);
  const inviteDialogLoadVersionRef = useRef(0);
  const [pendingOwnershipTransfer, setPendingOwnershipTransfer] =
    useState<ServerMemberDetailsResponse | null>(null);
  const [voiceMentionRequest, setVoiceMentionRequest] =
    useState<MessageComposerMentionInsertionRequest | null>(null);
  const [openVoiceChatSpaceId, setOpenVoiceChatSpaceId] = useState<
    string | null
  >(null);
  const [isMembersPanelCollapsed, setIsMembersPanelCollapsed] = useState(false);
  const membersPanelId = useId();
  const [hasUnsavedRoleChanges, setHasUnsavedRoleChanges] = useState(false);

  function confirmDiscardRoleChanges() {
    return (
      !isSettingsOpen ||
      serverCoreTab !== 'roles' ||
      !hasUnsavedRoleChanges ||
      window.confirm(serverCopy.settings.unsavedRoleChanges)
    );
  }

  function requestCloseSettings() {
    if (!isSettingsOpen) {
      return true;
    }

    if (!confirmDiscardRoleChanges()) {
      return false;
    }

    setHasUnsavedRoleChanges(false);
    onCloseSettings();
    return true;
  }

  function requestOpenServerCoreTab(tab: ServerCoreTab) {
    if (
      isSettingsOpen &&
      tab !== serverCoreTab &&
      !confirmDiscardRoleChanges()
    ) {
      return;
    }

    setHasUnsavedRoleChanges(false);
    onOpenServerCoreTab(tab);
  }

  useEffect(() => {
    if (!isSettingsOpen) {
      setHasUnsavedRoleChanges(false);
    }
  }, [isSettingsOpen, selectedServerMembership.serverId]);

  const {
    activeDetail,
    canAssignRoles,
    canBanMembers,
    canDeafenVoiceMembers,
    canDisconnectVoiceMembers,
    canInviteMembers,
    canKickMembers,
    canManageBans,
    canManageInvites,
    canManageJoinRequests,
    canManageReports,
    canManageRoles,
    canManageServer,
    canManageServerProfile,
    canManageServerSettings,
    canOpenServerSettings,
    canMoveVoiceParticipants,
    canMuteVoiceMembers,
    canViewAuditLog,
    canViewInviteLog,
    canViewInvites,
    collapsedCategoryIds,
    currentMember,
    focusedMessage,
    hasSelectedDetail,
    isOwner,
    openSearchResult,
    rootSpaces,
    selectDetail,
    selectSpace,
    server,
    setActiveDetail,
    toggleCategory,
    visibleChannel,
    visibleDetail
  } = useServerWorkspaceNavigation({
    selectedServerMembership,
    user,
    serverMembers,
    serverSpaces,
    isLoadingSpaces,
    voice,
    onCloseSettings: requestCloseSettings,
    onOpenVoiceChat: setOpenVoiceChatSpaceId,
    effectivePermissions: serverEffectivePermissions,
    externalMessageFocus,
    onExternalMessageFocusConsumed
  });
  const memberProfile = useServerMemberProfileOverlay({
    accessToken,
    serverId: server.id
  });
  const memberProfileViewerTheme = {
    selectedThemeCode,
    profileColor,
    applySystemThemeToOtherProfiles
  };

  useEffect(() => {
    if (serverEffectivePermissions === null) {
      return;
    }

    if (!canInviteMembers && isInviteDialogOpen) {
      inviteDialogLoadVersionRef.current += 1;
      setIsInviteDialogOpen(false);
      setIsLoadingInviteDialog(false);
    }

    if (!canOpenServerSettings && isSettingsOpen) {
      setHasUnsavedRoleChanges(false);
      onCloseSettings();
    }
  }, [
    canInviteMembers,
    canOpenServerSettings,
    isInviteDialogOpen,
    isSettingsOpen,
    onCloseSettings,
    serverEffectivePermissions
  ]);
  const visibleMessageSpace = visibleChannel?.spaceId
    ? serverSpaces.find((space) => space.id === visibleChannel.spaceId)
    : undefined;
  const activeMessageSpaceId = getActiveMessageSpaceId(
    visibleChannel,
    visibleMessageSpace,
    openVoiceChatSpaceId
  );
  const activeMessagePermissionSpace = activeMessageSpaceId
    ? visibleMessageSpace
    : undefined;
  const canSendMessages = canSendMessagesToSpace(activeMessagePermissionSpace);
  const canManageMessages = canManageSpace(activeMessagePermissionSpace);
  const canManageSpaces = canManageServer || canManageAnySpace(serverSpaces);
  const {
    createSpaceDialog,
    deleteSpace,
    editSpaceDialog,
    openCreateSpaceDialog,
    openEditSpaceDialog,
    pendingDeleteSpace,
    setCreateSpaceDialog,
    setEditSpaceDialog,
    setPendingDeleteSpace,
    setSpaceDescriptionDraft,
    setSpaceTitleDraft,
    spaceDescriptionDraft,
    spaceTitleDraft,
    submitCreateSpace,
    submitEditSpace
  } = useServerSpaceDialogs({
    serverSpaces,
    activeDetail,
    onCreateSpace: (request) => {
      const parentSpace = request.parentSpaceId
        ? serverSpaces.find((space) => space.id === request.parentSpaceId)
        : null;
      const canCreateSpace = parentSpace
        ? canManageSpace(parentSpace)
        : canManageServer;

      return canCreateSpace ? onCreateSpace(request) : Promise.resolve(null);
    },
    onUpdateSpace: (spaceId, request) =>
      canManageSpace(serverSpaces.find((space) => space.id === spaceId))
        ? onUpdateSpace(spaceId, request)
        : Promise.resolve(null),
    onDeleteSpace: (spaceId, request) =>
      canManageSpace(serverSpaces.find((space) => space.id === spaceId))
        ? onDeleteSpace(spaceId, request)
        : Promise.resolve(false),
    onSelectDetail: selectDetail,
    onSetActiveDetail: setActiveDetail
  });
  const {
    closeMemberContextMenu,
    closeSpaceContextMenu,
    getMemberContextItems,
    getSpaceContextItems,
    getVoiceParticipantContextItems,
    memberContextMenu,
    openMemberContextMenu,
    openSpaceContextMenu,
    openVoiceParticipantContextMenu,
    spaceContextMenu,
    voiceParticipantContextMenu,
    closeVoiceParticipantContextMenu,
    userBlockDialogTarget,
    closeUserBlockDialog,
    confirmUserBlock,
    isMutatingUserBlock
  } = useServerWorkspaceContextMenus({
    accessToken,
    selectedServerMembership,
    serverMemberships,
    userId: user.id,
    canInviteMembers,
    canAssignRoles,
    canBanMembers,
    canDeafenVoiceMembers,
    canDisconnectVoiceMembers,
    canKickMembers,
    canManageServer,
    canMoveVoiceMembers: canMoveVoiceParticipants,
    canMuteVoiceMembers,
    currentMember,
    currentUserPermissionCodes:
      serverEffectivePermissions?.permissionCodes ?? [],
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
    maxCategoryDepth: MAX_CATEGORY_DEPTH,
    onCreateServerInvite,
    onCreateSpace: openCreateSpaceDialog,
    onEditSpace: openEditSpaceDialog,
    onDeleteSpace: setPendingDeleteSpace,
    onOpenMemberProfile: memberProfile.openFull,
    onOpenDirectSpace,
    onStartDirectVoice,
    onSendFriendRequest,
    onRemoveFriend,
    onMentionVoiceParticipant:
      activeMessageSpaceId && canSendMessages
        ? (participant) => {
            setVoiceMentionRequest({
              id: Date.now(),
              user: {
                id: participant.userId,
                login: participant.login,
                displayName: participant.displayName
              }
            });
          }
        : undefined,
    onChangeVoiceAudioSettings,
    onMoveVoiceParticipant: (sourceSpaceId, targetSpaceId, participantId) =>
      voice.moveVoiceParticipant(
        server.id,
        sourceSpaceId,
        targetSpaceId,
        participantId
      ),
    onUpdateVoiceParticipantModeration: (request) =>
      voice.updateVoiceParticipantModeration({
        serverId: server.id,
        ...request
      }),
    onDisconnectVoiceParticipant: (request) =>
      voice.disconnectVoiceParticipant({
        serverId: server.id,
        ...request
      }),
    onAssignServerRole,
    onTransferOwnership: setPendingOwnershipTransfer,
    onRemoveServerMember,
    onBanServerMember: (member) => {
      const reason = window.prompt(serverCopy.moderation.banReasonPrompt);

      if (reason?.trim()) {
        onBanServerMember(member, reason.trim());
      }
    }
  });
  const pinnedSpaceMessagePreview: string | null = null;
  const {
    messages,
    pinnedMessages,
    isLoadingMessages,
    isLoadingOlderMessages,
    hasOlderMessages,
    isLoadingPinnedMessages,
    isSendingMessage,
    messageError,
    mentionCandidates,
    loadMentionCandidates,
    loadMessageWindow,
    loadOlderMessages,
    sendMessage,
    updateMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    setMessageReaction,
    markMessagesRead
  } = useSpaceMessages(
    accessToken,
    selectedServerMembership,
    activeMessageSpaceId,
    focusedMessage,
    canSendMessages,
    canManageMessages
  );

  function selectSpaceAndCloseVoiceChat(space: SpaceResponse) {
    setOpenVoiceChatSpaceId(getVoiceChatSpaceIdAfterSelection(space, false));
    selectSpace(space);
  }

  function openVoiceSpaceChat(space: SpaceResponse) {
    setOpenVoiceChatSpaceId((current) =>
      toggleVoiceChatSpaceId(current, space)
    );
    selectDetail(toChannelDetail(space));
  }

  function openInviteDialog() {
    if (!canInviteMembers) {
      return;
    }

    const loadVersion = inviteDialogLoadVersionRef.current + 1;
    inviteDialogLoadVersionRef.current = loadVersion;
    setIsInviteDialogOpen(true);
    setInviteDialogLoadError(null);
    setIsLoadingInviteDialog(true);

    void onLoadServerInvites()
      .catch(() => {
        if (inviteDialogLoadVersionRef.current === loadVersion) {
          setInviteDialogLoadError(serverCopy.invites.loadFailed);
        }
      })
      .finally(() => {
        if (inviteDialogLoadVersionRef.current === loadVersion) {
          setIsLoadingInviteDialog(false);
        }
      });
  }

  function closeInviteDialog() {
    inviteDialogLoadVersionRef.current += 1;
    setIsInviteDialogOpen(false);
    setIsLoadingInviteDialog(false);
  }

  return (
    <>
      <ServerWorkspaceLayout
        hasSelectedDetail={hasSelectedDetail}
        isMembersPanelCollapsed={isMembersPanelCollapsed}
        visibleChannel={visibleChannel}
        visibleDetail={visibleDetail}
        pinnedSpaceMessagePreview={pinnedSpaceMessagePreview}
        onCloseDetail={() => selectDetail(null)}
        onStartPaneResize={onStartPaneResize}
        channelTree={
          <ServerChannelTree
            server={server}
            rootSpaces={rootSpaces}
            spaces={serverSpaces}
            visibleDetail={visibleDetail}
            selectedMemberId={memberProfile.overlay?.member.id ?? null}
            isLoadingSpaces={isLoadingSpaces}
            canInviteMembers={canInviteMembers}
            canOpenServerSettings={canOpenServerSettings}
            participantsBySpaceId={voice.participantsBySpaceId}
            audioSettingsByUserId={voiceAudioSettingsByUserId}
            serverMembers={serverMembers}
            serverMemberCount={serverMemberCount}
            isLoadingMoreMembers={isLoadingMoreServerMembers}
            hasMoreMembers={hasMoreServerMembers}
            onLoadMoreMembers={onLoadMoreServerMembers}
            speakingParticipantIds={voice.speakingParticipantIds}
            openVoiceChatSpaceId={
              isVoiceSpaceChatOpen(visibleChannel, openVoiceChatSpaceId)
                ? openVoiceChatSpaceId
                : null
            }
            collapsedCategoryIds={collapsedCategoryIds}
            onOpenInviteDialog={openInviteDialog}
            onOpenSettings={() => {
              if (canOpenServerSettings) {
                onOpenSettings();
              }
            }}
            onSelectOverview={() => selectDetail({ type: 'overview' })}
            onSelectMember={memberProfile.openCompact}
            onSelectSpace={selectSpaceAndCloseVoiceChat}
            onOpenVoiceChat={openVoiceSpaceChat}
            onToggleCategory={toggleCategory}
            onContextMenu={openSpaceContextMenu}
            canManageSpaces={canManageSpaces}
            canManageServer={canManageServer}
            onReorderSpaces={(request) =>
              canApplySpaceReorder(serverSpaces, request, canManageServer)
                ? onReorderSpaces(request)
                : Promise.resolve(false)
            }
            canMoveVoiceParticipants={canMoveVoiceParticipants}
            onMoveVoiceParticipant={(
              sourceSpaceId,
              targetSpaceId,
              participantId
            ) =>
              voice.moveVoiceParticipant(
                server.id,
                sourceSpaceId,
                targetSpaceId,
                participantId
              )
            }
            onOpenVoiceParticipantContextMenu={(
              event,
              participant,
              sourceSpaceId
            ) =>
              openVoiceParticipantContextMenu(participant, sourceSpaceId, event)
            }
          />
        }
        detail={
          <ServerChannelDetail
            accessToken={accessToken}
            server={server}
            user={user}
            visibleDetail={visibleDetail}
            visibleChannel={visibleChannel}
            canManageServer={canManageServer}
            serverMembers={serverMembers}
            serverMemberCount={serverMemberCount}
            serverRoles={serverRoles}
            serverSpaces={serverSpaces}
            voice={voice}
            isVoiceChatOpen={isVoiceSpaceChatOpen(
              visibleChannel,
              openVoiceChatSpaceId
            )}
            membersPanelId={membersPanelId}
            isMembersPanelCollapsed={isMembersPanelCollapsed}
            onToggleMembersPanel={() =>
              setIsMembersPanelCollapsed((current) => !current)
            }
            onToggleVoiceChat={(spaceId) =>
              setOpenVoiceChatSpaceId((current) =>
                current === spaceId
                  ? null
                  : serverSpaces.some(
                        (space) =>
                          space.id === spaceId &&
                          Boolean(space.voiceChatSpaceId)
                      )
                    ? spaceId
                    : null
              )
            }
            onCloseDetail={() => selectDetail(null)}
            voicePlaybackStatesByParticipantId={
              voicePlaybackStatesByParticipantId
            }
            voiceAudioSettingsByUserId={voiceAudioSettingsByUserId}
            messages={messages}
            pinnedMessages={pinnedMessages}
            isLoadingMessages={isLoadingMessages}
            isLoadingOlderMessages={isLoadingOlderMessages}
            hasOlderMessages={hasOlderMessages}
            isLoadingPinnedMessages={isLoadingPinnedMessages}
            isSendingMessage={isSendingMessage}
            messageError={messageError}
            mentionCandidates={mentionCandidates}
            mentionInsertionRequest={voiceMentionRequest}
            onMentionInsertionRequestHandled={(requestId) =>
              setVoiceMentionRequest((current) =>
                current?.id === requestId ? null : current
              )
            }
            onResolveMentionCandidates={loadMentionCandidates}
            defaultAttachmentExpanded={defaultAttachmentExpanded}
            loadExternalMediaPreviews={loadExternalMediaPreviews}
            horizontalVideoCardSize={horizontalVideoCardSize}
            verticalVideoCardSize={verticalVideoCardSize}
            messageDisplayFormat={messageDisplayFormat}
            messageBubbleAlignment={messageBubbleAlignment}
            messageBubbleWidth={messageBubbleWidth}
            onOpenVoiceParticipantContextMenu={(
              event,
              participant,
              sourceSpaceId,
              workspaceActions
            ) =>
              openVoiceParticipantContextMenu(
                participant,
                sourceSpaceId,
                event,
                workspaceActions
              )
            }
            onSendMessage={sendMessage}
            onUpdateMessage={updateMessage}
            onDeleteMessage={deleteMessage}
            onPinMessage={pinMessage}
            onUnpinMessage={unpinMessage}
            onSetMessageReaction={setMessageReaction}
            onMarkMessagesRead={markMessagesRead}
            onLoadMessageWindow={loadMessageWindow}
            onLoadOlderMessages={loadOlderMessages}
            focusedMessageId={
              focusedMessage?.spaceId === activeMessageSpaceId
                ? focusedMessage.messageId
                : null
            }
          />
        }
        membersPanel={
          <ServerMembersPanel
            accessToken={accessToken}
            id={membersPanelId}
            isCompact={isMemberPanelCompact}
            isLoading={isLoadingServerMembers}
            isLoadingMore={isLoadingMoreServerMembers}
            hasMore={hasMoreServerMembers}
            members={serverMembers}
            totalCount={serverMemberCount}
            serverId={server.id}
            spaces={serverSpaces}
            selectedMemberId={memberProfile.overlay?.member.id ?? null}
            onSelectMember={memberProfile.openCompact}
            onOpenMemberContextMenu={openMemberContextMenu}
            onOpenSearchResult={openSearchResult}
            onLoadMore={onLoadMoreServerMembers}
          />
        }
      />

      <ServerWorkspaceOverlays
        accessToken={accessToken}
        server={server}
        serverMembers={serverMembers}
        serverSpaces={serverSpaces}
        spacePermissions={spacePermissions}
        serverInvites={serverInvites}
        serverJoinRequests={serverJoinRequests}
        serverJoinRequestTotalCount={serverJoinRequestTotalCount}
        serverJoinRequestError={serverJoinRequestError}
        hasMoreServerJoinRequests={hasMoreServerJoinRequests}
        friends={friends}
        canInviteMembers={canInviteMembers}
        canViewInvites={canViewInvites}
        canViewInviteLog={canViewInviteLog}
        canManageJoinRequests={canManageJoinRequests}
        canManageBans={canManageBans}
        canManageInvites={canManageInvites}
        canManageRoles={canManageRoles}
        canManageServerProfile={canManageServerProfile}
        canManageServerSettings={canManageServerSettings}
        canDeleteServer={isOwner}
        canManageReports={canManageReports}
        canViewAuditLog={canViewAuditLog}
        currentUserPermissionCodes={
          serverEffectivePermissions?.permissionCodes ?? []
        }
        isInviteDialogOpen={isInviteDialogOpen && canInviteMembers}
        isLoadingInviteDialog={isLoadingInviteDialog}
        inviteDialogLoadError={inviteDialogLoadError}
        isLoadingGovernance={isLoadingGovernance}
        isLoadingMoreServerJoinRequests={isLoadingMoreServerJoinRequests}
        isMutatingGovernance={isMutatingGovernance}
        isMutatingSpaces={isMutatingSpaces}
        pendingOwnershipTransfer={pendingOwnershipTransfer}
        createSpaceDialog={createSpaceDialog}
        editSpaceDialog={editSpaceDialog}
        pendingDeleteSpace={pendingDeleteSpace}
        spaceTitleDraft={spaceTitleDraft}
        spaceDescriptionDraft={spaceDescriptionDraft}
        memberContextMenu={memberContextMenu}
        spaceContextMenu={spaceContextMenu}
        voiceParticipantContextMenu={voiceParticipantContextMenu}
        memberContextItems={getMemberContextItems()}
        spaceContextItems={getSpaceContextItems()}
        voiceParticipantContextItems={getVoiceParticipantContextItems()}
        isSettingsOpen={isSettingsOpen && canOpenServerSettings}
        serverCoreTab={serverCoreTab}
        serverRoles={serverRoles}
        serverPermissions={serverPermissions}
        serverAuditLogs={serverAuditLogs}
        serverBans={serverBans}
        onCreateServerInvite={onCreateServerInvite}
        onUpdateServer={onUpdateServer}
        onDeleteServer={onDeleteServer}
        onRevokeServerInvite={onRevokeServerInvite}
        onLoadMoreServerJoinRequests={onLoadMoreServerJoinRequests}
        onApproveServerJoinRequest={onApproveServerJoinRequest}
        onDeclineServerJoinRequest={onDeclineServerJoinRequest}
        onUnbanServerMember={onUnbanServerMember}
        onReloadServerRoles={onReloadServerRoles}
        onReloadServerMembers={onReloadServerMembers}
        onOpenServerCoreTab={requestOpenServerCoreTab}
        onCloseSettings={requestCloseSettings}
        onRoleDraftDirtyChange={setHasUnsavedRoleChanges}
        onCloseInviteDialog={closeInviteDialog}
        onCloseOwnershipTransfer={() => setPendingOwnershipTransfer(null)}
        onConfirmOwnershipTransfer={(member) => {
          setPendingOwnershipTransfer(null);
          onTransferServerOwnership(member);
        }}
        onCloseCreateSpaceDialog={() => setCreateSpaceDialog(null)}
        onCloseEditSpaceDialog={() => setEditSpaceDialog(null)}
        onCloseDeleteSpaceDialog={() => setPendingDeleteSpace(null)}
        onSetSpaceTitleDraft={setSpaceTitleDraft}
        onSetSpaceDescriptionDraft={setSpaceDescriptionDraft}
        onSubmitCreateSpace={() => void submitCreateSpace()}
        onSubmitEditSpace={() => void submitEditSpace()}
        onDeleteSpace={(space, action) => void deleteSpace(space, action)}
        onUpsertSpacePermissionOverride={onUpsertSpacePermissionOverride}
        onDeleteSpacePermissionOverride={onDeleteSpacePermissionOverride}
        onCloseMemberContextMenu={closeMemberContextMenu}
        onCloseSpaceContextMenu={closeSpaceContextMenu}
        onCloseVoiceParticipantContextMenu={closeVoiceParticipantContextMenu}
      />

      {userBlockDialogTarget && (
        <UserBlockDialog
          target={userBlockDialogTarget}
          isSubmitting={isMutatingUserBlock}
          onClose={closeUserBlockDialog}
          onConfirm={confirmUserBlock}
        />
      )}

      {memberProfile.overlay?.mode === 'compact' &&
        memberProfile.overlay.anchor && (
          <ServerMemberCompactProfile
            currentUserId={user.id}
            member={memberProfile.overlay.member}
            profile={memberProfile.profile}
            viewerTheme={memberProfileViewerTheme}
            anchor={memberProfile.overlay.anchor}
            isLoading={memberProfile.isLoading}
            error={memberProfile.error}
            onRetry={memberProfile.retry}
            onClose={memberProfile.close}
            onOpenFull={memberProfile.expandToFull}
          />
        )}

      {memberProfile.overlay?.mode === 'full' && (
        <ServerMemberFullProfile
          currentUserId={user.id}
          member={memberProfile.overlay.member}
          profile={memberProfile.profile}
          viewerTheme={memberProfileViewerTheme}
          isLoading={memberProfile.isLoading}
          error={memberProfile.error}
          onRetry={memberProfile.retry}
          onClose={memberProfile.close}
        />
      )}
    </>
  );
}
