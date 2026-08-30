import {
  type MouseEvent,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { apiJson } from '../../../../shared/api/api';
import { clearUserDataCache } from '../../../../shared/cache/clientCache';
import type {
  ProfileSession,
  ServerEffectivePermissionsResponse,
  ServerMemberResponse
} from '../../../../shared/types';
import { DEFAULT_SYSTEM_THEME_CODE } from '../../../../styles/systemThemes';
import { MobileHubNav } from '../../../Mobile/components/MobileHubNav';
import { MobileMenuTab } from '../../../Mobile/components/MobileMenuTab';
import { ProfileHeader } from '../../../Profile/components/page/ProfileHeader';
import { useProfileAvatar } from '../../../Profile/hooks/useProfileAvatar';
import { useProfileSettings } from '../../../Profile/hooks/useProfileSettings';
import { ServerRail } from '../../../Server/components/navigation/ServerRail';
import { useVoiceChannel } from '../../../Server/hooks/voice/useVoiceChannel';
import { useServerDialog } from '../../../Server/hooks/workspace/useServerDialog';
import { useServerGovernance } from '../../../Server/hooks/workspace/useServerGovernance';
import { useServerSpaces } from '../../../Server/hooks/workspace/useServerSpaces';
import { useServers } from '../../../Server/hooks/workspace/useServers';
import {
  canAccessServerSettings,
  resolveServerWorkspacePermissionCapabilities
} from '../../../Server/utils/serverEffectivePermissions';
import { rememberRecentServerDetail } from '../../../Server/utils/serverRecentSpace';
import {
  ContextMenu,
  ContextMenuPositioningLayer
} from '../../../shared/components/context-menu/ContextMenu';
import { SystemErrorBoundary } from '../../../shared/errors/SystemErrorBoundary';
import { usePanelResize } from '../../../shared/hooks/usePanelResize';
import type { MessageFocusRequest } from '../../../shared/messages/messageFocusModel';
import {
  type SystemSettingsNavigationRequest,
  subscribeToSystemSettingsNavigation
} from '../../../shared/navigation/systemSettingsNavigation';
import { WorkspaceTransitionSurface } from '../../../shared/ui/WorkspaceTransitionSurface';
import { buildHubProfileStyle } from '../../utils/hubProfileStyle';
import { buildServerContextMenuItems } from '../../utils/serverContextMenuItems';
import { openServerSettingsForMembership } from '../../utils/serverSettingsOpenModel';
import type { CommunityNavigationRequest } from '../community/communityTypes';
import { useFriends } from '../community/useFriends';
import { useHubDirectActions } from '../direct-messages/useHubDirectActions';
import { WebNotificationStack } from '../notifications/WebNotificationStack';
import type { NotificationTarget } from '../notifications/notificationNavigation';
import { useWebNotifications } from '../notifications/useWebNotifications';
import { PrivateCallNotificationStack } from '../private-space/PrivateCallNotificationStack';
import { usePrivateSpaces } from '../private-space/usePrivateSpaces';
import { useVoicePlaybackPreferences } from '../settings/useVoicePlaybackPreferences';
import { useHubServerActions } from '../utility/useHubServerActions';
import { useHubServerInvites } from '../utility/useHubServerInvites';
import { HubVoiceAudioSinks } from '../voice/HubVoiceAudioSinks';
import { HubVoiceDock } from '../voice/HubVoiceDock';
import { HubPageDialogs } from './HubPageDialogs';
import { HubWorkspacePane } from './HubWorkspacePane';
import { useCurrentHubUser } from './useCurrentHubUser';
import {
  useHubInitialLayout,
  useHubLayoutPersistence
} from './useHubLayoutPersistence';
import { useHubProfileLifecycle } from './useHubProfileLifecycle';
import { useHubRealtimeSync } from './useHubRealtimeSync';
import { useHubWorkspace } from './useHubWorkspace';
import { useHubWorkspaceRestore } from './useHubWorkspaceRestore';
import { useMobileBrowserHistory } from './useMobileBrowserHistory';
import { useMobileHubNavigation } from './useMobileHubNavigation';
import { resolveWorkspaceTransitionKey } from './workspaceTransitionModel';

import styles from './HubPage.module.css';

const ServerWorkspace = lazy(() =>
  import('../../../Server/components/shell/ServerWorkspace').then((module) => ({
    default: module.ServerWorkspace
  }))
);

type HubPageProps = {
  session: ProfileSession;
  onLogout: () => Promise<void>;
};

type AvatarSort = 'newest' | 'oldest';
const defaultProfileSettings = {
  interfaceScale: 1,
  fontScale: 1,
  serverInterfaceScale: 1,
  isServerRailPinned: false,
  showPrivateReadAllButton: true,
  serverMessageDisplayFormat: 'wall-scroll' as const,
  privateMessageDisplayFormat: 'wall-scroll' as const,
  serverMessageBubbleAlignment: 'own-right' as const,
  privateMessageBubbleAlignment: 'own-right' as const,
  serverMessageBubbleWidth: 'standard' as const,
  privateMessageBubbleWidth: 'standard' as const,
  expandMessageAttachmentsByDefault: false,
  loadExternalMediaPreviews: true,
  horizontalVideoCardSize: 3,
  verticalVideoCardSize: 3,
  selectedThemeCode: DEFAULT_SYSTEM_THEME_CODE,
  profileColor: null,
  profileBackgroundAssetId: null,
  applySystemThemeToOtherProfiles: true,
  directMessagePermission: 'everyone' as const,
  presenceVisibility: 'everyone' as const,
  showLastSeen: true,
  presenceMode: 'automatic' as const
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

export function HubPage({ session, onLogout }: HubPageProps) {
  const layoutCache = useHubInitialLayout(session.user.id);
  const initialProfileSettings = useMemo(
    () => ({
      ...session.profileSettings,
      ...(layoutCache?.profileSettings ?? {})
    }),
    [layoutCache?.profileSettings, session.profileSettings]
  );
  const { user, loadCurrentUser } = useCurrentHubUser(
    session.accessToken,
    session.user
  );
  const voice = useVoiceChannel(session.accessToken, session.user.id);
  const {
    audioSettingsByUserId: voiceAudioSettingsByUserId,
    playbackStatesByParticipantId: voicePlaybackStatesByParticipantId,
    updatePlaybackState: updateVoicePlaybackState,
    updateAudioSettings: updateVoiceAudioSettings
  } = useVoicePlaybackPreferences(session.user.id);
  const {
    profileSettings,
    settingsDraft,
    isProfileSettingsOpen,
    isSavingProfileSettings,
    setSettingsDraft,
    setIsProfileSettingsOpen,
    openProfileSettings,
    loadProfileSettings,
    persistProfileSettings
  } = useProfileSettings(session.accessToken, initialProfileSettings);
  const [systemSettingsNavigationRequest, setSystemSettingsNavigationRequest] =
    useState<SystemSettingsNavigationRequest | null>(null);
  const [serverContextSettingsAccess, setServerContextSettingsAccess] =
    useState<{
      serverId: string;
      canOpen: boolean | null;
    } | null>(null);

  useEffect(
    () =>
      subscribeToSystemSettingsNavigation((request) => {
        setSystemSettingsNavigationRequest(request);
        openProfileSettings();
      }),
    [openProfileSettings]
  );

  function closeProfileSettings() {
    setIsProfileSettingsOpen(false);
    setSystemSettingsNavigationRequest(null);
  }

  const [avatarSort, setAvatarSort] = useState<AvatarSort>('newest');
  const avatarState = useProfileAvatar({
    accessToken: session.accessToken,
    initialProfile: session.publicProfile,
    sort: avatarSort
  });
  const {
    publicProfile,
    avatarPicker,
    avatarSrc,
    avatarStyle,
    isAvatarMenuOpen,
    setIsAvatarMenuOpen,
    markBrokenAvatar,
    loadPublicProfile,
    showAvatarLibrary,
    openAvatarPicker,
    selectAvatarFile
  } = avatarState;
  const {
    serverMemberships,
    setServerMemberships,
    selectedServerMembership,
    serverMembers,
    setServerMembers,
    isLoadingServers,
    hasLoadedServers,
    isLoadingServerMembers,
    isLoadingMoreServerMembers,
    hasMoreServerMembers,
    serverMemberCount,
    isMutatingServerMember,
    loadServers,
    loadServerMembers,
    loadMoreServerMembers,
    leaveServer,
    deleteServer,
    removeServerMember,
    updateServerMembership,
    reorderServerMemberships
  } = useServers(session.accessToken, session.user.id);
  const {
    isServerPanelOpen,
    activeWorkspace,
    activeServerId,
    activePrivateSpaceId,
    focusedPrivateMessage,
    serverContextMenu,
    visibleServerMemberships,
    setIsServerPanelOpen,
    openServerWorkspace,
    openServerContextMenu,
    toggleServerPanel,
    showProfileWorkspace,
    showServersWorkspace,
    showFriendsWorkspace,
    showInvitesWorkspace,
    openPrivateSpace,
    openPrivateSearchResult,
    openPrivateMessage,
    closeServerContextMenu,
    leaveServerFromContextMenu
  } = useHubWorkspace({
    serverMemberships,
    loadServers,
    loadServerMembers,
    leaveServer,
    initialActiveWorkspace:
      layoutCache?.activeWorkspace === 'server' && !layoutCache.activeServerId
        ? 'profile'
        : layoutCache?.activeWorkspace,
    initialActivePrivateSpaceId: layoutCache?.activePrivateSpaceId,
    initialIsServerPanelOpen: layoutCache?.isServerPanelOpen,
    initialActiveServerId: layoutCache?.activeServerId
  });
  const [notificationMessageFocus, setNotificationMessageFocus] =
    useState<MessageFocusRequest | null>(null);
  const [communityNavigationRequest, setCommunityNavigationRequest] =
    useState<CommunityNavigationRequest | null>(null);
  const communityNavigationSequenceRef = useRef(0);
  const notificationNavigationSequenceRef = useRef(0);
  const {
    mobileTab,
    isMobilePageTransitioning,
    mobilePageTransitionDirection,
    isMobilePrivateChatClosing,
    openMobileServers,
    openMobileMessages,
    openMobileProfile,
    openMobilePrivateWorkspace,
    openMobileProfileWorkspace,
    openMobileMenu,
    closeMobilePrivateChat
  } = useMobileHubNavigation({
    activeWorkspace,
    initialTab: layoutCache?.mobileTab,
    showProfileWorkspace,
    showServersWorkspace
  });

  async function openNotificationTarget(target: NotificationTarget) {
    const navigationRequestId = ++notificationNavigationSequenceRef.current;

    if (target.kind === 'friend-requests') {
      communityNavigationSequenceRef.current += 1;
      setCommunityNavigationRequest({
        id: communityNavigationSequenceRef.current,
        tab: 'friends'
      });
      openMobileProfileWorkspace(showFriendsWorkspace);
      return;
    }

    const messageFocus: MessageFocusRequest = {
      spaceId: target.spaceId,
      messageId: target.messageId,
      createdAt: target.createdAt
    };
    if (target.kind === 'private-message') {
      openMobilePrivateWorkspace(() => openPrivateMessage(messageFocus));
      return;
    }

    const membership =
      serverMemberships.find((item) => item.serverId === target.serverId) ??
      (await loadServers())?.find((item) => item.serverId === target.serverId);
    if (
      !membership ||
      notificationNavigationSequenceRef.current !== navigationRequestId
    ) {
      return;
    }

    openMobileServers();
    setNotificationMessageFocus(messageFocus);
    await openServerWorkspace(membership);
  }
  useHubProfileLifecycle({
    isServerRailPinned: profileSettings.isServerRailPinned,
    selectedThemeCode: profileSettings.selectedThemeCode,
    setServerPanelOpen: setIsServerPanelOpen
  });
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    searchQuery,
    isLoadingFriends,
    isSearchingUsers,
    isMutatingFriends,
    friendNotice,
    pendingOutgoingUserIds,
    friendUserIds,
    setSearchQuery,
    loadFriends,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    removeFriend
  } = useFriends(session.accessToken, session.user.id);
  const {
    privateSpaces,
    isLoadingPrivateSpaces,
    isMutatingPrivateSpaces,
    loadPrivateSpaces,
    openDirectSpace,
    createPrivateSpace,
    closePrivateSpace,
    clearPrivateSpaceHistory,
    addPrivateSpaceMember,
    updatePersonalSettings,
    uploadPersonalAvatar,
    updateGroupSettings,
    markPrivateSpaceRead,
    markAllPrivateSpacesRead
  } = usePrivateSpaces(session.accessToken, session.user.id);
  const {
    pendingPrivateSpaceDroppedFiles,
    openDirectSpaceForUser,
    startDirectVoiceForUser,
    dropFilesToPrivateSpace,
    consumePendingPrivateSpaceDroppedFiles
  } = useHubDirectActions({
    friends,
    openDirectSpace,
    openPrivateSpace,
    joinVoiceChannel: voice.joinVoiceChannel,
    setFriendSearchQuery: setSearchQuery,
    showFriendsWorkspace
  });

  const {
    spacePanelWidth,
    memberPanelWidth,
    hubPanelWidth,
    isMemberPanelCompact,
    startPaneResize
  } = usePanelResize({
    initialSidePanelWidth: layoutCache?.panelWidths.sidePanelWidth,
    initialMemberPanelWidth: layoutCache?.panelWidths.memberPanelWidth
  });
  const {
    serverCoreTab,
    serverInvites,
    directServerInvites,
    serverRoles,
    serverPermissions,
    serverEffectivePermissions,
    serverAuditLogs,
    serverBans,
    serverJoinRequests,
    serverJoinRequestTotalCount,
    serverJoinRequestError,
    hasMoreServerJoinRequests,
    isLoadingMoreServerJoinRequests,
    isLoadingGovernance,
    isMutatingGovernance,
    loadServerGovernance,
    reloadServerRoles,
    loadDirectServerInvites,
    openServerCoreTab,
    selectServerCoreTab,
    createServerInvite,
    revokeServerInvite,
    loadMoreServerJoinRequests,
    approveServerJoinRequest,
    declineServerJoinRequest,
    assignServerRole,
    transferServerOwnership,
    banServerMember,
    unbanServerMember,
    acceptDirectServerInvite,
    declineDirectServerInvite
  } = useServerGovernance({
    accessToken: session.accessToken,
    currentUserId: user.id,
    selectedServerMembership,
    serverMembers,
    loadServers,
    loadServerMembers
  });
  const {
    isServerSettingsMenuOpen,
    openServerSettingsMenu,
    openServerSettingsMenuWithoutReload,
    closeServerSettingsMenu,
    updateServerSettings
  } = useHubServerActions({
    accessToken: session.accessToken,
    selectedServerMembership,
    serverCoreTab,
    loadServerGovernance,
    updateServerMembership
  });
  const { createDirectServerInviteForUser, loadInviteTargetServersForUser } =
    useHubServerInvites({
      accessToken: session.accessToken,
      loadDirectServerInvites
    });
  const {
    notifications: webNotifications,
    closingNotificationIds: closingWebNotificationIds,
    dismissNotification: dismissWebNotification,
    markStoredNotificationRead,
    placement: webNotificationPlacement,
    pauseNotifications: pauseWebNotifications,
    resumeNotifications: resumeWebNotifications
  } = useWebNotifications({
    accessToken: session.accessToken,
    currentUserId: user.id,
    activePrivateSpaceId:
      activeWorkspace === 'private-space' ? activePrivateSpaceId : null
  });
  const {
    serverSpaces,
    spacePermissions,
    isLoadingSpaces,
    isMutatingSpaces,
    loadServerSpaces,
    createSpace,
    updateSpace,
    deleteSpace,
    reorderSpaces,
    upsertSpacePermissionOverride,
    deleteSpacePermissionOverride
  } = useServerSpaces(session.accessToken, selectedServerMembership);
  const serverDialogState = useServerDialog({
    accessToken: session.accessToken,
    assetSort: avatarSort,
    loadServers,
    onContextMenuClose: closeServerContextMenu
  });
  const {
    isServerIconLibraryOpen,
    loadServerIconAssets,
    serverDialog,
    setServerDialog,
    openCreateServerDialog
  } = serverDialogState;

  async function openFullServerSettingsFromContext(
    membership: ServerMemberResponse
  ) {
    closeServerContextMenu();
    selectServerCoreTab('general');
    await openServerSettingsForMembership({
      membership,
      selectedServerId: selectedServerMembership?.serverId ?? null,
      selectServer: openServerWorkspace,
      openSettings: openServerSettingsMenuWithoutReload
    });
  }

  function openServerContextMenuWithPermissions(
    event: MouseEvent<HTMLButtonElement>,
    membership: ServerMemberResponse
  ) {
    openServerContextMenu(event, membership);

    if (membership.server.ownerUserId === user.id) {
      setServerContextSettingsAccess({
        serverId: membership.serverId,
        canOpen: true
      });
      return;
    }

    if (
      membership.serverId === selectedServerMembership?.serverId &&
      serverEffectivePermissions?.serverId === membership.serverId
    ) {
      setServerContextSettingsAccess({
        serverId: membership.serverId,
        canOpen: canAccessServerSettings(
          resolveServerWorkspacePermissionCapabilities(
            serverEffectivePermissions,
            false,
            membership.serverId
          )
        )
      });
      return;
    }

    const serverId = membership.serverId;
    setServerContextSettingsAccess({ serverId, canOpen: null });
    void apiJson<ServerEffectivePermissionsResponse>(
      `/api/servers/${serverId}/members/me/effective-permissions`,
      { accessToken: session.accessToken }
    )
      .then((effectivePermissions) => {
        setServerContextSettingsAccess((current) =>
          current?.serverId === serverId
            ? {
                serverId,
                canOpen: canAccessServerSettings(
                  resolveServerWorkspacePermissionCapabilities(
                    effectivePermissions,
                    false,
                    serverId
                  )
                )
              }
            : current
        );
      })
      .catch(() => {
        setServerContextSettingsAccess((current) =>
          current?.serverId === serverId
            ? { serverId, canOpen: false }
            : current
        );
      });
  }

  async function deleteSelectedServer() {
    const membership = selectedServerMembership;
    if (!membership || membership.server.ownerUserId !== user.id) {
      return;
    }

    await deleteServer(membership);
    closeServerSettingsMenu();
    showServersWorkspace();
  }

  useMobileBrowserHistory({
    tab: mobileTab,
    workspace: activeWorkspace,
    serverId: activeServerId,
    privateSpaceId: activePrivateSpaceId,
    overlay: isProfileSettingsOpen
      ? 'settings'
      : serverDialog?.mode === 'create'
        ? 'create-server'
        : null,
    serverMemberships,
    onOpenServers: openMobileServers,
    onOpenMessages: openMobileMessages,
    onOpenProfile: openMobileProfile,
    onOpenMenu: openMobileMenu,
    onOpenServer: (membership) => void openServerWorkspace(membership),
    onOpenPrivateSpace: openPrivateSpace,
    onOpenSettings: openProfileSettings,
    onCloseSettings: closeProfileSettings,
    onOpenCreateServer: openCreateServerDialog,
    onCloseCreateServer: () => setServerDialog(null)
  });

  useHubRealtimeSync({
    accessToken: session.accessToken,
    currentUserId: user.id,
    currentDeviceSessionId: session.deviceSessionId,
    selectedServerMembership,
    activeWorkspace,
    serverCoreTab,
    avatarLibraryIsOpen: avatarPicker.isLibraryOpen,
    serverIconLibraryIsOpen: isServerIconLibraryOpen,
    loadServers,
    loadServerMembers,
    loadServerGovernance,
    loadServerSpaces,
    loadPrivateSpaces,
    loadFriends,
    loadDirectServerInvites,
    loadPublicProfile,
    loadCurrentUser,
    loadProfileSettings,
    loadAvatarAssets: avatarPicker.loadAssets,
    loadServerIconAssets,
    onCurrentSessionRevoked: onLogout
  });

  useHubWorkspaceRestore({
    activeWorkspace,
    activeServerId,
    selectedServerMembership,
    serverMemberships,
    hasLoadedServers,
    loadServerMembers,
    showProfileWorkspace
  });

  useHubLayoutPersistence({
    userId: session.user.id,
    activeWorkspace,
    activeServerId,
    selectedServerId: selectedServerMembership?.serverId ?? null,
    activePrivateSpaceId,
    isServerPanelOpen,
    mobileTab,
    sidePanelWidth: hubPanelWidth,
    memberPanelWidth,
    profileSettings
  });

  const profileScaleStyle = buildHubProfileStyle({
    profileSettings,
    hubPanelWidth,
    spacePanelWidth,
    memberPanelWidth
  });
  const workspaceTransitionKey = resolveWorkspaceTransitionKey({
    activeWorkspace,
    activeServerId,
    activePrivateSpaceId
  });

  function logoutAndClearCachedData() {
    void clearUserDataCache(session.user.id);
    void onLogout();
  }

  const serverContextItems = buildServerContextMenuItems({
    membership: serverContextMenu?.membership ?? null,
    currentUserId: user.id,
    canOpenFullServerSettings:
      serverContextSettingsAccess?.serverId ===
        serverContextMenu?.membership.serverId &&
      serverContextSettingsAccess?.canOpen === true,
    onOpenServerSettings: (membership) =>
      void openFullServerSettingsFromContext(membership),
    onLeaveServer: leaveServerFromContextMenu
  });

  const connectedVoiceServerTitle = voice.connectedChannel
    ? (serverMemberships.find(
        (membership) => membership.serverId === voice.connectedChannel?.serverId
      )?.server.title ?? null)
    : null;
  const selectedServerVoiceParticipants = useMemo(() => {
    const voiceSpaceIds = new Set(
      serverSpaces
        .filter((space) => space.typeCode === 'voice_room')
        .map((space) => space.id)
    );
    const seenParticipantIds = new Set<string>();

    return Object.entries(voice.participantsBySpaceId).flatMap(
      ([spaceId, participants]) => {
        if (!voiceSpaceIds.has(spaceId)) return [];

        return participants.filter((participant) => {
          if (seenParticipantIds.has(participant.participantId)) return false;
          seenParticipantIds.add(participant.participantId);
          return true;
        });
      }
    );
  }, [serverSpaces, voice.participantsBySpaceId]);

  function openConnectedVoiceWorkspace() {
    const channel = voice.connectedChannel;
    if (!channel) return;

    if (channel.channelScope === 'private') {
      openMobilePrivateWorkspace(() => openPrivateSpace(channel.spaceId));
      return;
    }

    const membership = serverMemberships.find(
      (item) => item.serverId === channel.serverId
    );
    if (!membership || !channel.serverId) return;

    rememberRecentServerDetail(channel.serverId, {
      type: 'channel',
      kind: 'voice',
      spaceId: channel.spaceId,
      title: channel.title
    });
    openMobileServers();
    void openServerWorkspace(membership);
  }

  return (
    <main
      className={`${styles.page} profile-page is-mobile-tab-${mobileTab} ${
        activeWorkspace === 'server' ? 'is-server-mode' : ''
      } ${isServerPanelOpen ? 'is-bookmark-open' : ''} ${
        voice.connectedChannel ? 'is-voice-connected' : ''
      } ${activeWorkspace === 'private-space' ? 'is-private-space' : ''} ${
        isMobilePrivateChatClosing ? 'is-private-chat-closing' : ''
      } ${isMobilePageTransitioning ? styles.mobilePageTransitioning : ''} ${
        mobilePageTransitionDirection === 'left'
          ? styles.mobilePageTransitionLeft
          : mobilePageTransitionDirection === 'right'
            ? styles.mobilePageTransitionRight
            : ''
      }`}
      style={profileScaleStyle}
    >
      <ContextMenuPositioningLayer />
      <WebNotificationStack
        notifications={webNotifications}
        closingNotificationIds={closingWebNotificationIds}
        onDismiss={dismissWebNotification}
        onMarkStoredRead={markStoredNotificationRead}
        onOpenPrivateSpace={(spaceId) =>
          openMobilePrivateWorkspace(() => openPrivateSpace(spaceId))
        }
        onOpenTarget={(target) => void openNotificationTarget(target)}
        onAcceptInvite={acceptDirectServerInvite}
        onDeclineInvite={declineDirectServerInvite}
        onPause={pauseWebNotifications}
        onResume={resumeWebNotifications}
        placement={webNotificationPlacement}
        bottomOffsetPx={
          webNotificationPlacement === 'bottom-right'
            ? 24 + voice.incomingPrivateCalls.length * 174
            : 24
        }
      />
      <PrivateCallNotificationStack
        calls={voice.incomingPrivateCalls}
        currentUserId={user.id}
        privateSpaces={privateSpaces}
        onAccept={async (call, title) => {
          await voice.acceptPrivateCall({
            callId: call.callId,
            spaceId: call.spaceId,
            title
          });
          openMobilePrivateWorkspace(() => openPrivateSpace(call.spaceId));
        }}
        onDecline={(call) =>
          voice.declinePrivateCall(call.callId, call.spaceId)
        }
      />
      <ServerRail
        avatarSrc={avatarSrc}
        isOpen={isServerPanelOpen}
        isLoadingServers={isLoadingServers}
        memberships={serverMemberships}
        selectedServerId={selectedServerMembership?.serverId}
        selectedServerMembers={serverMembers}
        selectedServerVoiceParticipants={selectedServerVoiceParticipants}
        onOpenProfile={showProfileWorkspace}
        onOpenServer={(membership) => void openServerWorkspace(membership)}
        onOpenContextMenu={openServerContextMenuWithPermissions}
        onReorderServers={reorderServerMemberships}
        onCreateServer={openCreateServerDialog}
        onShowAllServers={showServersWorkspace}
        onShowFriends={showFriendsWorkspace}
        onShowInvites={showInvitesWorkspace}
      />
      <section
        className={`${styles.shell} profile-shell ${
          activeWorkspace === 'server'
            ? `is-server-workspace-shell ${styles.serverShell}`
            : ''
        } ${
          activeWorkspace !== 'server' ? 'is-hub-workspace-shell' : ''
        } ${activeWorkspace !== 'server' ? styles.hubShell : ''}`}
      >
        <WorkspaceTransitionSurface transitionKey={workspaceTransitionKey}>
          {activeWorkspace !== 'server' && (
            <ProfileHeader
              activeWorkspace={activeWorkspace}
              selectedServerMembership={selectedServerMembership}
              onToggleServers={toggleServerPanel}
              onOpenServerSettings={openServerSettingsMenu}
              onLogout={logoutAndClearCachedData}
            />
          )}

          {activeWorkspace !== 'server' && (
            <SystemErrorBoundary
              boundaryName="hub-workspace-shell"
              resetKeys={[activeWorkspace, activePrivateSpaceId]}
            >
              <HubWorkspacePane
                accessToken={session.accessToken}
                activeWorkspace={activeWorkspace}
                activePrivateSpaceId={activePrivateSpaceId}
                user={user}
                publicProfile={publicProfile}
                avatarSrc={avatarSrc}
                avatarStyle={avatarStyle}
                isAvatarDraftActive={Boolean(avatarPicker.draft)}
                isAvatarMenuOpen={isAvatarMenuOpen}
                avatarFileInputRef={avatarPicker.fileInputRef}
                privateSpaces={privateSpaces}
                friends={friends}
                friendUserIds={friendUserIds}
                directServerInvites={directServerInvites}
                visibleServerMemberships={visibleServerMemberships}
                incomingFriendRequests={incomingRequests}
                outgoingFriendRequests={outgoingRequests}
                friendSearchQuery={searchQuery}
                isLoadingPrivateSpaces={isLoadingPrivateSpaces}
                isMutatingPrivateSpaces={isMutatingPrivateSpaces}
                isLoadingFriends={isLoadingFriends}
                isSearchingUsers={isSearchingUsers}
                isMutatingFriends={isMutatingFriends}
                friendNotice={friendNotice}
                pendingOutgoingUserIds={pendingOutgoingUserIds}
                voice={voice}
                voiceAudioSettingsByUserId={voiceAudioSettingsByUserId}
                voicePlaybackStatesByParticipantId={
                  voicePlaybackStatesByParticipantId
                }
                isMemberPanelCompact={isMemberPanelCompact}
                defaultAttachmentExpanded={
                  profileSettings.expandMessageAttachmentsByDefault
                }
                loadExternalMediaPreviews={
                  profileSettings.loadExternalMediaPreviews
                }
                horizontalVideoCardSize={
                  profileSettings.horizontalVideoCardSize
                }
                verticalVideoCardSize={profileSettings.verticalVideoCardSize}
                privateMessageDisplayFormat={
                  profileSettings.privateMessageDisplayFormat
                }
                privateMessageBubbleAlignment={
                  profileSettings.privateMessageBubbleAlignment
                }
                privateMessageBubbleWidth={
                  profileSettings.privateMessageBubbleWidth
                }
                showPrivateReadAllButton={
                  profileSettings.showPrivateReadAllButton
                }
                pendingPrivateSpaceDroppedFiles={
                  pendingPrivateSpaceDroppedFiles
                }
                focusedPrivateMessage={focusedPrivateMessage}
                onToggleAvatarMenu={() =>
                  setIsAvatarMenuOpen((current) => !current)
                }
                onCloseAvatarMenu={() => setIsAvatarMenuOpen(false)}
                onOpenAvatarPicker={openAvatarPicker}
                onShowAvatarLibrary={showAvatarLibrary}
                onSelectAvatarFile={selectAvatarFile}
                onMarkBrokenAvatar={markBrokenAvatar}
                onOpenPrivateSpace={openPrivateSpace}
                onOpenPrivateSearchResult={openPrivateSearchResult}
                onDropFilesToPrivateSpace={dropFilesToPrivateSpace}
                onPendingPrivateSpaceDroppedFilesConsumed={
                  consumePendingPrivateSpaceDroppedFiles
                }
                onOpenDirectSpace={openDirectSpaceForUser}
                onCreatePrivateSpace={async (memberUserIds, title) => {
                  const space = await createPrivateSpace(memberUserIds, title);
                  if (space) openPrivateSpace(space.spaceId);
                  return space;
                }}
                onStartDirectVoice={startDirectVoiceForUser}
                onLoadInviteTargetServers={loadInviteTargetServersForUser}
                onClosePrivateSpace={async (spaceId) => {
                  await closePrivateSpace(spaceId);
                  if (activePrivateSpaceId === spaceId) {
                    showProfileWorkspace();
                  }
                }}
                onClearPrivateSpaceHistory={clearPrivateSpaceHistory}
                onAddPrivateSpaceMember={(spaceId, userId) => {
                  return addPrivateSpaceMember(spaceId, userId).then(
                    (space) => {
                      if (space) openPrivateSpace(space.spaceId);
                      return space;
                    }
                  );
                }}
                onUpdatePrivateSpacePersonalSettings={updatePersonalSettings}
                onUploadPrivateSpacePersonalAvatar={uploadPersonalAvatar}
                onUpdateGroupPrivateSpaceSettings={updateGroupSettings}
                onMarkPrivateSpaceRead={markPrivateSpaceRead}
                onMarkAllPrivateSpacesRead={markAllPrivateSpacesRead}
                onChangeVoiceAudioSettings={updateVoiceAudioSettings}
                onCreateDirectServerInvite={(serverId, targetUserId) =>
                  void createDirectServerInviteForUser(serverId, targetUserId)
                }
                onRemoveFriend={(userId) => void removeFriend(userId)}
                onCreateServer={openCreateServerDialog}
                onServerJoined={(membership) => {
                  setServerMemberships((current) => [
                    membership,
                    ...current.filter(
                      (item) => item.serverId !== membership.serverId
                    )
                  ]);
                  void openServerWorkspace(membership);
                }}
                onOpenServer={(membership) =>
                  void openServerWorkspace(membership)
                }
                onAcceptDirectServerInvite={(inviteId) =>
                  void acceptDirectServerInvite(inviteId)
                }
                onDeclineDirectServerInvite={(inviteId) =>
                  void declineDirectServerInvite(inviteId)
                }
                onOpenNotificationTarget={(target) =>
                  void openNotificationTarget(target)
                }
                communityNavigationRequest={communityNavigationRequest}
                onCommunityNavigationRequestConsumed={(requestId) =>
                  setCommunityNavigationRequest((current) =>
                    current?.id === requestId ? null : current
                  )
                }
                onFriendSearchQueryChange={setSearchQuery}
                onSendFriendRequest={(userId) => void sendFriendRequest(userId)}
                onAcceptFriendRequest={(requestId) =>
                  void acceptFriendRequest(requestId)
                }
                onDeclineFriendRequest={(requestId) =>
                  void declineFriendRequest(requestId)
                }
                onCancelFriendRequest={(requestId) =>
                  void cancelFriendRequest(requestId)
                }
                onStartHubResize={(event) => startPaneResize('hub', event)}
                onStartPrivateInfoResize={(event) =>
                  startPaneResize('members', event)
                }
                onReturnToDirectMessages={closeMobilePrivateChat}
                formatDate={formatDate}
              />
            </SystemErrorBoundary>
          )}
          {activeWorkspace === 'server' && selectedServerMembership && (
            <SystemErrorBoundary
              boundaryName="server-workspace"
              resetKeys={[selectedServerMembership.serverId]}
            >
              <Suspense fallback={null}>
                <ServerWorkspace
                  key={selectedServerMembership.serverId}
                  accessToken={session.accessToken}
                  selectedServerMembership={selectedServerMembership}
                  serverMemberships={serverMemberships}
                  user={user}
                  serverMembers={serverMembers}
                  onResolveServerMember={(member) =>
                    setServerMembers((current) => {
                      const existingIndex = current.findIndex(
                        (candidate) => candidate.id === member.id
                      );
                      if (existingIndex < 0) {
                        return [...current, member];
                      }

                      return current.map((candidate, index) =>
                        index === existingIndex ? member : candidate
                      );
                    })
                  }
                  friends={friends}
                  serverInvites={serverInvites}
                  serverRoles={serverRoles}
                  serverSpaces={serverSpaces}
                  spacePermissions={spacePermissions}
                  serverPermissions={serverPermissions}
                  serverEffectivePermissions={serverEffectivePermissions}
                  serverAuditLogs={serverAuditLogs}
                  serverBans={serverBans}
                  serverJoinRequests={serverJoinRequests}
                  serverJoinRequestTotalCount={serverJoinRequestTotalCount}
                  serverJoinRequestError={serverJoinRequestError}
                  hasMoreServerJoinRequests={hasMoreServerJoinRequests}
                  serverCoreTab={serverCoreTab}
                  friendUserIds={friendUserIds}
                  pendingOutgoingUserIds={pendingOutgoingUserIds}
                  isMemberPanelCompact={isMemberPanelCompact}
                  isLoadingServerMembers={isLoadingServerMembers}
                  isLoadingMoreServerMembers={isLoadingMoreServerMembers}
                  hasMoreServerMembers={hasMoreServerMembers}
                  serverMemberCount={serverMemberCount}
                  isLoadingGovernance={isLoadingGovernance}
                  isLoadingMoreServerJoinRequests={
                    isLoadingMoreServerJoinRequests
                  }
                  isLoadingSpaces={isLoadingSpaces}
                  isMutatingServerMember={isMutatingServerMember}
                  isMutatingGovernance={isMutatingGovernance}
                  isMutatingSpaces={isMutatingSpaces}
                  isMutatingFriends={isMutatingFriends}
                  defaultAttachmentExpanded={
                    profileSettings.expandMessageAttachmentsByDefault
                  }
                  loadExternalMediaPreviews={
                    profileSettings.loadExternalMediaPreviews
                  }
                  horizontalVideoCardSize={
                    profileSettings.horizontalVideoCardSize
                  }
                  verticalVideoCardSize={profileSettings.verticalVideoCardSize}
                  selectedThemeCode={profileSettings.selectedThemeCode}
                  profileColor={profileSettings.profileColor}
                  applySystemThemeToOtherProfiles={
                    profileSettings.applySystemThemeToOtherProfiles
                  }
                  messageDisplayFormat={
                    profileSettings.serverMessageDisplayFormat
                  }
                  messageBubbleAlignment={
                    profileSettings.serverMessageBubbleAlignment
                  }
                  messageBubbleWidth={profileSettings.serverMessageBubbleWidth}
                  isSettingsOpen={isServerSettingsMenuOpen}
                  voice={voice}
                  externalMessageFocus={notificationMessageFocus}
                  onExternalMessageFocusConsumed={() =>
                    setNotificationMessageFocus(null)
                  }
                  voiceAudioSettingsByUserId={voiceAudioSettingsByUserId}
                  voicePlaybackStatesByParticipantId={
                    voicePlaybackStatesByParticipantId
                  }
                  onStartPaneResize={startPaneResize}
                  onChangeVoiceAudioSettings={updateVoiceAudioSettings}
                  onOpenSettings={openServerSettingsMenu}
                  onOpenServerCoreTab={openServerCoreTab}
                  onLoadServerInvites={async () => {
                    await loadServerGovernance('invites');
                  }}
                  onCreateServerInvite={createServerInvite}
                  onUpdateServer={updateServerSettings}
                  onDeleteServer={deleteSelectedServer}
                  onRevokeServerInvite={(inviteId) =>
                    void revokeServerInvite(inviteId)
                  }
                  onLoadMoreServerJoinRequests={() =>
                    void loadMoreServerJoinRequests()
                  }
                  onApproveServerJoinRequest={(requestId) =>
                    void approveServerJoinRequest(requestId)
                  }
                  onDeclineServerJoinRequest={(requestId) =>
                    void declineServerJoinRequest(requestId)
                  }
                  onReloadServerRoles={() => reloadServerRoles(true)}
                  onReloadServerMembers={() =>
                    loadServerMembers(selectedServerMembership)
                  }
                  onCreateSpace={createSpace}
                  onUpdateSpace={updateSpace}
                  onDeleteSpace={deleteSpace}
                  onReorderSpaces={reorderSpaces}
                  onUpsertSpacePermissionOverride={
                    upsertSpacePermissionOverride
                  }
                  onDeleteSpacePermissionOverride={
                    deleteSpacePermissionOverride
                  }
                  onRemoveServerMember={(member) =>
                    void removeServerMember(member)
                  }
                  onLoadMoreServerMembers={loadMoreServerMembers}
                  onBanServerMember={(member, reason) =>
                    void banServerMember(member, reason)
                  }
                  onUnbanServerMember={(memberId) =>
                    void unbanServerMember(memberId)
                  }
                  onTransferServerOwnership={(member) =>
                    void transferServerOwnership(member)
                  }
                  onAssignServerRole={(memberId, roleId) =>
                    void assignServerRole(memberId, roleId)
                  }
                  onSendFriendRequest={(userId) =>
                    void sendFriendRequest(userId)
                  }
                  onRemoveFriend={(userId) => void removeFriend(userId)}
                  onStartDirectVoice={startDirectVoiceForUser}
                  onOpenDirectSpace={openDirectSpaceForUser}
                  onCloseSettings={closeServerSettingsMenu}
                />
              </Suspense>
            </SystemErrorBoundary>
          )}
        </WorkspaceTransitionSurface>
      </section>

      <HubVoiceDock
        avatarSrc={avatarSrc}
        isServerPanelOpen={isServerPanelOpen}
        isServerPanelPinned={profileSettings.isServerRailPinned}
        onOpenSettings={openProfileSettings}
        onOpenActiveVoiceSpace={openConnectedVoiceWorkspace}
        onToggleServerPanel={toggleServerPanel}
        serverTitle={connectedVoiceServerTitle}
        user={user}
        voice={voice}
      />
      <HubVoiceAudioSinks
        audioSettingsByUserId={voiceAudioSettingsByUserId}
        onPlaybackStateChange={updateVoicePlaybackState}
        voice={voice}
      />

      {mobileTab === 'menu' && (
        <div className={styles.mobileMenuSurface}>
          <MobileMenuTab onOpenSystemSettings={openProfileSettings} />
        </div>
      )}

      <MobileHubNav
        activeTab={mobileTab}
        messagesBadge={incomingRequests.length}
        onOpenServers={openMobileServers}
        onOpenMessages={openMobileMessages}
        onOpenProfile={openMobileProfile}
        onOpenMenu={openMobileMenu}
      />

      {serverContextMenu && (
        <ContextMenu
          x={serverContextMenu.x}
          y={serverContextMenu.y}
          items={serverContextItems}
          onClose={closeServerContextMenu}
        />
      )}

      <HubPageDialogs
        accessToken={session.accessToken}
        currentDeviceSessionId={session.deviceSessionId}
        user={user}
        serverMemberships={serverMemberships}
        avatarSort={avatarSort}
        defaultProfileSettings={defaultProfileSettings}
        settingsDraft={settingsDraft}
        settingsNavigationRequest={systemSettingsNavigationRequest}
        voiceDiagnostics={voice.connectionDiagnostics}
        voiceNoiseSuppressionTelemetry={voice.noiseSuppressionTelemetry}
        isProfileSettingsOpen={isProfileSettingsOpen}
        isSavingProfileSettings={isSavingProfileSettings}
        onProfileSettingsChange={setSettingsDraft}
        onProfileSettingsCommit={persistProfileSettings}
        onProfileIdentityChanged={async () => {
          await Promise.all([loadCurrentUser(), loadPublicProfile()]);
        }}
        onProfileSettingsClose={closeProfileSettings}
        onLogout={logoutAndClearCachedData}
        avatarState={avatarState}
        serverDialogState={serverDialogState}
        onAvatarSortChange={setAvatarSort}
        formatDate={formatDate}
      />
    </main>
  );
}
