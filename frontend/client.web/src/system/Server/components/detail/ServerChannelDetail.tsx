import type {
  MessageDisplayFormat,
  ServerMemberDetailsResponse,
  ServerMemberResponse,
  ServerRoleResponse,
  SpaceMentionCandidatesResponse,
  SpaceMessageMentionRequest,
  SpaceMessageResponse,
  SpaceReadStateResponse,
  SpaceResponse,
  UserResponse,
} from '../../../../shared/types'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type {
  VoiceChannelController,
  VoiceParticipant,
} from '../../hooks/voice/useVoiceChannel'
import type {
  VoicePlaybackState,
  VoiceUserAudioSettings,
} from '../../../shared/types/voicePlayback'
import { serverCopy, SystemIcon } from '../../../shared'
import type {
  MessageBubbleAlignment,
  MessageBubbleWidth,
} from '../../../shared'
import type { ServerDetail } from '../../utils/serverWorkspaceModel'
import { ServerOverview } from '../overview/ServerOverview'
import { ServerChannelPlaceholder } from '../shell/ServerWorkspaceSections'
import { ServerMessagePanel } from '../messages/ServerMessagePanel'
import type { MessageComposerMentionInsertionRequest } from '../messages/MessageComposer'
import type { MessageAttachmentDraft } from '../messages/messageAttachmentDraft'
import { ServerVoiceChannel } from '../voice/channel/ServerVoiceChannel'
import {
  canConnectToVoiceSpace,
  canManageSpace,
  canSendMessagesToSpace,
} from '../../utils/spaceCapabilities'
import styles from '../shell/ServerWorkspace.module.css'
import { getServerMembersPanelDisclosure } from '../members/serverMembersPanelModel'
import type { OlderMessageLoadResult } from '../../hooks/messages/messagePaginationModel'

type ServerChannelDetailProps = {
  accessToken: string
  server: ServerMemberResponse['server']
  user: UserResponse
  visibleDetail: ServerDetail | null
  visibleChannel: Extract<ServerDetail, { type: 'channel' }> | null
  canManageServer: boolean
  serverMembers: ServerMemberDetailsResponse[]
  serverMemberCount: number
  serverRoles: ServerRoleResponse[]
  serverSpaces: SpaceResponse[]
  voice: VoiceChannelController
  isVoiceChatOpen: boolean
  membersPanelId: string
  isMembersPanelCollapsed: boolean
  onToggleMembersPanel: () => void
  onToggleVoiceChat: (spaceId: string) => void
  voicePlaybackStatesByParticipantId: Record<string, VoicePlaybackState>
  voiceAudioSettingsByUserId: Record<string, VoiceUserAudioSettings>
  messages: SpaceMessageResponse[]
  pinnedMessages: SpaceMessageResponse[]
  isLoadingMessages: boolean
  isLoadingOlderMessages: boolean
  hasOlderMessages: boolean
  isLoadingPinnedMessages: boolean
  isSendingMessage: boolean
  messageError: string | null
  mentionCandidates: SpaceMentionCandidatesResponse
  mentionInsertionRequest?: MessageComposerMentionInsertionRequest | null
  onMentionInsertionRequestHandled?: (requestId: number) => void
  onResolveMentionCandidates: (
    query?: string,
    signal?: AbortSignal,
  ) => Promise<SpaceMentionCandidatesResponse>
  defaultAttachmentExpanded: boolean
  loadExternalMediaPreviews: boolean
  horizontalVideoCardSize: number
  verticalVideoCardSize: number
  messageDisplayFormat: MessageDisplayFormat
  messageBubbleAlignment: MessageBubbleAlignment
  messageBubbleWidth: MessageBubbleWidth
  onOpenVoiceParticipantContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    participant: VoiceParticipant,
    sourceSpaceId: string,
    workspaceActions?: {
      onOpenDetachedParticipant?: () => void
      showParticipantsWithoutVideo?: boolean
      onToggleParticipantsWithoutVideo?: () => void
    },
  ) => void
  onSendMessage: (
    body: string,
    attachments?: MessageAttachmentDraft[],
    replyToMessageId?: string | null,
    mentions?: SpaceMessageMentionRequest[],
  ) => Promise<SpaceMessageResponse | null>
  onUpdateMessage: (
    messageId: string,
    request: { body?: string | null; payload?: string | null; clearPayload?: boolean },
  ) => Promise<SpaceMessageResponse | null>
  onDeleteMessage: (messageId: string) => Promise<boolean>
  onPinMessage: (messageId: string) => Promise<SpaceMessageResponse | null>
  onUnpinMessage: (messageId: string) => Promise<boolean>
  onSetMessageReaction: (
    messageId: string,
    emojiCode: string,
    isPresent: boolean,
  ) => Promise<SpaceMessageResponse | null>
  onMarkMessagesRead: (
    throughMessageId: string,
  ) => Promise<SpaceReadStateResponse | null>
  onLoadOlderMessages: () => Promise<OlderMessageLoadResult>
  onLoadMessageWindow: (
    messageId: string,
    createdAt: string,
  ) => Promise<boolean>
  onCloseDetail: () => void
  focusedMessageId?: string | null
}

