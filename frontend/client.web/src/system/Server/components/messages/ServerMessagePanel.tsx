import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import type {
  MessageDisplayFormat,
  PrivateDeletedMessageResponse,
  PrivateMessageDeletionScope,
  SpaceMentionCandidatesResponse,
  SpaceMessageAssetResponse,
  SpaceMessageMentionRequest,
  SpaceMessageResponse,
  SpaceReadStateResponse,
  UpdateSpaceMessageRequest,
} from '../../../../shared/types'
import type { ContextMenuItem } from '../../../shared/components/context-menu/ContextMenu'
import {
  communityCopy,
  defaultMessageBubbleAlignment,
  defaultMessageBubbleWidth,
  serverCopy,
} from '../../../shared'
import type {
  MessageBubbleAlignment,
  MessageBubbleWidth,
} from '../../../shared'
import { useContextMenuDismiss } from '../../../shared/hooks/useContextMenuDismiss'
import workspaceStyles from '../shell/ServerWorkspace.module.css'
import styles from './ServerMessageLayout.module.css'
import panelStyles from './ServerMessagePanel.module.css'
import {
  MessageComposer,
  type MessageComposerMentionInsertionRequest,
} from './MessageComposer'
import type { MessageAttachmentDraft } from './messageAttachmentDraft'
import { getScrollToBottomPlacement } from './messageAttachmentLayoutModel'
import {
  canDeleteMessage,
  canEditMessage,
  canShowEditMessageAction,
} from './messageMutationPermissions'
import {
  curatedMessageReactions,
  shouldAddMessageReaction,
} from './messageReactionModel'
import {
  MessagePanelOverlays,
  type MessageAssetPreviewState,
  type MessageContextMenuState,
} from './MessagePanelOverlays'
import { PinnedMessagesPanel } from './PinnedMessagesPanel'
import { DeletedMessagesPanel } from './DeletedMessagesPanel'
import { ServerMessageHeader } from './ServerMessageHeader'
import { ServerMessageTimeline } from './ServerMessageTimeline'
import { useMessageAssetDrop } from './useMessageAssetDrop'
import { useMessageFeedNavigation } from './useMessageFeedNavigation'
import { useMessageReadMarker } from './useMessageReadMarker'
import {
  getAttachmentDownloadWarning,
  triggerAssetDownload,
  type DownloadWarningState,
} from './messageUtils'
import { canConfirmAttachmentDownload } from './downloadWarningDelayModel'
import { loadAttachmentSecuritySettings } from '../../../../shared/security/attachmentSecuritySettings'
import {
  canReportServerMessage,
  type ServerMessageReportContext,
} from '../../../Moderation/models/messageReportModel'
import {
  getPrivateMessageDeletionScopes,
  isPrivateMessageRestorable,
  isVisiblePrivateMessage,
} from '../../../shared/messages/privateMessageDeletionModel'
import {
  buildMentionSuggestions,
  discoverDraftMentions,
  findUnresolvedMentionCandidateQueries,
  prepareMessageWithMentions,
  type DraftMention,
  type MentionRoleCandidate,
  type MentionUserCandidate,
} from './mentions'

type PrivateMessageTrashConfig = {
  messages: PrivateDeletedMessageResponse[]
  isLoading: boolean
  isLoadingOlder: boolean
  hasOlder: boolean
  isClearing: boolean
  error: string | null
  restoringMessageId: string | null
  onRestoreMessage: (messageId: string) => Promise<boolean>
  onLoadOlder: () => Promise<boolean>
  onClear: () => Promise<boolean>
}

