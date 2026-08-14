import {
  type CSSProperties,
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  MessageDisplayFormat,
  PrivateDeletedMessageResponse,
  PrivateSpaceResponse,
  SpaceMessageResponse,
  UserFriendResponse,
} from '../../../../shared/types'
import { ServerMessagePanel } from '../../../Server/components/messages/ServerMessagePanel'
import {
  communityCopy,
  defaultMessageBubbleAlignment,
  defaultMessageBubbleWidth,
  PresenceDot,
  SystemIcon,
  voiceCopy,
} from '../../../shared'
import type {
  MessageBubbleAlignment,
  MessageBubbleWidth,
} from '../../../shared'
import type { VoiceChannelController } from '../../../Server/hooks/voice/useVoiceChannel'
import type {
  VoicePlaybackState,
  VoiceUserAudioSettings,
} from '../../../shared/types/voicePlayback'
import { usePrivateSpaceMessages } from './usePrivateSpaceMessages'
import type { FocusPrivateMessageRequest } from './usePrivateSpaceMessages'
import {
  getPrivateSpaceOtherMember,
  getPrivateSpaceTitle,
} from '../direct-messages/directMessageModel'
import { PrivateSpaceAvatar } from '../direct-messages/DirectMessageAvatar'
import { InvitePrivateSpaceMemberDialog } from '../direct-messages/PrivateSpaceDialogs'
import { PrivateSpaceInfoPanel } from './PrivateSpaceInfoPanel'
import {
  PrivateSpaceHeaderActions,
  PrivateVoiceStrip,
} from './PrivateSpaceVoiceParts'
import privateStyles from './PrivateSpace.module.css'
import privateVoiceStyles from './PrivateVoice.module.css'
import { usePrivateVoicePanel } from './usePrivateVoicePanel'

type PrivateSpaceWorkspaceProps = {
  accessToken: string
  activePrivateSpaceId: string | null
  currentUserId: string
  privateSpaces: PrivateSpaceResponse[]
  friends: UserFriendResponse[]
  isLoadingFriends: boolean
  isMutatingPrivateSpaces: boolean
  voice: VoiceChannelController
  voiceAudioSettingsByUserId: Record<string, VoiceUserAudioSettings>
  voicePlaybackStatesByParticipantId: Record<string, VoicePlaybackState>
  isMemberPanelCompact: boolean
  defaultAttachmentExpanded: boolean
  loadExternalMediaPreviews: boolean
  horizontalVideoCardSize: number
  verticalVideoCardSize: number
  messageDisplayFormat?: MessageDisplayFormat
  messageBubbleAlignment?: MessageBubbleAlignment
  messageBubbleWidth?: MessageBubbleWidth
  pendingDroppedFiles: {
    id: string
    spaceId: string
    files: File[]
  } | null
  focusedMessage?: FocusPrivateMessageRequest | null
  onAddMember: (
    spaceId: string,
    userId: string,
  ) => Promise<PrivateSpaceResponse | null>
  onChangeVoiceAudioSettings: (
    participantId: string,
    patch: Partial<VoiceUserAudioSettings>,
  ) => void
  onPendingDroppedFilesConsumed: (id: string) => void
  onStartInfoResize: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onReturnToDirectMessages: () => void
}

