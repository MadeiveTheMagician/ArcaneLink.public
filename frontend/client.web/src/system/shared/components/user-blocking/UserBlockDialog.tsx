import { useEffect, useId, useState } from 'react';

import { SystemCloseIcon } from '../../icons/components/SystemCloseIcon';
import {
  normalizeUserBlockComment,
  userBlockCommentMaxLength
} from './userBlockModel';

import styles from './UserBlockDialog.module.css';

export type UserBlockDialogTarget = {
  userId: string;
  displayName: string;
  login?: string | null;
};

type UserBlockDialogProps = {
  target: UserBlockDialogTarget;
  initialComment?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (comment: string | null) => Promise<void> | void;
};

export function UserBlockDialog({
  target,
  initialComment = null,
  isSubmitting = false,
  onClose,
  onConfirm
}: UserBlockDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [comment, setComment] = useState(initialComment ?? '');

  useEffect(() => {
    function closeByEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener('keydown', closeByEscape);
    return () => window.removeEventListener('keydown', closeByEscape);
  }, [isSubmitting, onClose]);

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <span className={styles.dangerMark} aria-hidden="true">
            !
          </span>
          <div>
            <h2 id={titleId}>Заблокировать пользователя?</h2>
            <p>
              {target.displayName}
              {target.login ? ` · @${target.login}` : ''}
            </p>
          </div>
          <button
            className={styles.close}
            type="button"
            aria-label="Закрыть"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <SystemCloseIcon size="medium" />
          </button>
        </header>

        <div className={styles.content}>
          <p id={descriptionId} className={styles.description}>
            Пользователь больше не сможет писать вам и приглашать в личные
            переписки. Причину увидите только вы.
          </p>
          <label className={styles.commentField}>
            <span>
              <strong>Комментарий</strong>
              <small>необязательно</small>
            </span>
            <textarea
              autoFocus
              maxLength={userBlockCommentMaxLength}
              placeholder="Например: нежелательные сообщения"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <small className={styles.counter}>
              {comment.length}/{userBlockCommentMaxLength}
            </small>
          </label>
        </div>

        <footer className={styles.footer}>
          <button
            className={styles.cancel}
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className={styles.confirm}
            type="button"
            disabled={isSubmitting}
            onClick={() => void onConfirm(normalizeUserBlockComment(comment))}
          >
            {isSubmitting ? 'Блокируем…' : 'Заблокировать'}
          </button>
        </footer>
      </section>
    </div>
  );
}