export type ServerMessagePanelProps = {
  feedKey: string
  title: string
  currentUserId: string
  canManageMessages: boolean
  canSendMessages: boolean
  mentionUsers: readonly MentionUserCandidate[]
  mentionRoles: readonly MentionRoleCandidate[]
  mentionInsertionRequest?: MessageComposerMentionInsertionRequest | null
  onMentionInsertionRequestHandled?: (requestId: number) => void
  onResolveMentionCandidates?: (
    query?: string,
    signal?: AbortSignal,
  ) => Promise<SpaceMentionCandidatesResponse>
  canPinMessages?: boolean
  reportContext?: ServerMessageReportContext | null
  leadingAction?: ReactNode
  titleIcon?: ReactNode
  titleAccessory?: ReactNode
  headerActions?: ReactNode
  privateMessageTrash?: PrivateMessageTrashConfig
  pendingDroppedFiles?: {
    id: string
    files: File[]
  } | null
  messages: SpaceMessageResponse[]
  pinnedMessages: SpaceMessageResponse[]
  isLoading: boolean
  isLoadingOlderMessages?: boolean
  hasOlderMessages?: boolean
  isLoadingPinnedMessages: boolean
  isSending: boolean
  error: string | null
  onSendMessage: (
    body: string,
    attachments?: MessageAttachmentDraft[],
    replyToMessageId?: string | null,
    mentions?: SpaceMessageMentionRequest[],
  ) => Promise<SpaceMessageResponse | null>
  onUpdateMessage: (
    messageId: string,
    request: UpdateSpaceMessageRequest,
  ) => Promise<SpaceMessageResponse | null>
  onDeleteMessage: (
    messageId: string,
    scope?: PrivateMessageDeletionScope,
  ) => Promise<boolean>
  onPinMessage: (messageId: string) => Promise<SpaceMessageResponse | null>
  onSetMessageReaction: (
    messageId: string,
    emojiCode: string,
    isPresent: boolean,
  ) => Promise<SpaceMessageResponse | null>
  onMarkRead?: (
    throughMessageId: string,
  ) => Promise<SpaceReadStateResponse | null>
  onLoadOlderMessages?: () => Promise<boolean>
  onPendingDroppedFilesConsumed?: (id: string) => void
  focusedMessageId?: string | null
  isReadingHistory?: boolean
  defaultAttachmentExpanded?: boolean
  loadExternalMediaPreviews?: boolean
  horizontalVideoCardSize?: number
  verticalVideoCardSize?: number
  invitePreviewAccessToken?: string | null
  invitePreviewOrigin?: string | null
  showPrivateMessageReceipts?: boolean
  messageDisplayFormat?: MessageDisplayFormat
  messageBubbleAlignment?: MessageBubbleAlignment
  messageBubbleWidth?: MessageBubbleWidth
}

