import { type CSSProperties, useEffect, useRef, useState } from 'react';

import type {
  MessageDisplayFormat,
  SpaceMessageAssetResponse,
  SpaceMessageMentionResponse,
  SpaceMessageResponse
} from '../../../../shared/types';
import {
  SystemIcon,
  commonCopy,
  defaultMessageBubbleAlignment,
  defaultMessageBubbleWidth,
  isMessageBubbleRightAligned,
  serverCopy
} from '../../../shared';
import type {
  MessageBubbleAlignment,
  MessageBubbleWidth
} from '../../../shared';
import { getMessagePinnedEvent } from '../../../shared/messages/messageEventModel';
import { ExternalMediaPreviews } from './ExternalMediaPreview';
import { MentionTag } from './MentionTag';
import { MessageAttachmentGallery } from './MessageAttachmentGallery';
import { MessageReactions } from './MessageReactions';
import { MessageReplyReference } from './MessageReply';
import { ServerInviteMessageCards } from './ServerInviteMessageCards';
import { resolveExternalMediaBubbleWidth } from './externalMediaSizeModel';
import { resolvePrivateMessageReceiptIndicator } from './messageReceiptModel';
import type { PrivateMessageReceiptIndicator } from './messageReceiptModel';
import { formatMessageDay, formatMessageTime } from './messageUtils';

import styles from './MessageRow.module.css';

