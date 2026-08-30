import { useEffect } from 'react';

import type { PrivateDeletedMessageResponse } from '../../../../shared/types';
import { SystemIcon, communityCopy, serverCopy } from '../../../shared';
import { isPrivateMessageRestorable } from '../../../shared/messages/privateMessageDeletionModel';
import { formatPinnedMessageDateTime } from './messageUtils';

import styles from './DeletedMessagesPanel.module.css';

const minuteInMilliseconds = 60_000;

export function DeletedMessagesPanel({
  isOpen,
  isLoading,
  messages,
  error,
  restoringMessageId,
  isLoadingOlder,
  hasOlder,
  isClearing,
  now,
  onRestore,
  onLoadOlder,
  onClear,
  onClose
}: {
  isOpen: boolean;
  isLoading: boolean;
  messages: PrivateDeletedMessageResponse[];
  error: string | null;
  restoringMessageId: string | null;
  isLoadingOlder: boolean;
  hasOlder: boolean;
  isClearing: boolean;
  now: number;
  onRestore: (messageId: string) => void;
  onLoadOlder: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', closeOnEscape);

    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  return (
    <aside
      className={`${styles.trashPanel} ${isOpen ? styles.open : ''}`}
      aria-label={communityCopy.direct.deletedMessages}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <header>
        <div className={styles.trashTitle}>
          <strong>{communityCopy.direct.deletedMessages}</strong>
          <span>
            {messages.length}
            {hasOlder ? '+' : ''}
          </span>
        </div>
        <div className={styles.trashActions}>
          <button
            className={styles.clearTrash}
            type="button"
            disabled={messages.length === 0 || isClearing}
            onClick={() => {
              if (
                window.confirm(communityCopy.direct.clearDeletedMessagesConfirm)
              ) {
                onClear();
              }
            }}
          >
            {isClearing
              ? communityCopy.direct.clearingDeletedMessages
              : communityCopy.direct.clearDeletedMessages}
          </button>
          <button
            className={styles.closeTrash}
            type="button"
            onClick={onClose}
            aria-label={communityCopy.direct.closeDeletedMessages}
            title={communityCopy.direct.closeDeletedMessages}
          >
            <SystemIcon name="close" />
          </button>
        </div>
      </header>

      <p className={styles.trashHint}>
        {communityCopy.direct.deletedMessagesHint}
      </p>
      {error ? (
        <p className={styles.trashError} role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className={styles.trashEmpty} aria-live="polite">
          {communityCopy.direct.loadingDeletedMessages}
        </p>
      ) : messages.length === 0 ? (
        <p className={styles.trashEmpty}>
          {communityCopy.direct.deletedMessagesEmpty}
        </p>
      ) : (
        <div
          className={styles.trashList}
          onScroll={(event) => {
            const list = event.currentTarget;
            const progress =
              (list.scrollTop + list.clientHeight) /
              Math.max(list.scrollHeight, 1);
            if (hasOlder && !isLoadingOlder && progress >= 0.85) {
              onLoadOlder();
            }
          }}
        >
          {messages.map((deletion) => {
            const { message } = deletion;
            const isRestorable = isPrivateMessageRestorable(deletion, now);
            const isRestoring = restoringMessageId === message.id;
            const remainingLabel = getRestoreRemainingLabel(
              deletion.restoreUntil,
              now
            );

            return (
              <article
                className={styles.trashCard}
                key={`${message.id}-${deletion.scope}`}
              >
                <header>
                  <div>
                    <strong>{message.senderDisplayName}</strong>
                    <time dateTime={message.createdAt}>
                      {formatPinnedMessageDateTime(message.createdAt)}
                    </time>
                  </div>
                  <small>
                    {deletion.scope === 'everyone'
                      ? communityCopy.direct.deletedForEveryone
                      : communityCopy.direct.deletedForMe}
                  </small>
                </header>
                <p>{message.body ?? serverCopy.messages.emptyBody}</p>
                {message.assets.length > 0 ? (
                  <small className={styles.trashAttachments}>
                    {communityCopy.direct.trashAttachmentCount(
                      message.assets.length
                    )}
                  </small>
                ) : null}
                <footer>
                  <span
                    className={isRestorable ? '' : styles.expired}
                    title={communityCopy.direct.restoreAvailableUntil(
                      formatRestoreDeadline(deletion.restoreUntil)
                    )}
                  >
                    {remainingLabel}
                  </span>
                  <button
                    type="button"
                    disabled={!isRestorable || Boolean(restoringMessageId)}
                    onClick={() => onRestore(message.id)}
                  >
                    {isRestoring
                      ? `${communityCopy.direct.restoreMessage}...`
                      : communityCopy.direct.restoreMessage}
                  </button>
                </footer>
              </article>
            );
          })}
          {isLoadingOlder ? (
            <p className={styles.loadingOlder} aria-live="polite">
              {communityCopy.direct.loadingOlderDeletedMessages}
            </p>
          ) : null}
        </div>
      )}
    </aside>
  );
}

function getRestoreRemainingLabel(restoreUntil: string, now: number) {
  const remainingMilliseconds = Date.parse(restoreUntil) - now;

  if (!Number.isFinite(remainingMilliseconds) || remainingMilliseconds <= 0) {
    return communityCopy.direct.restoreExpired;
  }

  const totalMinutes = Math.max(
    1,
    Math.ceil(remainingMilliseconds / minuteInMilliseconds)
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return communityCopy.direct.restoreRemaining(hours, minutes);
}

function formatRestoreDeadline(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(date);
}