export function ServerMessagePanel({
  feedKey,
  title,
  currentUserId,
  canManageMessages,
  canSendMessages,
  mentionUsers,
  mentionRoles,
  mentionInsertionRequest,
  onMentionInsertionRequestHandled,
  onResolveMentionCandidates,
  canPinMessages = canManageMessages,
  reportContext = null,
  leadingAction,
  titleIcon,
  titleAccessory,
  headerActions,
  privateMessageTrash,
  pendingDroppedFiles,
  messages,
  pinnedMessages,
  isLoading,
  isLoadingPinnedMessages,
  isLoadingOlderMessages = false,
  hasOlderMessages = false,
  isSending,
  error,
  onSendMessage,
  onUpdateMessage,
  onDeleteMessage,
  onPinMessage,
  onSetMessageReaction,
  onMarkRead,
  onLoadOlderMessages,
  onPendingDroppedFilesConsumed,
  focusedMessageId,
  isReadingHistory = false,
  defaultAttachmentExpanded = false,
  loadExternalMediaPreviews = true,
  horizontalVideoCardSize = 3,
  verticalVideoCardSize = 3,
  invitePreviewAccessToken,
  invitePreviewOrigin,
  showPrivateMessageReceipts = false,
  messageDisplayFormat = 'wall-scroll',
  messageBubbleAlignment = defaultMessageBubbleAlignment,
  messageBubbleWidth = defaultMessageBubbleWidth,
}: ServerMessagePanelProps) {
  const [draft, setDraft] = useState('')
  const [draftMentions, setDraftMentions] = useState<DraftMention[]>([])
  const [selectedAttachments, setSelectedAttachments] = useState<
    MessageAttachmentDraft[]
  >([])
  const [editingMessage, setEditingMessage] =
    useState<SpaceMessageResponse | null>(null)
  const [replyTarget, setReplyTarget] =
    useState<SpaceMessageResponse | null>(null)
  const [messageContextMenu, setMessageContextMenu] =
    useState<MessageContextMenuState | null>(null)
  const [reportRequest, setReportRequest] = useState<{
    feedKey: string
    message: SpaceMessageResponse
  } | null>(null)
  const [downloadWarning, setDownloadWarning] =
    useState<DownloadWarningState | null>(null)
  const [isPinnedPanelOpen, setIsPinnedPanelOpen] = useState(false)
  const [isTrashPanelOpen, setIsTrashPanelOpen] = useState(false)
  const [isPreparingSubmit, setIsPreparingSubmit] = useState(false)
  const [trashNow, setTrashNow] = useState(() => Date.now())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const trashToggleRef = useRef<HTMLButtonElement | null>(null)
  const isPreparingSubmitRef = useRef(false)
  const isConfirmingAssetDownloadRef = useRef(false)
  const draftRef = useRef(draft)
  const selectedAttachmentsRef = useRef(selectedAttachments)
  const editingMessageRef = useRef(editingMessage)
  const replyTargetRef = useRef(replyTarget)
  const isPrivateMessageFeed = Boolean(privateMessageTrash)
  const privateTrashMessages = privateMessageTrash?.messages ?? null
  const displayedMessages = useMemo(
    () =>
      isPrivateMessageFeed
        ? messages.filter(isVisiblePrivateMessage)
        : messages,
    [isPrivateMessageFeed, messages],
  )
  const displayedPinnedMessages = useMemo(
    () =>
      isPrivateMessageFeed
        ? pinnedMessages.filter(isVisiblePrivateMessage)
        : pinnedMessages,
    [isPrivateMessageFeed, pinnedMessages],
  )
  const displayedMessageIds = useMemo(
    () => new Set(displayedMessages.map((message) => message.id)),
    [displayedMessages],
  )
  const activeTrashMessages = useMemo(
    () =>
      privateTrashMessages?.filter((deletion) =>
        isPrivateMessageRestorable(deletion, trashNow),
      ) ?? [],
    [privateTrashMessages, trashNow],
  )
  const hasComposerAsset = selectedAttachments.length > 0
  const hasComposerContent = draft.trim().length > 0 || hasComposerAsset
  const canUseComposer = editingMessage
    ? canEditMessage(editingMessage, currentUserId, canSendMessages)
    : canSendMessages
  const isComposerBusy = isSending || isPreparingSubmit
  const [previewAsset, setPreviewAsset] =
    useState<MessageAssetPreviewState | null>(null)

  useEffect(() => {
    draftRef.current = draft
    selectedAttachmentsRef.current = selectedAttachments
    editingMessageRef.current = editingMessage
    replyTargetRef.current = replyTarget
  }, [draft, editingMessage, replyTarget, selectedAttachments])

  useEffect(() => {
    if (!privateTrashMessages) {
      return undefined
    }

    const nextRestoreDeadline = privateTrashMessages
      .map((deletion) => Date.parse(deletion.restoreUntil))
      .filter((deadline) => Number.isFinite(deadline) && deadline > trashNow)
      .sort((left, right) => left - right)[0]

    if (nextRestoreDeadline == null) {
      return undefined
    }

    const timeoutId = window.setTimeout(
      () => setTrashNow(Date.now()),
      Math.min(Math.max(nextRestoreDeadline - Date.now() + 50, 50), 60_000),
    )

    return () => window.clearTimeout(timeoutId)
  }, [privateTrashMessages, trashNow])

  useEffect(() => {
    if (isTrashPanelOpen && activeTrashMessages.length === 0) {
      setIsTrashPanelOpen(false)
    }
  }, [activeTrashMessages.length, isTrashPanelOpen])

  useEffect(() => {
    if (
      editingMessage &&
      !displayedMessageIds.has(editingMessage.id)
    ) {
      setEditingMessage(null)
      setDraft('')
      setDraftMentions([])
    }

    if (replyTarget && !displayedMessageIds.has(replyTarget.id)) {
      setReplyTarget(null)
    }

    if (
      messageContextMenu &&
      !displayedMessageIds.has(messageContextMenu.message.id)
    ) {
      setMessageContextMenu(null)
    }
  }, [displayedMessageIds, editingMessage, messageContextMenu, replyTarget])
  const {
    feedRef,
    canScrollToBottom,
    isNearBottom,
    highlightedMessageId,
    jumpToMessage,
    scrollMessagesToBottom,
    stickToBottom,
    updateScrollState,
  } = useMessageFeedNavigation({
    feedKey,
    messageCount: displayedMessages.length,
    focusedMessageId,
    hasOlderMessages,
    isLoadingOlderMessages,
    onLoadOlderMessages,
  })
  useMessageReadMarker({
    feedKey,
    messages: displayedMessages,
    isLoading,
    isNearBottom,
    isReadingHistory: isReadingHistory || Boolean(focusedMessageId),
    onMarkRead,
  })
  const {
    isAssetDropActive,
    addSelectedFiles,
    activateAssetDrop,
    deactivateAssetDrop,
    dropAssets,
    keepAssetDropActive,
  } = useMessageAssetDrop({
    isSending: isComposerBusy,
    isEditing: Boolean(editingMessage),
    isDisabled: !canSendMessages,
    pendingDroppedFiles,
    fileInputRef,
    setSelectedAttachments,
    onPendingDroppedFilesConsumed,
  })

  useContextMenuDismiss(Boolean(messageContextMenu), () =>
    setMessageContextMenu(null),
  )

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const canSubmit = editingMessage
      ? canEditMessage(editingMessage, currentUserId, canSendMessages)
      : canSendMessages
    if (!canSubmit || isPreparingSubmitRef.current) {
      return
    }

    isPreparingSubmitRef.current = true
    setIsPreparingSubmit(true)
    const submittedDraft = draft
    const submittedDraftMentions = draftMentions
    const submittedAttachments = selectedAttachments
    const submittedEditingMessage = editingMessage
    const submittedReplyTarget = replyTarget
    try {
      let resolvedMentionUsers = mentionUsers
      let resolvedMentionRoles = mentionRoles
      if (onResolveMentionCandidates) {
        const unresolvedQueries = findUnresolvedMentionCandidateQueries(
          submittedDraft,
          submittedDraftMentions,
        )
        for (const query of unresolvedQueries) {
          const candidates = await onResolveMentionCandidates(query)
          resolvedMentionUsers = candidates.users
          resolvedMentionRoles = candidates.roles
        }
      }
      const allMentionSuggestions = buildMentionSuggestions({
        query: '',
        users: resolvedMentionUsers,
        roles: resolvedMentionRoles,
        maximumUsers: resolvedMentionUsers.length,
      })
      const allMentionOptions = [
        ...(allMentionSuggestions.everyone
          ? [allMentionSuggestions.everyone]
          : []),
        ...allMentionSuggestions.users,
        ...allMentionSuggestions.roles,
      ]
      const resolvedDraftMentions = discoverDraftMentions(
        submittedDraft,
        allMentionOptions,
        submittedDraftMentions,
      )
      if (draftRef.current === submittedDraft) {
        setDraftMentions(resolvedDraftMentions)
      }
      const preparedMessage = prepareMessageWithMentions(
        submittedDraft,
        resolvedDraftMentions,
      )

      if (submittedEditingMessage) {
        const message = await onUpdateMessage(submittedEditingMessage.id, {
          body: preparedMessage.body,
          clearPayload: true,
          mentions: [...preparedMessage.mentions],
        })

        if (message) {
          if (draftRef.current === submittedDraft) {
            setDraft('')
            setDraftMentions([])
            if (editingMessageRef.current?.id === submittedEditingMessage.id) {
              setEditingMessage(null)
            }
          }
        }

        return
      }

      const message = await onSendMessage(
        preparedMessage.body,
        submittedAttachments,
        submittedReplyTarget?.id ?? null,
        [...preparedMessage.mentions],
      )

      if (message) {
        if (draftRef.current === submittedDraft) {
          setDraft('')
          setDraftMentions([])
        }
        if (selectedAttachmentsRef.current === submittedAttachments) {
          setSelectedAttachments([])
        }
        if (
          (replyTargetRef.current?.id ?? null) ===
          (submittedReplyTarget?.id ?? null)
        ) {
          setReplyTarget(null)
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        stickToBottom()
        scrollMessagesToBottom('smooth')
      }
    } finally {
      isPreparingSubmitRef.current = false
      setIsPreparingSubmit(false)
    }
  }

  function openFilePicker() {
    if (!canSendMessages || !fileInputRef.current) {
      return
    }

    fileInputRef.current.value = ''
    fileInputRef.current.click()
  }

  const requestAssetDownload = useCallback((asset: SpaceMessageAssetResponse) => {
    const url = `/api/assets/${asset.assetId}/content`
    const warning = getAttachmentDownloadWarning(asset)

    if (!warning || !loadAttachmentSecuritySettings().warnAboutPotentiallyDangerousFiles) {
      triggerAssetDownload(url, asset.fileName)
      return
    }

    setDownloadWarning({
      asset,
      url,
      title: warning.title,
      body: warning.body,
      openedAtMs: performance.now(),
    })
    isConfirmingAssetDownloadRef.current = false
  }, [])

  function confirmAssetDownload() {
    if (
      !downloadWarning ||
      isConfirmingAssetDownloadRef.current ||
      !canConfirmAttachmentDownload(
        downloadWarning.openedAtMs,
        performance.now(),
      )
    ) {
      return
    }

    isConfirmingAssetDownloadRef.current = true
    setDownloadWarning(null)
    triggerAssetDownload(downloadWarning.url, downloadWarning.asset.fileName)
  }

  const openMessageContextMenu = useCallback((
    message: SpaceMessageResponse,
    x: number,
    y: number,
    focusOnOpen: boolean,
  ) => {
    setMessageContextMenu({
      message,
      x,
      y,
      focusOnOpen,
    })
  }, [])

  const openMessagePreview = useCallback((
    asset: SpaceMessageAssetResponse,
    message: SpaceMessageResponse,
  ) => {
    setPreviewAsset({ asset, message })
  }, [])

  const scrollTimelineToBottom = useCallback(() => {
    stickToBottom()
    scrollMessagesToBottom('smooth')
  }, [scrollMessagesToBottom, stickToBottom])

  function startEditingMessage(message: SpaceMessageResponse) {
    if (!canEditMessage(message, currentUserId, canSendMessages)) {
      return
    }

    setEditingMessage(message)
    setReplyTarget(null)
    setSelectedAttachments([])
    setDraft(message.body ?? '')
    setDraftMentions(
      (message.mentions ?? []).map((mention) => ({
        kind: mention.kind,
        targetId: mention.targetUserId ?? mention.targetRoleId,
        token: (message.body ?? '').slice(
          mention.start,
          mention.start + mention.length,
        ),
        start: mention.start,
        length: mention.length,
      })),
    )
  }

  function getMessageContextItems(): ContextMenuItem[] {
    if (!messageContextMenu) {
      return []
    }

    const { message } = messageContextMenu
    const isDeleted = Boolean(message.deletedAt)
    const canShowEdit = canShowEditMessageAction(
      message,
      currentUserId,
      canSendMessages,
    )
    const canDelete = canDeleteMessage(
      message,
      currentUserId,
      canSendMessages,
      canManageMessages,
    )
    const privateDeletionScopes = privateMessageTrash
      ? getPrivateMessageDeletionScopes(message, currentUserId)
      : []

    const items: ContextMenuItem[] = [
      {
        type: 'item',
        label: serverCopy.messages.addReaction,
        disabled: isDeleted || !canSendMessages,
        submenuLayout: 'grid',
        submenu: curatedMessageReactions.map((reaction) => {
          const shouldAdd = shouldAddMessageReaction(
            message.reactions,
            reaction.emojiCode,
          )

          return {
            type: 'item',
            label: reaction.label,
            visualLabel: reaction.emojiCode,
            compact: true,
            selected: !shouldAdd,
            onSelect: () =>
              void onSetMessageReaction(
                message.id,
                reaction.emojiCode,
                shouldAdd,
              ),
          }
        }),
      },
    ]

    if (canShowEdit) {
      items.push({
        type: 'item',
        label: serverCopy.messages.contextEdit,
        icon: 'edit',
        onSelect: () => startEditingMessage(message),
      })
    }

    items.push(
      {
        type: 'item',
        label: serverCopy.messages.contextReply,
        icon: 'message',
        disabled: isDeleted || !canSendMessages,
        onSelect: () => {
          if (editingMessage) {
            setDraft('')
            setDraftMentions([])
          }
          setEditingMessage(null)
          setReplyTarget(message)
        },
      },
      {
        type: 'item',
        label: serverCopy.messages.contextCopy,
        icon: 'copy',
        disabled: !message.body,
        onSelect: () => void navigator.clipboard?.writeText(message.body ?? ''),
      },
      {
        type: 'item',
        label: serverCopy.messages.contextPin,
        icon: 'space',
        disabled: isDeleted || !canPinMessages,
        onSelect: () => void onPinMessage(message.id),
      },
    )

    if (
      canReportServerMessage({
        context: reportContext,
        currentUserId,
        message,
      })
    ) {
      items.push(
        { type: 'separator' },
        {
          type: 'item',
          label: serverCopy.messages.contextReport,
          icon: 'report',
          onSelect: () => setReportRequest({ feedKey, message }),
        },
      )
    }

    if (privateMessageTrash && privateDeletionScopes.length > 0) {
      items.push({
        type: 'item',
        label: serverCopy.messages.contextDelete,
        icon: 'trash',
        danger: true,
        submenu: privateDeletionScopes.map((scope) => ({
          type: 'item' as const,
          label:
            scope === 'everyone'
              ? communityCopy.direct.deleteForEveryone
              : communityCopy.direct.deleteForMe,
          icon: 'trash' as const,
          danger: true,
          onSelect: () => void onDeleteMessage(message.id, scope),
        })),
      })
    } else if (canDelete) {
      items.push({
        type: 'item',
        label: serverCopy.messages.contextDelete,
        icon: 'trash',
        danger: true,
        onSelect: () => void onDeleteMessage(message.id),
      })
    }

    return items
  }

  function cancelComposerMode() {
    setEditingMessage(null)
    setReplyTarget(null)
    setDraft('')
    setDraftMentions([])
  }

  return (
    <>
      <section
        className={`${workspaceStyles.chatSurface} ${workspaceStyles.textSurface} ${styles.chatSurface} ${styles.textSurface}`}
        data-pins-open={isPinnedPanelOpen ? 'true' : 'false'}
        onDragEnter={activateAssetDrop}
        onDragLeave={deactivateAssetDrop}
        onDragOver={keepAssetDropActive}
        onDrop={dropAssets}
      >
      <div
        className={`${workspaceStyles.textMain} ${styles.textMain}`}
        data-has-attachments={selectedAttachments.length > 0 ? 'true' : 'false'}
        data-scroll-bottom-placement={getScrollToBottomPlacement(
          selectedAttachments.length,
        )}
      >
        <ServerMessageHeader
          title={title}
          titleIcon={titleIcon}
          titleAccessory={titleAccessory}
          leadingAction={leadingAction}
          headerActions={headerActions}
          pinnedMessageCount={displayedPinnedMessages.length}
          isPinnedPanelOpen={isPinnedPanelOpen}
          onTogglePinnedPanel={() => {
            setIsTrashPanelOpen(false)
            setIsPinnedPanelOpen((current) => !current)
          }}
          trashMessageCount={activeTrashMessages.length}
          trashHasMore={privateMessageTrash?.hasOlder}
          isTrashPanelOpen={isTrashPanelOpen}
          onToggleTrashPanel={
            privateMessageTrash
              ? () => {
                  setIsPinnedPanelOpen(false)
                  setIsTrashPanelOpen((current) => !current)
                }
              : undefined
          }
          trashToggleRef={trashToggleRef}
        />

        <ServerMessageTimeline
          feedKey={feedKey}
          feedRef={feedRef}
          messages={displayedMessages}
          isLoading={isLoading}
          isLoadingOlder={isLoadingOlderMessages}
          highlightedMessageId={highlightedMessageId}
          canScrollToBottom={canScrollToBottom}
          onScroll={updateScrollState}
          onScrollToBottom={scrollTimelineToBottom}
          onJumpToMessage={jumpToMessage}
          onOpenPreview={openMessagePreview}
          onRequestDownload={requestAssetDownload}
          onContextMenu={openMessageContextMenu}
          defaultAttachmentExpanded={defaultAttachmentExpanded}
          loadExternalMediaPreviews={loadExternalMediaPreviews}
          horizontalVideoCardSize={horizontalVideoCardSize}
          verticalVideoCardSize={verticalVideoCardSize}
          canReact={canSendMessages}
          invitePreviewAccessToken={invitePreviewAccessToken}
          invitePreviewOrigin={invitePreviewOrigin}
          privateMessageReceiptViewerUserId={
            showPrivateMessageReceipts ? currentUserId : null
          }
          currentUserId={currentUserId}
          messageDisplayFormat={messageDisplayFormat}
          messageBubbleAlignment={messageBubbleAlignment}
          messageBubbleWidth={messageBubbleWidth}
          onSetReaction={onSetMessageReaction}
        />

        <MessageComposer
          title={title}
          draft={draft}
          draftMentions={draftMentions}
          mentionUsers={mentionUsers}
          mentionRoles={mentionRoles}
          mentionInsertionRequest={mentionInsertionRequest}
          onMentionInsertionRequestHandled={onMentionInsertionRequestHandled}
          onRefreshMentionCandidates={
            onResolveMentionCandidates
              ? (query, signal) => {
                  void onResolveMentionCandidates(query, signal)
                }
              : undefined
          }
          editingMessage={editingMessage}
          fileInputRef={fileInputRef}
          hasComposerContent={hasComposerContent}
          isSending={isComposerBusy}
          canSendMessages={canUseComposer}
          replyTarget={replyTarget}
          selectedAttachments={selectedAttachments}
          onAddSelectedFiles={addSelectedFiles}
          onCancelComposerMode={cancelComposerMode}
          onCancelReply={() => setReplyTarget(null)}
          onOpenFilePicker={openFilePicker}
          onChangeSelectedAttachments={setSelectedAttachments}
          onSetDraft={setDraft}
          onSetDraftMentions={setDraftMentions}
          onSubmitMessage={submitMessage}
        />
        {error && <p className={styles.textError}>{error}</p>}
      </div>

      <PinnedMessagesPanel
        isOpen={isPinnedPanelOpen}
        isLoading={isLoadingPinnedMessages}
        messages={displayedPinnedMessages}
        onJumpToMessage={jumpToMessage}
        onRequestDownload={requestAssetDownload}
        onClose={() => setIsPinnedPanelOpen(false)}
      />
      {privateMessageTrash ? (
        <DeletedMessagesPanel
          isOpen={isTrashPanelOpen}
          isLoading={privateMessageTrash.isLoading}
          isLoadingOlder={privateMessageTrash.isLoadingOlder}
          hasOlder={privateMessageTrash.hasOlder}
          isClearing={privateMessageTrash.isClearing}
          messages={activeTrashMessages}
          error={privateMessageTrash.error}
          restoringMessageId={privateMessageTrash.restoringMessageId}
          now={trashNow}
          onRestore={(messageId) =>
            void privateMessageTrash.onRestoreMessage(messageId)
          }
          onLoadOlder={() => void privateMessageTrash.onLoadOlder()}
          onClear={() => {
            void privateMessageTrash.onClear()
          }}
          onClose={() => {
            setIsTrashPanelOpen(false)
            window.requestAnimationFrame(() => trashToggleRef.current?.focus())
          }}
        />
      ) : null}
      <MessagePanelOverlays
        messageContextMenu={messageContextMenu}
        messageContextItems={getMessageContextItems()}
        previewAsset={previewAsset}
        downloadWarning={downloadWarning}
        reportContext={reportContext}
        reportMessage={
          reportRequest?.feedKey === feedKey
            ? reportRequest.message
            : null
        }
        onCloseMessageContextMenu={() => setMessageContextMenu(null)}
        onClosePreview={() => setPreviewAsset(null)}
        onCloseDownloadWarning={() => setDownloadWarning(null)}
        onCloseReport={() => setReportRequest(null)}
        onConfirmAssetDownload={confirmAssetDownload}
      />
      {isAssetDropActive && (
        <div className={panelStyles.assetDropOverlay} aria-live="polite">
          <div className={panelStyles.assetDropDialog}>
            <strong>{serverCopy.messages.loadFileIntoSpace(title)}</strong>
          </div>
        </div>
      )}
      </section>
    </>
  )
}