export function MessageRow({
  message,
  startsNewDay,
  startsNewAuthor,
  startsNewBubbleSequence,
  isHighlighted,
  onOpenPreview,
  onRequestDownload,
  onContextMenu,
  defaultAttachmentExpanded,
  loadExternalMediaPreviews,
  horizontalVideoCardSize,
  verticalVideoCardSize,
  canReact,
  onSetReaction,
  onJumpToMessage,
  invitePreviewAccessToken,
  invitePreviewOrigin,
  privateMessageReceiptViewerUserId,
  currentUserId,
  messageDisplayFormat,
  messageBubbleAlignment = defaultMessageBubbleAlignment,
  messageBubbleWidth = defaultMessageBubbleWidth
}: {
  message: SpaceMessageResponse;
  startsNewDay: boolean;
  startsNewAuthor: boolean;
  startsNewBubbleSequence: boolean;
  isHighlighted: boolean;
  onOpenPreview: (asset: SpaceMessageAssetResponse) => void;
  onRequestDownload: (asset: SpaceMessageAssetResponse) => void;
  onContextMenu: (x: number, y: number, focusOnOpen: boolean) => void;
  defaultAttachmentExpanded: boolean;
  loadExternalMediaPreviews: boolean;
  horizontalVideoCardSize: number;
  verticalVideoCardSize: number;
  canReact: boolean;
  onSetReaction: (
    messageId: string,
    emojiCode: string,
    isPresent: boolean
  ) => Promise<SpaceMessageResponse | null>;
  onJumpToMessage: (messageId: string, createdAt?: string | null) => void;
  invitePreviewAccessToken?: string | null;
  invitePreviewOrigin?: string | null;
  privateMessageReceiptViewerUserId?: string | null;
  currentUserId: string;
  messageDisplayFormat: MessageDisplayFormat;
  messageBubbleAlignment?: MessageBubbleAlignment;
  messageBubbleWidth?: MessageBubbleWidth;
}) {
  const pinnedEvent = getMessagePinnedEvent(message);
  if (pinnedEvent) {
    return (
      <>
        {startsNewDay && (
          <div className={styles.messageDayDivider}>
            <span>{formatMessageDay(message.createdAt)}</span>
          </div>
        )}
        <div
          className={styles.messageEvent}
          data-message-id={message.id}
          role="status"
        >
          <span className={styles.messageEventRule} aria-hidden="true" />
          <span className={styles.messageEventContent}>
            <SystemIcon name="pin" size={14} />
            <span>
              {serverCopy.messages.pinnedMessageEvent(
                message.senderDisplayName
              )}
            </span>
            <button
              type="button"
              onClick={() =>
                onJumpToMessage(
                  pinnedEvent.messageId,
                  message.replyTo?.createdAt
                )
              }
            >
              «{serverCopy.messages.pinnedMessageLink}»
            </button>
          </span>
          <span className={styles.messageEventRule} aria-hidden="true" />
        </div>
      </>
    );
  }

  const avatarUrl = message.senderAvatarAssetId
    ? `/api/assets/${message.senderAvatarAssetId}/content`
    : null;
  const visibleMentions = Array.from(
    new Map(
      (message.mentions ?? []).map((mention) => [
        `${mention.kind}:${mention.targetUserId ?? mention.targetRoleId ?? 'everyone'}`,
        mention
      ])
    ).values()
  );
  const receipt = resolvePrivateMessageReceiptIndicator(
    message,
    privateMessageReceiptViewerUserId
  );
  const isBubble = messageDisplayFormat === 'bubble';
  const isOwnMessage = message.senderUserId === currentUserId;
  const isBubbleRightAligned =
    isBubble &&
    isMessageBubbleRightAligned(messageBubbleAlignment, isOwnMessage);
  const isBubbleFullWidth = isBubble && messageBubbleWidth === 'full-width';
  const startsVisibleAuthorBlock = isBubble
    ? startsNewBubbleSequence
    : startsNewAuthor;
  const bubbleMediaWidth = isBubble
    ? resolveExternalMediaBubbleWidth({
        body: message.body,
        enabled: loadExternalMediaPreviews && !message.deletedAt,
        parentHost: window.location.hostname || 'localhost',
        horizontalSize: horizontalVideoCardSize,
        verticalSize: verticalVideoCardSize
      })
    : null;
  const bubbleStyle =
    bubbleMediaWidth !== null
      ? ({
          '--message-bubble-media-width': `${bubbleMediaWidth}px`
        } as CSSProperties)
      : undefined;

  return (
    <>
      {startsNewDay && (
        <div className={styles.messageDayDivider}>
          <span>{formatMessageDay(message.createdAt)}</span>
        </div>
      )}
      {startsNewAuthor && !startsNewDay && !isBubble && (
        <div className={styles.messageAuthorDivider} aria-hidden="true" />
      )}
      <article
        className={`${styles.messageRow} ${
          startsVisibleAuthorBlock ? '' : styles.messageCompact
        } ${
          receipt && !startsVisibleAuthorBlock
            ? styles.messageCompactWithReceipt
            : ''
        } ${isHighlighted ? styles.messageHighlighted : ''} ${
          isBubble ? styles.messageBubble : ''
        } ${isBubble && isOwnMessage ? styles.messageBubbleOwn : ''} ${
          isBubbleRightAligned ? styles.messageBubbleRight : ''
        } ${
          bubbleMediaWidth !== null ? styles.messageBubbleExternalMedia : ''
        } ${isBubbleFullWidth ? styles.messageBubbleFullWidth : ''} ${
          isBubble && startsNewBubbleSequence
            ? styles.messageBubbleSequenceStart
            : ''
        }`}
        style={bubbleStyle}
        data-message-id={message.id}
        tabIndex={0}
        aria-keyshortcuts="Shift+F10"
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onContextMenu(event.clientX, event.clientY, false);
        }}
        onKeyDown={(event) => {
          const opensContextMenu =
            event.key === 'ContextMenu' ||
            (event.shiftKey && event.key === 'F10');

          if (!opensContextMenu) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          onContextMenu(
            bounds.left + Math.min(32, bounds.width / 2),
            bounds.top + Math.min(32, bounds.height / 2),
            true
          );
        }}
      >
        {startsVisibleAuthorBlock ? (
          <span className={styles.messageAvatar}>
            {avatarUrl ? (
              <img
                className="ui-media-fit"
                src={avatarUrl}
                alt=""
                style={{
                  transform: `translate(${
                    message.senderAvatarCropOffsetX * 100
                  }%, ${message.senderAvatarCropOffsetY * 100}%) scale(${
                    message.senderAvatarCropZoom
                  })`
                }}
              />
            ) : (
              message.senderDisplayName.slice(0, 1).toUpperCase()
            )}
          </span>
        ) : (
          <span className={styles.messageSpacer} aria-hidden="true" />
        )}
        <div className={styles.messageContent}>
          {startsVisibleAuthorBlock && (
            <div className={styles.messageHeader}>
              <strong>{message.senderDisplayName}</strong>
              <time dateTime={message.createdAt}>
                {formatMessageTime(message.createdAt)}
              </time>
              {receipt && <MessageReceipt receipt={receipt} />}
              {message.editedAt && <span>{serverCopy.messages.edited}</span>}
              <MessageMentionTags mentions={visibleMentions} />
            </div>
          )}
          {!startsVisibleAuthorBlock && receipt && (
            <span className={styles.messageCompactMeta}>
              <time dateTime={message.createdAt}>
                {formatMessageTime(message.createdAt)}
              </time>
              <MessageReceipt receipt={receipt} />
            </span>
          )}
          {isBubble && !startsNewBubbleSequence && (
            <MessageMentionTags mentions={visibleMentions} isCompact />
          )}
          {message.replyTo && (
            <MessageReplyReference
              reply={message.replyTo}
              onOpen={
                message.replyTo.isUnavailable
                  ? undefined
                  : () =>
                      onJumpToMessage(
                        message.replyTo!.id,
                        message.replyTo!.createdAt
                      )
              }
            />
          )}
          <CollapsibleMessageBody
            body={
              message.deletedAt ? serverCopy.messages.deleted : message.body
            }
          />
          {!message.deletedAt &&
            invitePreviewAccessToken &&
            invitePreviewOrigin && (
              <ServerInviteMessageCards
                body={message.body}
                accessToken={invitePreviewAccessToken}
                currentOrigin={invitePreviewOrigin}
              />
            )}
          {!message.deletedAt && (
            <ExternalMediaPreviews
              body={message.body}
              enabled={loadExternalMediaPreviews}
              horizontalSize={horizontalVideoCardSize}
              verticalSize={verticalVideoCardSize}
              isBubblePresentation={isBubble}
            />
          )}
          {!message.deletedAt && message.assets.length > 0 && (
            <MessageAttachmentGallery
              assets={message.assets}
              defaultExpanded={defaultAttachmentExpanded}
              fillAvailableWidth={isBubbleFullWidth}
              onOpenPreview={onOpenPreview}
              onRequestDownload={onRequestDownload}
            />
          )}
          <MessageReactions
            message={message}
            canReact={canReact}
            onSetReaction={onSetReaction}
          />
        </div>
      </article>
    </>
  );
}