export function PrivateSpaceWorkspace({
  accessToken,
  activePrivateSpaceId,
  currentUserId,
  privateSpaces,
  friends,
  isLoadingFriends,
  isMutatingPrivateSpaces,
  voice,
  voiceAudioSettingsByUserId,
  voicePlaybackStatesByParticipantId,
  isMemberPanelCompact,
  defaultAttachmentExpanded,
  loadExternalMediaPreviews,
  horizontalVideoCardSize,
  verticalVideoCardSize,
  messageDisplayFormat = 'wall-scroll',
  messageBubbleAlignment = defaultMessageBubbleAlignment,
  messageBubbleWidth = defaultMessageBubbleWidth,
  pendingDroppedFiles,
  focusedMessage,
  onAddMember,
  onChangeVoiceAudioSettings,
  onPendingDroppedFilesConsumed,
  onStartInfoResize,
  onReturnToDirectMessages,
}: PrivateSpaceWorkspaceProps) {
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const [isInviteOpen, setIsInviteOpen] = useState(false)

  useEffect(() => {
    setIsInviteOpen(false)
  }, [activePrivateSpaceId])
  const {
    messages,
    pinnedMessages,
    deletedMessages,
    isLoadingMessages,
    isLoadingOlderMessages,
    hasOlderMessages,
    isLoadingPinnedMessages,
    isLoadingDeletedMessages,
    isLoadingOlderDeletedMessages,
    hasOlderDeletedMessages,
    isClearingDeletedMessages,
    restoringMessageId,
    isSendingMessage,
    messageError,
    trashError,
    loadOlderMessages,
    loadOlderDeletedMessages,
    clearDeletedMessages,
    sendMessage,
    updateMessage,
    deleteMessage,
    restoreMessage,
    pinMessage,
    setMessageReaction,
    markMessagesRead,
  } = usePrivateSpaceMessages(
    accessToken,
    activePrivateSpaceId,
    focusedMessage ?? null,
  )
  const activeVoiceParticipants = activePrivateSpaceId
    ? (voice.participantsBySpaceId[activePrivateSpaceId] ?? [])
    : []
  const isVoiceConnected =
    voice.connectedChannel?.channelScope === 'private' &&
    voice.connectedChannel.spaceId === activePrivateSpaceId
  const shouldShowVoicePanel =
    Boolean(activePrivateSpaceId) &&
    (isVoiceConnected || activeVoiceParticipants.length > 0)
  const voicePanel = usePrivateVoicePanel(shouldShowVoicePanel)

  const privateSpace = privateSpaces.find(
    (space) => space.spaceId === activePrivateSpaceId,
  )
  const title = getPrivateSpaceTitle(privateSpace, currentUserId)
  const activeMembers =
    privateSpace?.members.filter((member) => member.statusCode === 'active') ?? []
  const directPeer = privateSpace
    ? getPrivateSpaceOtherMember(privateSpace, currentUserId)
    : null
  const effectiveActiveMembers =
    privateSpace?.kind === 'direct' && directPeer
      ? activeMembers.map((member) =>
          member.userId === directPeer.userId
            ? {
                ...member,
                user: applyDirectPeerUserIdentity(
                  member.user,
                  privateSpace,
                ),
              }
            : member,
        )
      : activeMembers
  const otherMember =
    effectiveActiveMembers.find(
      (member) => member.userId !== currentUserId,
    ) ?? null
  const directPresenceStatus =
    privateSpace?.kind === 'direct'
      ? otherMember?.user.presenceStatus
      : null
  const participantUserIds = new Set(activeMembers.map((member) => member.userId))
  const inviteCandidates = friends.filter(
    (friend) => !participantUserIds.has(friend.friendUserId),
  )
  const normalizedSearchQuery = messageSearchQuery.trim().toLowerCase()
  const effectiveMessages = privateSpace
    ? messages.map((message) =>
        applyDirectPeerMessageIdentity(message, privateSpace, currentUserId),
      )
    : messages
  const effectivePinnedMessages = privateSpace
    ? pinnedMessages.map((message) =>
        applyDirectPeerMessageIdentity(message, privateSpace, currentUserId),
      )
    : pinnedMessages
  const effectiveDeletedMessages = privateSpace
    ? deletedMessages.map((deletedMessage) =>
        applyDirectPeerDeletedMessageIdentity(
          deletedMessage,
          privateSpace,
          currentUserId,
        ),
      )
    : deletedMessages
  const visibleMessages = normalizedSearchQuery
    ? effectiveMessages.filter((message) =>
        [
          message.body,
          message.senderDisplayName,
          message.assets.map((asset) => asset.fileName).join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearchQuery),
      )
    : effectiveMessages
  const canUseVoice = Boolean(activePrivateSpaceId && privateSpace)

  return (
    <section className={privateStyles.privateSpaceLayout}>
      <div
        className={`${privateStyles.privateChatColumn} ${
          voicePanel.isRendered ? privateStyles.withPrivateVoicePanel : ''
        } ${voicePanel.isClosing ? privateStyles.closingPrivateVoicePanel : ''} ${
          voicePanel.isResizing ? privateStyles.resizingPrivateVoicePanel : ''
        }`}
        style={
          {
            '--private-voice-panel-height': `${voicePanel.height}px`,
          } as CSSProperties
        }
      >
        {voicePanel.isRendered && privateSpace && activePrivateSpaceId && (
          <>
            <PrivateVoiceStrip
              currentUserId={currentUserId}
              localParticipantId={voice.localParticipantId}
              participants={activeVoiceParticipants}
              privateSpace={privateSpace}
              localPreviewStream={voice.localCameraPreviewStream}
              remoteStreamsByParticipantId={voice.remoteStreamsByParticipantId}
              peerStatusesByParticipantId={voice.peerStatusesByParticipantId}
              speakingParticipantIds={voice.speakingParticipantIds}
              hasLocalAudioTrack={voice.hasLocalAudioTrack}
              error={voice.voiceError}
              isMuted={voice.isMuted}
              isDeafened={voice.isDeafened}
              isCameraEnabled={voice.isCameraEnabled}
              isScreenSharing={voice.isScreenSharing}
              audioSettingsByUserId={voiceAudioSettingsByUserId}
              playbackStatesByParticipantId={voicePlaybackStatesByParticipantId}
              onChangeAudioSettings={onChangeVoiceAudioSettings}
              onToggleMuted={voice.toggleMuted}
              onToggleDeafened={voice.toggleDeafened}
              onToggleCamera={voice.toggleCamera}
              onToggleScreenShare={voice.toggleScreenShare}
              onLeaveVoiceChannel={voice.leaveVoiceChannel}
            />
            <button
              className={privateVoiceStyles.privateVoiceResizeHandle}
              type="button"
              aria-label={voiceCopy.dock.resizeCallWindow}
              onPointerDown={voicePanel.startResize}
            />
          </>
        )}
        <ServerMessagePanel
          key={activePrivateSpaceId ?? 'private-space'}
          feedKey={activePrivateSpaceId ?? 'private-space'}
          title={title}
          currentUserId={currentUserId}
          canManageMessages={false}
          canSendMessages={true}
          mentionUsers={activeMembers
            .filter((member) => member.userId !== currentUserId)
            .map((member) => ({
              id: member.userId,
              login: member.user.login,
              displayName: member.user.displayName,
              avatarAssetId: member.user.avatarAssetId,
              avatarCropOffsetX: member.user.avatarCropOffsetX,
              avatarCropOffsetY: member.user.avatarCropOffsetY,
              avatarCropZoom: member.user.avatarCropZoom,
            }))}
          mentionRoles={[]}
          canPinMessages={Boolean(privateSpace)}
          defaultAttachmentExpanded={defaultAttachmentExpanded}
          loadExternalMediaPreviews={loadExternalMediaPreviews}
          horizontalVideoCardSize={horizontalVideoCardSize}
          verticalVideoCardSize={verticalVideoCardSize}
          invitePreviewAccessToken={accessToken}
          invitePreviewOrigin={window.location.origin}
          showPrivateMessageReceipts
          messageDisplayFormat={messageDisplayFormat}
          messageBubbleAlignment={messageBubbleAlignment}
          messageBubbleWidth={messageBubbleWidth}
          titleIcon={
            privateSpace ? (
              <PrivateSpaceAvatar
                className={privateVoiceStyles.privateAvatar}
                space={privateSpace}
                currentUserId={currentUserId}
                title={title}
              />
            ) : undefined
          }
          titleAccessory={
            directPresenceStatus ? (
              <PresenceDot status={directPresenceStatus} />
            ) : undefined
          }
          leadingAction={
            <button
              className={privateStyles.privateChatBack}
              type="button"
              aria-label={communityCopy.direct.backToDirectMessages}
              onClick={onReturnToDirectMessages}
            >
              <SystemIcon name="back" size={22} />
            </button>
          }
          pendingDroppedFiles={
            pendingDroppedFiles?.spaceId === activePrivateSpaceId
              ? pendingDroppedFiles
              : null
          }
          headerActions={
            <PrivateSpaceHeaderActions
              isVoiceConnected={isVoiceConnected}
              isCameraEnabled={voice.isCameraEnabled}
              isVoiceConnecting={voice.isVoiceConnecting}
              canUseVoice={canUseVoice}
              isInviteOpen={isInviteOpen}
              onToggleCall={() => {
                if (!activePrivateSpaceId || !privateSpace) return

                if (isVoiceConnected) {
                  void voice.leaveVoiceChannel()
                  return
                }

                void voice.joinVoiceChannel({
                  serverId: null,
                  spaceId: activePrivateSpaceId,
                  title,
                  channelScope: 'private',
                })
              }}
              onToggleCamera={() => {
                if (!isVoiceConnected && activePrivateSpaceId && privateSpace) {
                  void voice
                    .joinVoiceChannel({
                      serverId: null,
                      spaceId: activePrivateSpaceId,
                      title,
                      channelScope: 'private',
                    })
                    .then(() => voice.enableCamera())
                  return
                }

                void voice.toggleCamera()
              }}
              onOpenInvite={() => setIsInviteOpen(true)}
            />
          }
          privateMessageTrash={{
            messages: effectiveDeletedMessages,
            isLoading: isLoadingDeletedMessages,
            isLoadingOlder: isLoadingOlderDeletedMessages,
            hasOlder: hasOlderDeletedMessages,
            isClearing: isClearingDeletedMessages,
            error: trashError,
            restoringMessageId,
            onRestoreMessage: restoreMessage,
            onLoadOlder: loadOlderDeletedMessages,
            onClear: clearDeletedMessages,
          }}
          messages={visibleMessages}
          pinnedMessages={effectivePinnedMessages}
          isLoading={isLoadingMessages}
          isLoadingOlderMessages={isLoadingOlderMessages}
          hasOlderMessages={hasOlderMessages}
          isLoadingPinnedMessages={isLoadingPinnedMessages}
          isSending={isSendingMessage}
          error={messageError}
          onSendMessage={sendMessage}
          onUpdateMessage={updateMessage}
          onDeleteMessage={deleteMessage}
          onPinMessage={pinMessage}
          onSetMessageReaction={setMessageReaction}
          onMarkRead={markMessagesRead}
          onLoadOlderMessages={loadOlderMessages}
          isReadingHistory={Boolean(normalizedSearchQuery)}
          onPendingDroppedFilesConsumed={onPendingDroppedFilesConsumed}
          focusedMessageId={
            focusedMessage?.spaceId === activePrivateSpaceId
              ? focusedMessage.messageId
              : null
          }
        />
      </div>
      <button
        className={privateStyles.privateInfoResizer}
        type="button"
        aria-label={communityCopy.direct.resizePrivateInfoPanel}
        onPointerDown={onStartInfoResize}
      />
      <PrivateSpaceInfoPanel
        spaceKind={privateSpace?.kind ?? null}
        activeMembers={effectiveActiveMembers}
        isCompact={isMemberPanelCompact}
        otherMember={otherMember}
        searchQuery={messageSearchQuery}
        onSearchQueryChange={setMessageSearchQuery}
      />
      {isInviteOpen && privateSpace && activePrivateSpaceId && (
        <InvitePrivateSpaceMemberDialog
          candidates={inviteCandidates}
          spaceKind={privateSpace.kind}
          isLoadingCandidates={isLoadingFriends}
          isSaving={isMutatingPrivateSpaces}
          onClose={() => setIsInviteOpen(false)}
          onInvite={(userId) => onAddMember(activePrivateSpaceId, userId)}
        />
      )}
    </section>
  )
}

