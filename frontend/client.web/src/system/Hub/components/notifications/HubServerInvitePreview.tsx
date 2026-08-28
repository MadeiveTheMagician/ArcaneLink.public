import { useCallback, useEffect, useRef, useState } from 'react';

import { notificationCopy } from '../../../shared/copy';
import { SystemIcon } from '../../../shared/icons/SystemIcon';
import type { WebNotificationItem } from './webNotificationModel';

import styles from './HubServerInvitePreview.module.css';

type HubServerInvitePreviewProps = {
  notification: WebNotificationItem;
  onAccept: (inviteId: string) => Promise<void> | void;
  onDecline: (inviteId: string) => Promise<void> | void;
  onClose: () => void;
  onDismiss: (id: string) => void;
};

const countFormatter = new Intl.NumberFormat(notificationCopy.locale);
const CLOSE_ANIMATION_DURATION_MS = 240;

export function HubServerInvitePreview({
  notification,
  onAccept,
  onDecline,
  onClose,
  onDismiss
}: HubServerInvitePreviewProps) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const iconUrl = notification.serverIconAssetId
    ? `/api/assets/${notification.serverIconAssetId}/content`
    : null;

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    []
  );

  const requestClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, CLOSE_ANIMATION_DURATION_MS);
  }, [onClose]);

  return (
    <div
      className={`${styles.overlay} ${isClosing ? styles.closing : ''}`}
      role="presentation"
    >
      <section
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-server-invite-title"
      >
        <button
          className={styles.close}
          type="button"
          aria-label={notificationCopy.actions.closeInvitation}
          onClick={requestClose}
        >
          <SystemIcon name="close" size="small" />
        </button>

        <div className={styles.summary}>
          <div className={styles.serverAvatar}>
            {iconUrl ? (
              <img
                src={iconUrl}
                alt=""
                style={{
                  transform: `translate(${
                    -50 + (notification.serverIconCropOffsetX ?? 0) * 100
                  }%, ${
                    -50 + (notification.serverIconCropOffsetY ?? 0) * 100
                  }%) scale(${notification.serverIconCropZoom ?? 1})`
                }}
              />
            ) : (
              notification.body.slice(0, 1).toUpperCase()
            )}
          </div>

          <div className={styles.serverDetails}>
            <span className={styles.eyebrow}>
              {notificationCopy.invite.eyebrow}
            </span>
            <h2 id="hub-server-invite-title">{notification.body}</h2>
            <div className={styles.stats}>
              <span>
                <i /> {countFormatter.format(notification.onlineCount ?? 0)}{' '}
                {notificationCopy.invite.online}
              </span>
              <span>
                <SystemIcon name="user" size="small" />{' '}
                {countFormatter.format(notification.memberCount ?? 0)}{' '}
                {notificationCopy.invite.members}
              </span>
            </div>
          </div>
        </div>

        <p className={styles.description}>
          {notification.serverDescription?.trim() ||
            notificationCopy.invite.noDescription}
        </p>

        <div className={styles.actions}>
          <button
            className={styles.accept}
            type="button"
            onClick={() => {
              if (!notification.inviteId) {
                return;
              }

              void Promise.resolve(onAccept(notification.inviteId))
                .then(() => {
                  onDismiss(notification.id);
                  requestClose();
                })
                .catch(() => undefined);
            }}
          >
            {notificationCopy.actions.acceptInvitation}
          </button>
          <button
            className={styles.decline}
            type="button"
            onClick={() => {
              if (!notification.inviteId) {
                return;
              }

              void Promise.resolve(onDecline(notification.inviteId))
                .then(() => {
                  onDismiss(notification.id);
                  requestClose();
                })
                .catch(() => undefined);
            }}
          >
            {notificationCopy.actions.decline}
          </button>
          <button type="button" onClick={requestClose}>
            {notificationCopy.actions.notNow}
          </button>
        </div>
      </section>
    </div>
  );
}
