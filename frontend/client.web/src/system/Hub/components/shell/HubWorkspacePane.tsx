import type { CSSProperties, PointerEvent, RefObject } from 'react'
import type { ImageCrop } from '../../../../shared/media/ImageCropEditor'
import { ProfilePage } from '../../../Profile/components/page/ProfilePage'
import type { HubWorkspace } from './useHubWorkspace'
import type { FocusPrivateMessageRequest } from '../private-space/usePrivateSpaceMessages'
import type {
  GroupPrivateSpaceSettingsPatch,
  PrivateSpacePersonalSettingsPatch,
} from '../private-space/usePrivateSpaces'
import type { VoiceChannelController } from '../../../Server/hooks/voice/useVoiceChannel'
import type {
  VoicePlaybackState,
  VoiceUserAudioSettings,
} from '../../../shared/types/voicePlayback'
import type {
  FriendRequestResponse,
  FriendUserResponse,
  MessageDisplayFormat,
  PrivateSpaceResponse,
  OwnUserProfileResponse,
  ServerInviteResponse,
  ServerMemberResponse,
  SpaceMessageResponse,
  UserFriendResponse,
  UserResponse,
} from '../../../../shared/types'
import { DirectMessagesPanel } from '../direct-messages/DirectMessagesPanel'
import { HubUtilityView } from '../utility/HubUtilityView'
import { HubVoiceParticipantsPanel } from '../voice/HubVoiceParticipantsPanel'
import { SystemErrorBoundary } from '../../../shared/errors/SystemErrorBoundary'
import type {
  MessageBubbleAlignment,
  MessageBubbleWidth,
} from '../../../shared'
import styles from './HubPage.module.css'

