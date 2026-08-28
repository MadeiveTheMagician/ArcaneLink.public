import { type CSSProperties, useState } from 'react';

import { notificationCopy } from '../../../shared/copy';
import { SystemIcon } from '../../../shared/icons/SystemIcon';
import { HubServerInvitePreview } from './HubServerInvitePreview';
import type { NotificationTarget } from './notificationNavigation';
import type { NotificationPreferences } from './notificationPreferences';
import type { WebNotificationItem } from './webNotificationModel';

import styles from './WebNotificationStack.module.css';

type WebNotificationStackProps = {
  notifications: WebNotificationItem[];
  closingNotificationIds: Set<string>;
  onAcceptInvite: (inviteId: string) => Promise<void> | void;
  onDeclineInvite: (inviteId: string) => Promise<void> | void;
  onDismiss: (id: string) => void;
  onMarkStoredRead: (notificationId: string) => Promise<void> | void;
  onOpenPrivateSpace: (spaceId: string) => void;
  onOpenTarget: (target: NotificationTarget) => void;
  onPause: () => void;
  onResume: () => void;
  placement: NotificationPreferences['placement'];
  bottomOffsetPx?: number;
};

const iconByKind = {
  'private-message': 'message',
  mention: 'message',
  'server-invite': 'user-plus',
  'private-space-invite': 'user-plus',
  'friend-request': 'user-plus',
  system: 'server'
} as const;

