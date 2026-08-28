import {
  memo,
  type RefObject,
} from 'react'
import type {
  MessageDisplayFormat,
  SpaceMessageAssetResponse,
  SpaceMessageResponse,
} from '../../../../shared/types'
import {
  serverCopy,
  startsMessageBubbleSequence,
} from '../../../shared'
import type {
  MessageBubbleAlignment,
  MessageBubbleWidth,
} from '../../../shared'
import { SystemSkeleton } from '../../../shared/ui/SystemSkeleton'
import workspaceStyles from '../shell/ServerWorkspace.module.css'
import styles from './ServerMessageLayout.module.css'
import { MessageRow } from './MessageRow'
import { getMessageDayKey } from './messageUtils'

const messageSkeletonRows = Array.from({ length: 14 }, (_, index) => ({
  key: `message-${index + 1}`,
  textWidth: ['62%', '44%', '71%', '52%'][index % 4],
  titleWidth: index % 2 === 0 ? 132 : 104,
}))

type ServerMessageTimelineProps = {
  feedKey: string
  feedRef: RefObject<HTMLDivElement | null>
  messages: SpaceMessageResponse[]
  isLoading: boolean
  isLoadingOlder: boolean
  highlightedMessageId: string | null
  canScrollToBottom: boolean
  onScroll: () => void
  onScrollToBottom: () => void
  scrollToBottomLabel: string
  onJumpToMessage: (messageId: string, createdAt?: string | null) => void
  onOpenPreview: (
    asset: SpaceMessageAssetResponse,
    message: SpaceMessageResponse,
  ) => void
  onRequestDownload: (asset: SpaceMessageAssetResponse) => void
  onContextMenu: (
    message: SpaceMessageResponse,
    x: number,
    y: number,
    focusOnOpen: boolean,
  ) => void
  defaultAttachmentExpanded: boolean
  loadExternalMediaPreviews: boolean
  horizontalVideoCardSize: number
  verticalVideoCardSize: number
  canReact: boolean
  invitePreviewAccessToken?: string | null
  invitePreviewOrigin?: string | null
  privateMessageReceiptViewerUserId?: string | null
  currentUserId: string
  messageDisplayFormat: MessageDisplayFormat
  messageBubbleAlignment: MessageBubbleAlignment
  messageBubbleWidth: MessageBubbleWidth
  onSetReaction: (
    messageId: string,
    emojiCode: string,
    isPresent: boolean,
  ) => Promise<SpaceMessageResponse | null>
}

export const ServerMessageTimeline = memo(function ServerMessageTimeline({
  feedRef,
  messages,
  isLoading,
  isLoadingOlder,
  highlightedMessageId,
  canScrollToBottom,
  onScroll,
  onScrollToBottom,
  scrollToBottomLabel,
  onJumpToMessage,
  onOpenPreview,
  onRequestDownload,
  onContextMenu,
  defaultAttachmentExpanded,
  loadExternalMediaPreviews,
  horizontalVideoCardSize,
  verticalVideoCardSize,
  canReact,
  invitePreviewAccessToken,
  invitePreviewOrigin,
  privateMessageReceiptViewerUserId,
  currentUserId,
  messageDisplayFormat,
  messageBubbleAlignment,
  messageBubbleWidth,
  onSetReaction,
}: ServerMessageTimelineProps) {
  const isInitialLoading = isLoading && messages.length === 0

  return (
    <>
      <div
        className={`${workspaceStyles.textFeed} ${styles.textFeed}`}
        ref={feedRef}
        onScroll={onScroll}
        aria-live="polite"
        aria-busy={isInitialLoading}
      >
        {isLoadingOlder ? (
          <p className={styles.loadingOlderMessages} aria-live="polite">
            {serverCopy.messages.loadingOlder}
          </p>
        ) : null}
        {isInitialLoading ? (
          <div className={styles.messageSkeletonList}>
            {messageSkeletonRows.map((row) => (
              <div className={styles.messageSkeletonRow} key={row.key}>
                <SystemSkeleton
                  className={styles.messageSkeletonAvatar}
                  size={42}
                  variant="circle"
                />
                <span className={styles.messageSkeletonContent}>
                  <SystemSkeleton
                    height={11}
                    variant="text"
                    width={row.titleWidth}
                  />
                  <SystemSkeleton
                    height={12}
                    variant="text"
                    width={row.textWidth}
                  />
                </span>
              </div>
            ))}
          </div>
        ) : messages.length > 0 ? (
          messages.map((message, index) => {
            const previous = messages[index - 1] ?? null
            const currentDay = getMessageDayKey(message.createdAt)
            const previousDay = previous
              ? getMessageDayKey(previous.createdAt)
              : null
            const startsNewDay = currentDay !== previousDay
            const currentIsEvent = message.messageTypeCode === 'event'
            const previousIsEvent = previous?.messageTypeCode === 'event'
            const startsNewAuthor =
              startsNewDay ||
              currentIsEvent ||
              previousIsEvent ||
              previous?.senderUserId !== message.senderUserId ||
              Boolean(message.replyTo) ||
              Boolean(message.mentions?.length)
            const startsNewBubbleSequence = startsMessageBubbleSequence(
              message.senderUserId,
              previousIsEvent ? null : previous?.senderUserId ?? null,
              startsNewDay || currentIsEvent,
            )

            return (
              <MessageRow
                key={message.id}
                message={message}
                startsNewDay={startsNewDay}
                startsNewAuthor={startsNewAuthor}
                startsNewBubbleSequence={startsNewBubbleSequence}
                isHighlighted={message.id === highlightedMessageId}
                defaultAttachmentExpanded={defaultAttachmentExpanded}
                loadExternalMediaPreviews={loadExternalMediaPreviews}
                horizontalVideoCardSize={horizontalVideoCardSize}
                verticalVideoCardSize={verticalVideoCardSize}
                canReact={canReact}
                invitePreviewAccessToken={invitePreviewAccessToken}
                invitePreviewOrigin={invitePreviewOrigin}
                privateMessageReceiptViewerUserId={
                  privateMessageReceiptViewerUserId
                }
                currentUserId={currentUserId}
                messageDisplayFormat={messageDisplayFormat}
                messageBubbleAlignment={messageBubbleAlignment}
                messageBubbleWidth={messageBubbleWidth}
                onSetReaction={onSetReaction}
                onJumpToMessage={onJumpToMessage}
                onOpenPreview={(asset) => onOpenPreview(asset, message)}
                onRequestDownload={onRequestDownload}
                onContextMenu={(x, y, focusOnOpen) =>
                  onContextMenu(message, x, y, focusOnOpen)
                }
              />
            )
          })
        ) : (
          <p className={styles.textEmpty}>{serverCopy.messages.emptyChannel}</p>
        )}
      </div>
      {canScrollToBottom ? (
        <button
          className={`${workspaceStyles.textScrollBottom} ${styles.textScrollBottom}`}
          type="button"
          onClick={onScrollToBottom}
        >
          {scrollToBottomLabel}
        </button>
      ) : null}
    </>
  )
})