type HubWorkspacePaneProps = {
  accessToken: string
  activeWorkspace: HubWorkspace
  activePrivateSpaceId: string | null
  user: UserResponse
  publicProfile: OwnUserProfileResponse
  avatarSrc: string
  avatarStyle: CSSProperties
  isAvatarDraftActive: boolean
  isAvatarMenuOpen: boolean
  avatarFileInputRef: RefObject<HTMLInputElement | null>
  privateSpaces: PrivateSpaceResponse[]
  friends: UserFriendResponse[]
  friendUserIds: Set<string>
  directServerInvites: ServerInviteResponse[]
  visibleServerMemberships: ServerMemberResponse[]
  incomingFriendRequests: FriendRequestResponse[]
  outgoingFriendRequests: FriendRequestResponse[]
  friendSearchQuery: string
  isLoadingPrivateSpaces: boolean
  isMutatingPrivateSpaces: boolean
  isLoadingFriends: boolean
  isSearchingUsers: boolean
  isMutatingFriends: boolean
  friendNotice: string | null
  pendingOutgoingUserIds: Set<string>
  voice: VoiceChannelController
  voiceAudioSettingsByUserId: Record<string, VoiceUserAudioSettings>
  voicePlaybackStatesByParticipantId: Record<string, VoicePlaybackState>
  isMemberPanelCompact: boolean
  defaultAttachmentExpanded: boolean
  loadExternalMediaPreviews: boolean
  horizontalVideoCardSize: number
  verticalVideoCardSize: number
  privateMessageDisplayFormat: MessageDisplayFormat
  privateMessageBubbleAlignment: MessageBubbleAlignment
  privateMessageBubbleWidth: MessageBubbleWidth
  showPrivateReadAllButton: boolean
  pendingPrivateSpaceDroppedFiles: {
    id: string
    spaceId: string
    files: File[]
  } | null
  focusedPrivateMessage: FocusPrivateMessageRequest | null
  onToggleAvatarMenu: () => void
  onCloseAvatarMenu: () => void
  onOpenAvatarPicker: () => void
  onShowAvatarLibrary: () => void
  onSelectAvatarFile: (file: File | undefined) => void
  onMarkBrokenAvatar: (url: string) => void
  onOpenPrivateSpace: (spaceId: string) => void
  onOpenPrivateSearchResult: (message: SpaceMessageResponse) => void
  onDropFilesToPrivateSpace: (spaceId: string, files: File[]) => void
  onPendingPrivateSpaceDroppedFilesConsumed: (id: string) => void
  onOpenDirectSpace: (userId: string) => void
  onCreatePrivateSpace: (
    memberUserIds: string[],
    title?: string | null,
  ) => Promise<PrivateSpaceResponse | null>
  onStartDirectVoice: (user: FriendUserResponse) => void
  onLoadInviteTargetServers: (targetUserId: string) => Promise<ServerMemberResponse[]>
  onClosePrivateSpace: (spaceId: string) => Promise<void>
  onClearPrivateSpaceHistory: (spaceId: string) => Promise<boolean>
  onAddPrivateSpaceMember: (
    spaceId: string,
    userId: string,
  ) => Promise<PrivateSpaceResponse | null>
  onUpdatePrivateSpacePersonalSettings: (
    spaceId: string,
    request: PrivateSpacePersonalSettingsPatch,
  ) => Promise<PrivateSpaceResponse>
  onUploadPrivateSpacePersonalAvatar: (
    spaceId: string,
    file: File,
    crop: ImageCrop,
  ) => Promise<PrivateSpaceResponse>
  onUpdateGroupPrivateSpaceSettings: (
    spaceId: string,
    request: GroupPrivateSpaceSettingsPatch,
  ) => Promise<PrivateSpaceResponse>
  onMarkPrivateSpaceRead: (spaceId: string) => Promise<void>
  onMarkAllPrivateSpacesRead: () => Promise<{
    updatedSpaceCount: number
  }>
  onChangeVoiceAudioSettings: (
    participantId: string,
    patch: Partial<VoiceUserAudioSettings>,
  ) => void
  onCreateDirectServerInvite: (serverId: string, targetUserId: string) => void
  onRemoveFriend: (userId: string) => void
  onCreateServer: () => void
  onServerJoined: (membership: ServerMemberResponse) => void
  onOpenServer: (membership: ServerMemberResponse) => void
  onAcceptDirectServerInvite: (inviteId: string) => void
  onDeclineDirectServerInvite: (inviteId: string) => void
  onFriendSearchQueryChange: (query: string) => void
  onSendFriendRequest: (userId: string) => void
  onAcceptFriendRequest: (requestId: string) => void
  onDeclineFriendRequest: (requestId: string) => void
  onCancelFriendRequest: (requestId: string) => void
  onStartHubResize: (event: PointerEvent<HTMLButtonElement>) => void
  onStartPrivateInfoResize: (event: PointerEvent<HTMLButtonElement>) => void
  onReturnToDirectMessages: () => void
  formatDate: (value: string) => string
}