export function WebNotificationStack({
  notifications,
  closingNotificationIds,
  onAcceptInvite,
  onDeclineInvite,
  onDismiss,
  onMarkStoredRead,
  onOpenPrivateSpace,
  onOpenTarget,
  onPause,
  onResume,
  placement,
  bottomOffsetPx = 24
}: WebNotificationStackProps) {
  const [selectedInvite, setSelectedInvite] =
    useState<WebNotificationItem | null>(null);

  if (notifications.length === 0) {
    return selectedInvite ? (
      <HubServerInvitePreview
        notification={selectedInvite}
        onAccept={onAcceptInvite}
        onDecline={onDeclineInvite}
        onClose={() => setSelectedInvite(null)}
        onDismiss={onDismiss}
      />
    ) : null;
  }

  return (
    <aside
      className={`${styles.stack} ${
        placement === 'bottom-left' ? styles.bottomLeft : ''
      }`}
      aria-label={notificationCopy.popup.notificationsLabel}
      aria-live="polite"
      style={
        {
          '--notification-stack-bottom': `${bottomOffsetPx}px`
        } as CSSProperties
      }
      onMouseEnter={onPause}
      onMouseLeave={onResume}
    >
      {notifications.map((notification) => (
        <article
          className={`${styles.card} ${styles[notification.kind]} ${
            closingNotificationIds.has(notification.id) ? styles.closing : ''
          }`}
          key={notification.id}
        >
          {notification.kind === 'server-invite' &&
          notification.serverIconAssetId ? (
            <span className={`${styles.icon} ${styles.avatar}`}>
              <img
                src={`/api/assets/${notification.serverIconAssetId}/content`}
                alt=""
                style={{
                  transform: `translate(${
                    (notification.serverIconCropOffsetX ?? 0) * 100
                  }%, ${
                    (notification.serverIconCropOffsetY ?? 0) * 100
                  }%) scale(${notification.serverIconCropZoom ?? 1})`
                }}
              />
            </span>
          ) : (notification.kind === 'private-message' ||
              notification.kind === 'mention' ||
              notification.kind === 'private-space-invite' ||
              notification.kind === 'friend-request') &&
            notification.senderAvatarAssetId ? (
            <span className={`${styles.icon} ${styles.avatar}`}>
              <img
                src={`/api/assets/${notification.senderAvatarAssetId}/content`}
                alt=""
                style={{
                  transform: `translate(${
                    (notification.senderAvatarCropOffsetX ?? 0) * 100
                  }%, ${
                    (notification.senderAvatarCropOffsetY ?? 0) * 100
                  }%) scale(${notification.senderAvatarCropZoom ?? 1})`
                }}
              />
            </span>
          ) : (
            <span className={styles.icon}>
              <SystemIcon name={iconByKind[notification.kind]} size={30} glow />
            </span>
          )}
          <div className={styles.content}>
            <header>
              <strong>{notification.title}</strong>
              <time dateTime={notification.createdAt}>
                {formatNotificationTime(notification.createdAt)}
              </time>
            </header>
            <span>{notification.body}</span>
            {notification.detail ? (
              <p className={styles.detail}>{notification.detail}</p>
            ) : null}
            {notification.kind === 'server-invite' && notification.inviteId ? (
              <div className={styles.actions}>
                <button
                  className={styles.secondaryAction}
                  type="button"
                  onClick={() => onDismiss(notification.id)}
                >
                  {notificationCopy.actions.later}
                </button>
                <button
                  className={styles.primaryAction}
                  type="button"
                  onClick={() => {
                    setSelectedInvite(notification);
                  }}
                >
                  {notificationCopy.actions.accept}
                </button>
              </div>
            ) : null}
          </div>
          <button
            className={styles.close}
            type="button"
            aria-label={notificationCopy.actions.closeNotification}
            onClick={() => onDismiss(notification.id)}
          >
            <SystemIcon name="close" size="small" />
          </button>
          {(notification.kind === 'private-message' ||
            notification.kind === 'private-space-invite') &&
          notification.spaceId ? (
            <button
              className={styles.openOverlay}
              type="button"
              aria-label={notificationCopy.actions.openPrivateSpace}
              onClick={() => {
                if (notification.storedNotificationId) {
                  void onMarkStoredRead(notification.storedNotificationId);
                }
                onOpenPrivateSpace(notification.spaceId!);
                onDismiss(notification.id);
              }}
            />
          ) : null}
          {notification.kind === 'mention' &&
          notification.spaceId &&
          notification.messageId ? (
            <button
              className={styles.openOverlay}
              type="button"
              aria-label={notificationCopy.actions.openMention}
              onClick={() => {
                if (notification.storedNotificationId) {
                  void onMarkStoredRead(notification.storedNotificationId);
                }
                onOpenTarget(
                  notification.serverId
                    ? {
                        kind: 'server-message',
                        serverId: notification.serverId,
                        spaceId: notification.spaceId!,
                        messageId: notification.messageId!,
                        createdAt:
                          notification.messageCreatedAt ??
                          notification.createdAt
                      }
                    : {
                        kind: 'private-message',
                        spaceId: notification.spaceId!,
                        messageId: notification.messageId!,
                        createdAt:
                          notification.messageCreatedAt ??
                          notification.createdAt
                      }
                );
                onDismiss(notification.id);
              }}
            />
          ) : null}
          {notification.kind === 'friend-request' ? (
            <button
              className={styles.openOverlay}
              type="button"
              aria-label={notificationCopy.actions.openFriendRequests}
              onClick={() => {
                if (notification.storedNotificationId) {
                  void onMarkStoredRead(notification.storedNotificationId);
                }
                onOpenTarget({ kind: 'friend-requests' });
                onDismiss(notification.id);
              }}
            />
          ) : null}
        </article>
      ))}
      {selectedInvite ? (
        <HubServerInvitePreview
          notification={selectedInvite}
          onAccept={onAcceptInvite}
          onDecline={onDeclineInvite}
          onClose={() => setSelectedInvite(null)}
          onDismiss={onDismiss}
        />
      ) : null}
    </aside>
  );
}

function formatNotificationTime(createdAt: string) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  );

  if (elapsedMinutes < 1) {
    return notificationCopy.popup.now;
  }

  return notificationCopy.popup.minutesAgo(elapsedMinutes);
}
