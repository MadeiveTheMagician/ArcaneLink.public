import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  FriendRequestResponse,
  FriendUserResponse,
  MessageDisplayFormat,
  PrivateSpaceResponse,
  ServerInviteResponse,
  ServerMemberResponse,
  SpaceMessageResponse,
  UserFriendResponse,
} from '../../../../shared/types'
import { ServersBrowser } from '../../../Server/components/navigation/ServersBrowser'
import type { VoiceChannelController } from '../../../Server/hooks/voice/useVoiceChannel'
import type {
  VoicePlaybackState,
  VoiceUserAudioSettings,
} from '../../../shared/types/voicePlayback'
import type { FocusPrivateMessageRequest } from '../private-space/usePrivateSpaceMessages'
import type { HubWorkspace } from '../shell/useHubWorkspace'
import { CommunityView } from '../community/CommunityView'
import type {
  CommunityNavigationRequest,
  CommunityTab,
} from '../community/communityTypes'
import { PrivateSpaceWorkspace } from '../private-space/PrivateSpaceWorkspace'
import { NotificationCenter } from '../notifications/NotificationCenter'
import type { NotificationTarget } from '../notifications/notificationNavigation'
import {
  defaultMessageBubbleAlignment,
  defaultMessageBubbleWidth,
} from '../../../shared'
import type {
  MessageBubbleAlignment,
  MessageBubbleWidth,
} from '../../../shared'

type HubUtilityViewProps = {
  activeWorkspace: HubWorkspace
  accessToken: string
  activePrivateSpaceId: string | null
  currentUserId: string
  privateSpaces: PrivateSpaceResponse[]
  directServerInvites: ServerInviteResponse[]
  visibleServerMemberships: ServerMemberResponse[]
  friends: UserFriendResponse[]
  incomingFriendRequests: FriendRequestResponse[]
  outgoingFriendRequests: FriendRequestResponse[]
  friendSearchQuery: string
  isLoadingFriends: boolean
  isMutatingPrivateSpaces: boolean
  isSearchingUsers: boolean
  isMutatingFriends: boolean
  friendNotice: string | null
  pendingOutgoingUserIds: Set<string>
  friendUserIds: Set<string>
  voice: VoiceChannelController
  voiceAudioSettingsByUserId: Record<string, VoiceUserAudioSettings>
  voicePlaybackStatesByParticipantId: Record<string, VoicePlaybackState>
  isMemberPanelCompact: boolean
  defaultAttachmentExpanded: boolean
  loadExternalMediaPreviews: boolean
  horizontalVideoCardSize: number
  verticalVideoCardSize: number
  privateMessageDisplayFormat?: MessageDisplayFormat
  privateMessageBubbleAlignment?: MessageBubbleAlignment
  privateMessageBubbleWidth?: MessageBubbleWidth
  pendingPrivateSpaceDroppedFiles: {
    id: string
    spaceId: string
    files: File[]
  } | null
  onAddPrivateSpaceMember: (
    spaceId: string,
    userId: string,
  ) => Promise<PrivateSpaceResponse | null>
  onChangeVoiceAudioSettings: (
    participantId: string,
    patch: Partial<VoiceUserAudioSettings>,
  ) => void
  onPendingPrivateSpaceDroppedFilesConsumed: (id: string) => void
  onServerJoined: (membership: ServerMemberResponse) => void
  onOpenServer: (membership: ServerMemberResponse) => void
  onOpenDirectSpace: (userId: string) => void
  onStartDirectVoice: (user: FriendUserResponse) => void
  onLoadInviteTargetServers: (
    targetUserId: string,
  ) => Promise<ServerMemberResponse[]>
  onCreateDirectServerInvite: (serverId: string, targetUserId: string) => void
  onAcceptDirectServerInvite: (inviteId: string) => void
  onDeclineDirectServerInvite: (inviteId: string) => void
  onOpenNotificationTarget: (target: NotificationTarget) => void
  communityNavigationRequest: CommunityNavigationRequest | null
  onCommunityNavigationRequestConsumed: (requestId: number) => void
  onFriendSearchQueryChange: (query: string) => void
  onSendFriendRequest: (userId: string) => void
  onAcceptFriendRequest: (requestId: string) => void
  onDeclineFriendRequest: (requestId: string) => void
  onCancelFriendRequest: (requestId: string) => void
  onRemoveFriend: (userId: string) => void
  onCreateServer: () => void
  onStartPrivateInfoResize: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onReturnToDirectMessages: () => void
  focusedPrivateMessage?: FocusPrivateMessageRequest | null
  onOpenPrivateSearchResult: (message: SpaceMessageResponse) => void
}