export function ServerChannelDetail({
  accessToken,
  server,
  user,
  visibleDetail,
  visibleChannel,
  canManageServer,
  serverMembers,
  serverMemberCount,
  serverRoles,
  serverSpaces,
  voice,
  isVoiceChatOpen,
  membersPanelId,
  isMembersPanelCollapsed,
  onToggleMembersPanel,
  onToggleVoiceChat,
  voicePlaybackStatesByParticipantId,
  voiceAudioSettingsByUserId,
  messages,
  pinnedMessages,
  isLoadingMessages,
  isLoadingOlderMessages,
  hasOlderMessages,
  isLoadingPinnedMessages,
  isSendingMessage,
  messageError,
  mentionCandidates,
  mentionInsertionRequest,
  onMentionInsertionRequestHandled,
  onResolveMentionCandidates,
  defaultAttachmentExpanded,
  loadExternalMediaPreviews,
  horizontalVideoCardSize,
  verticalVideoCardSize,
  messageDisplayFormat,
  messageBubbleAlignment,
  messageBubbleWidth,
  onOpenVoiceParticipantContextMenu,
  onSendMessage,
  onUpdateMessage,
  onDeleteMessage,
  onPinMessage,
  onUnpinMessage,
  onSetMessageReaction,
  onMarkMessagesRead,
  onLoadOlderMessages,
  onLoadMessageWindow,
  onCloseDetail,
  focusedMessageId,
}: ServerChannelDetailProps) {
  const selectedSpace = visibleChannel?.spaceId
    ? serverSpaces.find((space) => space.id === visibleChannel.spaceId)
    : undefined

  if (visibleDetail?.type === 'overview') {
    return (
      <ServerOverview
        server={server}
        memberCount={serverMemberCount}
        roleCount={canManageServer ? serverRoles.length : null}
        spaces={serverSpaces}
        headerActions={
          <MembersPanelToggleButton
            panelId={membersPanelId}
            isCollapsed={isMembersPanelCollapsed}
            onToggle={onToggleMembersPanel}
          />
        }
      />
    )
  }

  if (visibleChannel?.kind === 'text' && visibleChannel.spaceId) {
    return (
      <ServerMessagePanel
        key={`${server.id}:${visibleChannel.spaceId}`}
        feedKey={`${server.id}:${visibleChannel.spaceId}`}
        title={visibleChannel.title}
        currentUserId={user.id}
        canManageMessages={canManageSpace(selectedSpace)}
        canSendMessages={canSendMessagesToSpace(selectedSpace)}
        mentionUsers={mentionCandidates.users}
        mentionRoles={mentionCandidates.roles}
        mentionInsertionRequest={mentionInsertionRequest}
        onMentionInsertionRequestHandled={onMentionInsertionRequestHandled}
        onResolveMentionCandidates={onResolveMentionCandidates}
        reportContext={{
          accessToken,
          serverId: server.id,
          spaceId: visibleChannel.spaceId,
        }}
        leadingAction={
          <button
            className={styles.serverTextBack}
            type="button"
            onClick={onCloseDetail}
            aria-label={serverCopy.navigation.backToServerSpaces}
          >
            <SystemIcon name="back" size={22} />
          </button>
        }
        titleIcon={<span className={styles.serverTextChannelMark}>#</span>}
        headerActions={
          <MembersPanelToggleButton
            panelId={membersPanelId}
            isCollapsed={isMembersPanelCollapsed}
            onToggle={onToggleMembersPanel}
          />
        }
        messages={messages}
        unreadCount={selectedSpace?.unreadCount ?? 0}
        pinnedMessages={pinnedMessages}
        isLoading={isLoadingMessages}
        isLoadingOlderMessages={isLoadingOlderMessages}
        hasOlderMessages={hasOlderMessages}
        isLoadingPinnedMessages={isLoadingPinnedMessages}
        isSending={isSendingMessage}
        error={messageError}
        defaultAttachmentExpanded={defaultAttachmentExpanded}
        loadExternalMediaPreviews={loadExternalMediaPreviews}
        horizontalVideoCardSize={horizontalVideoCardSize}
        verticalVideoCardSize={verticalVideoCardSize}
        messageDisplayFormat={messageDisplayFormat}
        messageBubbleAlignment={messageBubbleAlignment}
        messageBubbleWidth={messageBubbleWidth}
        onSendMessage={onSendMessage}
        onUpdateMessage={onUpdateMessage}
        onDeleteMessage={onDeleteMessage}
        onPinMessage={onPinMessage}
        onUnpinMessage={onUnpinMessage}
        onSetMessageReaction={onSetMessageReaction}
        onMarkRead={onMarkMessagesRead}
        onLoadMessageWindow={onLoadMessageWindow}
        onLoadOlderMessages={onLoadOlderMessages}
        focusedMessageId={focusedMessageId}
      />
    )
  }

  if (visibleChannel?.kind === 'voice' && visibleChannel.spaceId) {
    const voiceSpaceId = visibleChannel.spaceId
    const voiceSpaceTitle = visibleChannel.title
    const voiceMessageSpaceId = selectedSpace?.voiceChatSpaceId ?? null
    const isConnectedToVoiceChannel =
      voice.connectedChannel?.channelScope === 'server' &&
      voice.connectedChannel.serverId === server.id &&
      voice.connectedChannel.spaceId === voiceSpaceId

    return (
      <ServerVoiceChannel
        accessToken={accessToken}
        workspaceKey={`${server.id}:${voiceSpaceId}`}
        currentUserId={user.id}
        localParticipantId={voice.localParticipantId}
        leadingAction={
          <button
            className={styles.serverTextBack}
            type="button"
            onClick={onCloseDetail}
            aria-label={serverCopy.navigation.backToServerSpaces}
          >
            <SystemIcon name="back" size={22} />
          </button>
        }
        title={voiceSpaceTitle}
        isVoiceChatOpen={isVoiceChatOpen}
        onToggleVoiceChat={() => onToggleVoiceChat(voiceSpaceId)}
        headerActions={
          <MembersPanelToggleButton
            panelId={membersPanelId}
            isCollapsed={isMembersPanelCollapsed}
            onToggle={onToggleMembersPanel}
          />
        }
        voiceChat={{
          feedKey: `${server.id}:${voiceMessageSpaceId ?? voiceSpaceId}:voice-chat`,
          title: voiceSpaceTitle,
          currentUserId: user.id,
          canManageMessages: canManageSpace(selectedSpace),
          canSendMessages: canSendMessagesToSpace(selectedSpace),
          mentionUsers: mentionCandidates.users,
          mentionRoles: mentionCandidates.roles,
          mentionInsertionRequest,
          onMentionInsertionRequestHandled,
          onResolveMentionCandidates,
          reportContext: {
            accessToken,
            serverId: server.id,
            spaceId: voiceMessageSpaceId ?? voiceSpaceId,
          },
          messages,
          unreadCount: selectedSpace?.unreadCount ?? 0,
          pinnedMessages,
          isLoading: isLoadingMessages,
          isLoadingOlderMessages,
          hasOlderMessages,
          isLoadingPinnedMessages,
          isSending: isSendingMessage,
          error: messageError,
          defaultAttachmentExpanded,
          loadExternalMediaPreviews,
          horizontalVideoCardSize,
          verticalVideoCardSize,
          messageDisplayFormat,
          messageBubbleAlignment,
          messageBubbleWidth,
          onSendMessage,
          onUpdateMessage,
          onDeleteMessage,
          onPinMessage,
          onUnpinMessage,
          onSetMessageReaction,
          onMarkRead: onMarkMessagesRead,
          onLoadMessageWindow,
          onLoadOlderMessages,
        }}
        participants={voice.participantsBySpaceId[voiceSpaceId] ?? []}
        serverMembers={serverMembers}
        localCameraPreviewStream={voice.localCameraPreviewStream}
        localScreenPreviewStream={voice.localScreenPreviewStream}
        remoteStreamsByParticipantId={voice.remoteStreamsByParticipantId}
        peerStatusesByParticipantId={voice.peerStatusesByParticipantId}
        speakingParticipantIds={voice.speakingParticipantIds}
        error={voice.voiceError}
        isMuted={voice.isMuted}
        isDeafened={voice.isDeafened}
        isConnectedToVoiceChannel={isConnectedToVoiceChannel}
        canConnectVoice={canConnectToVoiceSpace(selectedSpace)}
        isCameraEnabled={voice.isCameraEnabled}
        isScreenSharing={voice.isScreenSharing}
        playbackStatesByParticipantId={voicePlaybackStatesByParticipantId}
        audioSettingsByUserId={voiceAudioSettingsByUserId}
        onOpenParticipantContextMenu={(event, participant, workspaceActions) =>
          onOpenVoiceParticipantContextMenu(
            event,
            participant,
            voiceSpaceId,
            workspaceActions,
          )
        }
        onToggleMuted={voice.toggleMuted}
        onToggleDeafened={voice.toggleDeafened}
        onToggleCamera={voice.toggleCamera}
        onToggleScreenShare={voice.toggleScreenShare}
        onLeaveVoiceChannel={voice.leaveVoiceChannel}
        onJoinVoiceChannel={() => {
          if (!canConnectToVoiceSpace(selectedSpace)) {
            return
          }

          void voice.joinVoiceChannel({
            serverId: server.id,
            spaceId: voiceSpaceId,
            title: voiceSpaceTitle,
            channelScope: 'server',
          })
        }}
        onOpenSettings={() => undefined}
      />
    )
  }

  return (
    <ServerChannelPlaceholder
      serverTitle={server.title}
      title={visibleChannel?.title}
      kind={visibleChannel?.kind}
    />
  )
}

function MembersPanelToggleButton({
  panelId,
  isCollapsed,
  onToggle,
}: {
  panelId: string
  isCollapsed: boolean
  onToggle: () => void
}) {
  const disclosure = getServerMembersPanelDisclosure(isCollapsed)

  return (
    <button
      className={`${styles.membersPanelToggle} ${
        isCollapsed ? styles.membersPanelToggleCollapsed : ''
      }`}
      type="button"
      aria-label={disclosure.toggleLabel}
      aria-controls={panelId}
      aria-expanded={disclosure.toggleExpanded}
      data-tooltip={disclosure.toggleLabel}
      title={disclosure.toggleLabel}
      onClick={onToggle}
    >
      <SystemIcon name="chevron-right" size={18} />
    </button>
  )
}