function MessageMentionTags({
  mentions,
  isCompact = false
}: {
  mentions: readonly SpaceMessageMentionResponse[];
  isCompact?: boolean;
}) {
  if (mentions.length === 0) {
    return null;
  }

  return (
    <span
      className={`${styles.messageMentions} ${
        isCompact ? styles.messageCompactMentions : ''
      }`}
      aria-label="Упоминания"
    >
      {mentions.map((mention) => (
        <MentionTag
          key={mention.id}
          kind={mention.kind}
          label={mention.displayText}
        />
      ))}
    </span>
  );
}

function MessageReceipt({
  receipt
}: {
  receipt: PrivateMessageReceiptIndicator;
}) {
  return (
    <span
      className={`${styles.messageReceipt} ${
        receipt.status === 'read' ? styles.messageReceiptRead : ''
      }`}
      aria-label={receipt.label}
      title={receipt.label}
    >
      <span aria-hidden="true">{receipt.marks}</span>
    </span>
  );
}

function CollapsibleMessageBody({ body }: { body: string | null }) {
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const element = textRef.current;

    if (!element) {
      return undefined;
    }

    function measure() {
      const current = textRef.current;

      if (!current) {
        return;
      }

      const lineHeight = Number.parseFloat(
        window.getComputedStyle(current).lineHeight
      );
      const maxCollapsedHeight = lineHeight * 5;

      setIsOverflowing(current.scrollHeight > maxCollapsedHeight + 2);
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [body]);

  return (
    <>
      <p
        className={`${styles.messageBody} ${
          isOverflowing && !isExpanded ? styles.messageCollapsed : ''
        }`}
        ref={textRef}
      >
        {body}
      </p>
      {isOverflowing && (
        <button
          className={styles.messageCollapseButton}
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded
            ? commonCopy.actions.collapse
            : serverCopy.messages.expandFull}
        </button>
      )}
    </>
  );
}