function applyDirectPeerUserIdentity(
  user: UserFriendResponse['friend'],
  space: PrivateSpaceResponse,
) {
  return {
    ...user,
    displayName: space.viewerSettings.customNickname || user.displayName,
    avatarAssetId:
      space.viewerSettings.customAvatarAssetId ?? user.avatarAssetId,
    avatarCropOffsetX: space.viewerSettings.customAvatarAssetId
      ? space.viewerSettings.customAvatarCropOffsetX
      : user.avatarCropOffsetX,
    avatarCropOffsetY: space.viewerSettings.customAvatarAssetId
      ? space.viewerSettings.customAvatarCropOffsetY
      : user.avatarCropOffsetY,
    avatarCropZoom: space.viewerSettings.customAvatarAssetId
      ? space.viewerSettings.customAvatarCropZoom
      : user.avatarCropZoom,
  }
}

function applyDirectPeerMessageIdentity(
  message: SpaceMessageResponse,
  space: PrivateSpaceResponse,
  currentUserId: string,
): SpaceMessageResponse {
  if (space.kind !== 'direct') return message
  const peer = getPrivateSpaceOtherMember(space, currentUserId)
  if (!peer) return message

  const effectivePeer = applyDirectPeerUserIdentity(peer.user, space)
  const isPeerMessage = message.senderUserId === peer.userId
  const isPeerReply = message.replyTo?.senderUserId === peer.userId

  if (!isPeerMessage && !isPeerReply) return message
  return {
    ...message,
    ...(isPeerMessage
      ? {
          senderDisplayName: effectivePeer.displayName,
          senderAvatarAssetId: effectivePeer.avatarAssetId,
          senderAvatarCropOffsetX: effectivePeer.avatarCropOffsetX,
          senderAvatarCropOffsetY: effectivePeer.avatarCropOffsetY,
          senderAvatarCropZoom: effectivePeer.avatarCropZoom,
        }
      : {}),
    replyTo:
      isPeerReply && message.replyTo
        ? {
            ...message.replyTo,
            senderDisplayName: effectivePeer.displayName,
            senderAvatarAssetId: effectivePeer.avatarAssetId,
            senderAvatarCropOffsetX: effectivePeer.avatarCropOffsetX,
            senderAvatarCropOffsetY: effectivePeer.avatarCropOffsetY,
            senderAvatarCropZoom: effectivePeer.avatarCropZoom,
          }
        : message.replyTo,
  }
}

function applyDirectPeerDeletedMessageIdentity(
  deletedMessage: PrivateDeletedMessageResponse,
  space: PrivateSpaceResponse,
  currentUserId: string,
): PrivateDeletedMessageResponse {
  return {
    ...deletedMessage,
    message: applyDirectPeerMessageIdentity(
      deletedMessage.message,
      space,
      currentUserId,
    ),
  }
}