export function HubUtilityView({
  activeWorkspace,
  accessToken,
  activePrivateSpaceId,
  currentUserId,
  privateSpaces,
  directServerInvites,
  visibleServerMemberships,
  friends,
  incomingFriendRequests,
  outgoingFriendRequests,
  friendSearchQuery,
  isLoadingFriends,
  isMutatingPrivateSpaces,
  isSearchingUsers,
  isMutatingFriends,
  friendNotice,
  pendingOutgoingUserIds,
  friendUserIds,
  voice,
  voiceAudioSettingsByUserId,
  voicePlaybackStatesByParticipantId,
  isMemberPanelCompact,
  defaultAttachmentExpanded,
  loadExternalMediaPreviews,
  horizontalVideoCardSize,
  verticalVideoCardSize,
  privateMessageDisplayFormat = 'wall-scroll',
  privateMessageBubbleAlignment = defaultMessageBubbleAlignment,
  privateMessageBubbleWidth = defaultMessageBubbleWidth,
  pendingPrivateSpaceDroppedFiles,
  onAddPrivateSpaceMember,
  onChangeVoiceAudioSettings,
  onPendingPrivateSpaceDroppedFilesConsumed,
  onServerJoined,
  onOpenServer,
  onOpenDirectSpace,
  onStartDirectVoice,
  onLoadInviteTargetServers,
  onCreateDirectServerInvite,
  onAcceptDirectServerInvite,
  onDeclineDirectServerInvite,
  onOpenNotificationTarget,
  communityNavigationRequest,
  onCommunityNavigationRequestConsumed,
  onFriendSearchQueryChange,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onCancelFriendRequest,
  onRemoveFriend,
  onCreateServer,
  onStartPrivateInfoResize,
  onReturnToDirectMessages,
  focusedPrivateMessage,
  onOpenPrivateSearchResult,
}: HubUtilityViewProps) {
  const [communityTab, setCommunityTab] = useState<CommunityTab>('friends')
  const handledCommunityNavigationRequestRef = useRef<number | null>(null)

  useEffect(() => {
    if (
      !communityNavigationRequest ||
      handledCommunityNavigationRequestRef.current ===
        communityNavigationRequest.id
    ) {
      return
    }

    handledCommunityNavigationRequestRef.current =
      communityNavigationRequest.id
    setCommunityTab(communityNavigationRequest.tab)
    onCommunityNavigationRequestConsumed(communityNavigationRequest.id)
  }, [
    communityNavigationRequest,
    onCommunityNavigationRequestConsumed,
  ])

  if (activeWorkspace === 'private-space') {
    return (
      <PrivateSpaceWorkspace
        accessToken={accessToken}
        activePrivateSpaceId={activePrivateSpaceId}
        currentUserId={currentUserId}
        privateSpaces={privateSpaces}
        friends={friends}
        friendUserIds={friendUserIds}
        pendingOutgoingUserIds={pendingOutgoingUserIds}
        isLoadingFriends={isLoadingFriends}
        isMutatingFriends={isMutatingFriends}
        isMutatingPrivateSpaces={isMutatingPrivateSpaces}
        voice={voice}
        voiceAudioSettingsByUserId={voiceAudioSettingsByUserId}
        voicePlaybackStatesByParticipantId={voicePlaybackStatesByParticipantId}
        isMemberPanelCompact={isMemberPanelCompact}
        defaultAttachmentExpanded={defaultAttachmentExpanded}
        loadExternalMediaPreviews={loadExternalMediaPreviews}
        horizontalVideoCardSize={horizontalVideoCardSize}
        verticalVideoCardSize={verticalVideoCardSize}
        messageDisplayFormat={privateMessageDisplayFormat}
        messageBubbleAlignment={privateMessageBubbleAlignment}
        messageBubbleWidth={privateMessageBubbleWidth}
        pendingDroppedFiles={pendingPrivateSpaceDroppedFiles}
        focusedMessage={focusedPrivateMessage}
        onOpenSearchResult={onOpenPrivateSearchResult}
        onAddMember={onAddPrivateSpaceMember}
        onOpenDirectSpace={onOpenDirectSpace}
        onStartDirectVoice={onStartDirectVoice}
        onLoadInviteTargetServers={onLoadInviteTargetServers}
        onCreateDirectServerInvite={onCreateDirectServerInvite}
        onSendFriendRequest={onSendFriendRequest}
        onRemoveFriend={onRemoveFriend}
        onChangeVoiceAudioSettings={onChangeVoiceAudioSettings}
        onPendingDroppedFilesConsumed={
          onPendingPrivateSpaceDroppedFilesConsumed
        }
        onStartInfoResize={onStartPrivateInfoResize}
        onReturnToDirectMessages={onReturnToDirectMessages}
      />
    )
  }

  if (activeWorkspace === 'friends') {
    return (
      <CommunityView
        accessToken={accessToken}
        activeTab={communityTab}
        friendNotice={friendNotice}
        friendSearchQuery={friendSearchQuery}
        friendUserIds={friendUserIds}
        friends={friends}
        incomingFriendRequests={incomingFriendRequests}
        isLoadingFriends={isLoadingFriends}
        isMutatingFriends={isMutatingFriends}
        isSearchingUsers={isSearchingUsers}
        outgoingFriendRequests={outgoingFriendRequests}
        pendingOutgoingUserIds={pendingOutgoingUserIds}
        visibleServerMemberships={visibleServerMemberships}
        voice={voice}
        onAcceptFriendRequest={onAcceptFriendRequest}
        onCancelFriendRequest={onCancelFriendRequest}
        onDeclineFriendRequest={onDeclineFriendRequest}
        onFriendSearchQueryChange={onFriendSearchQueryChange}
        onOpenDirectSpace={onOpenDirectSpace}
        onStartDirectVoice={onStartDirectVoice}
        onRemoveFriend={onRemoveFriend}
        onSendFriendRequest={onSendFriendRequest}
        onTabChange={setCommunityTab}
      />
    )
  }

  if (activeWorkspace === 'invites') {
    return (
      <NotificationCenter
        accessToken={accessToken}
        currentUserId={currentUserId}
        directServerInvites={directServerInvites}
        onAcceptDirectServerInvite={onAcceptDirectServerInvite}
        onDeclineDirectServerInvite={onDeclineDirectServerInvite}
        onOpenTarget={onOpenNotificationTarget}
      />
    )
  }

  return (
    <ServersBrowser
      accessToken={accessToken}
      memberships={visibleServerMemberships}
      onCreateServer={onCreateServer}
      onOpenServer={onOpenServer}
      onServerJoined={onServerJoined}
    />
  )
}