export function HubWorkspacePane({
  accessToken,
  activeWorkspace,
  activePrivateSpaceId,
  user,
  publicProfile,
  avatarSrc,
  avatarStyle,
  isAvatarDraftActive,
  isAvatarMenuOpen,
  avatarFileInputRef,
  privateSpaces,
  friends,
  friendUserIds,
  directServerInvites,
  visibleServerMemberships,
  incomingFriendRequests,
  outgoingFriendRequests,
  friendSearchQuery,
  isLoadingPrivateSpaces,
  isMutatingPrivateSpaces,
  isLoadingFriends,
  isSearchingUsers,
  isMutatingFriends,
  friendNotice,
  pendingOutgoingUserIds,
  voice,
  voiceAudioSettingsByUserId,
  voicePlaybackStatesByParticipantId,
  isMemberPanelCompact,
  defaultAttachmentExpanded,
  loadExternalMediaPreviews,
  horizontalVideoCardSize,
  verticalVideoCardSize,
  privateMessageDisplayFormat,
  privateMessageBubbleAlignment,
  privateMessageBubbleWidth,
  showPrivateReadAllButton,
  pendingPrivateSpaceDroppedFiles,
  focusedPrivateMessage,
  onToggleAvatarMenu,
  onCloseAvatarMenu,
  onOpenAvatarPicker,
  onShowAvatarLibrary,
  onSelectAvatarFile,
  onMarkBrokenAvatar,
  onOpenPrivateSpace,
  onOpenPrivateSearchResult,
  onDropFilesToPrivateSpace,
  onPendingPrivateSpaceDroppedFilesConsumed,
  onOpenDirectSpace,
  onCreatePrivateSpace,
  onStartDirectVoice,
  onLoadInviteTargetServers,
  onClosePrivateSpace,
  onClearPrivateSpaceHistory,
  onAddPrivateSpaceMember,
  onUpdatePrivateSpacePersonalSettings,
  onUploadPrivateSpacePersonalAvatar,
  onUpdateGroupPrivateSpaceSettings,
  onMarkPrivateSpaceRead,
  onMarkAllPrivateSpacesRead,
  onChangeVoiceAudioSettings,
  onCreateDirectServerInvite,
  onRemoveFriend,
  onCreateServer,
  onServerJoined,
  onOpenServer,
  onAcceptDirectServerInvite,
  onDeclineDirectServerInvite,
  onFriendSearchQueryChange,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onCancelFriendRequest,
  onStartHubResize,
  onStartPrivateInfoResize,
  onReturnToDirectMessages,
  formatDate,
}: HubWorkspacePaneProps) {
  return (
    <section
      className={`${styles.workspace} profile-hub-workspace ${
        activeWorkspace === 'profile' || activeWorkspace === 'private-space'
          ? 'has-direct-messages'
          : 'has-voice-participants'
      }`}
    >
      {(activeWorkspace === 'profile' || activeWorkspace === 'private-space') && (
        <DirectMessagesPanel
          accessToken={accessToken}
          className={styles.sidePanelSlot}
          currentUserId={user.id}
          activePrivateSpaceId={activePrivateSpaceId}
          privateSpaces={privateSpaces}
          friends={friends}
          friendUserIds={friendUserIds}
          isLoadingPrivateSpaces={isLoadingPrivateSpaces}
          isMutatingPrivateSpaces={isMutatingPrivateSpaces}
          showPrivateReadAllButton={showPrivateReadAllButton}
          onOpenPrivateSpace={onOpenPrivateSpace}
          onDropFilesToPrivateSpace={onDropFilesToPrivateSpace}
          onCreatePrivateSpace={onCreatePrivateSpace}
          onLoadInviteTargetServers={onLoadInviteTargetServers}
          onClosePrivateSpace={onClosePrivateSpace}
          onClearPrivateSpaceHistory={onClearPrivateSpaceHistory}
          onCreateDirectServerInvite={onCreateDirectServerInvite}
          onRemoveFriend={onRemoveFriend}
          onSendFriendRequest={onSendFriendRequest}
          onUpdatePersonalSettings={onUpdatePrivateSpacePersonalSettings}
          onUploadPersonalAvatar={onUploadPrivateSpacePersonalAvatar}
          onUpdateGroupSettings={onUpdateGroupPrivateSpaceSettings}
          onMarkPrivateSpaceRead={onMarkPrivateSpaceRead}
          onMarkAllPrivateSpacesRead={onMarkAllPrivateSpacesRead}
          onOpenSearchResult={onOpenPrivateSearchResult}
        />
      )}
      {activeWorkspace !== 'profile' && activeWorkspace !== 'private-space' && (
        <HubVoiceParticipantsPanel
          className={styles.sidePanelSlot}
          voice={voice}
        />
      )}
      <button
        className={styles.hubResizer}
        type="button"
        aria-label="Resize hub side panel"
        onPointerDown={onStartHubResize}
      />
      <div
        className={`${styles.content} profile-hub-content ui-scrollbar-none`}
        data-workspace-transition-content="true"
      >
        {activeWorkspace === 'profile' ? (
          <SystemErrorBoundary
            boundaryName="profile-workspace"
            resetKeys={[activeWorkspace, user.id]}
          >
            <ProfilePage
              user={user}
              publicProfile={publicProfile}
              avatarSrc={avatarSrc}
              avatarStyle={avatarStyle}
              isAvatarDraftActive={isAvatarDraftActive}
              isAvatarMenuOpen={isAvatarMenuOpen}
              fileInputRef={avatarFileInputRef}
              onToggleAvatarMenu={onToggleAvatarMenu}
              onCloseAvatarMenu={onCloseAvatarMenu}
              onOpenAvatarPicker={onOpenAvatarPicker}
              onShowAvatarLibrary={onShowAvatarLibrary}
              onSelectAvatarFile={onSelectAvatarFile}
              onMarkBrokenAvatar={onMarkBrokenAvatar}
              formatDate={formatDate}
            />
          </SystemErrorBoundary>
        ) : (
          <SystemErrorBoundary
            boundaryName="hub-utility-workspace"
            resetKeys={[activeWorkspace, activePrivateSpaceId]}
          >
            <HubUtilityView
              activeWorkspace={activeWorkspace}
              accessToken={accessToken}
              activePrivateSpaceId={activePrivateSpaceId}
              currentUserId={user.id}
              privateSpaces={privateSpaces}
              directServerInvites={directServerInvites}
              visibleServerMemberships={visibleServerMemberships}
              friends={friends}
              incomingFriendRequests={incomingFriendRequests}
              outgoingFriendRequests={outgoingFriendRequests}
              friendSearchQuery={friendSearchQuery}
              isLoadingFriends={isLoadingFriends}
              isMutatingPrivateSpaces={isMutatingPrivateSpaces}
              isSearchingUsers={isSearchingUsers}
              isMutatingFriends={isMutatingFriends}
              friendNotice={friendNotice}
              pendingOutgoingUserIds={pendingOutgoingUserIds}
              friendUserIds={friendUserIds}
              voice={voice}
              voiceAudioSettingsByUserId={voiceAudioSettingsByUserId}
              voicePlaybackStatesByParticipantId={voicePlaybackStatesByParticipantId}
              isMemberPanelCompact={isMemberPanelCompact}
              defaultAttachmentExpanded={defaultAttachmentExpanded}
              loadExternalMediaPreviews={loadExternalMediaPreviews}
              horizontalVideoCardSize={horizontalVideoCardSize}
              verticalVideoCardSize={verticalVideoCardSize}
              privateMessageDisplayFormat={privateMessageDisplayFormat}
              privateMessageBubbleAlignment={privateMessageBubbleAlignment}
              privateMessageBubbleWidth={privateMessageBubbleWidth}
              pendingPrivateSpaceDroppedFiles={pendingPrivateSpaceDroppedFiles}
              onServerJoined={onServerJoined}
              onOpenServer={onOpenServer}
              onOpenDirectSpace={onOpenDirectSpace}
              onStartDirectVoice={onStartDirectVoice}
              onAcceptDirectServerInvite={onAcceptDirectServerInvite}
              onDeclineDirectServerInvite={onDeclineDirectServerInvite}
              onAddPrivateSpaceMember={onAddPrivateSpaceMember}
              onChangeVoiceAudioSettings={onChangeVoiceAudioSettings}
              onPendingPrivateSpaceDroppedFilesConsumed={
                onPendingPrivateSpaceDroppedFilesConsumed
              }
              onFriendSearchQueryChange={onFriendSearchQueryChange}
              onSendFriendRequest={onSendFriendRequest}
              onAcceptFriendRequest={onAcceptFriendRequest}
              onDeclineFriendRequest={onDeclineFriendRequest}
              onCancelFriendRequest={onCancelFriendRequest}
              onStartPrivateInfoResize={onStartPrivateInfoResize}
              onRemoveFriend={onRemoveFriend}
              onCreateServer={onCreateServer}
              onReturnToDirectMessages={onReturnToDirectMessages}
              focusedPrivateMessage={focusedPrivateMessage}
            />
          </SystemErrorBoundary>
        )}
      </div>
    </section>
  )
}
