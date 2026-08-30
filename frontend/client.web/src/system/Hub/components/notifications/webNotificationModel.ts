import type { UserNotificationResponse } from '../../../../shared/types';

export type WebNotificationKind =
  | 'private-message'
  | 'mention'
  | 'server-invite'
  | 'private-space-invite'
  | 'friend-request'
  | 'system';

export type WebNotificationItem = {
  id: string;
  storedNotificationId?: string;
  kind: WebNotificationKind;
  title: string;
  body: string;
  detail?: string | null;
  createdAt: string;
  spaceId?: string;
  serverId?: string;
  messageId?: string;
  messageCreatedAt?: string;
  inviteId?: string;
  persistent?: boolean;
  senderAvatarAssetId?: string | null;
  senderAvatarCropOffsetX?: number;
  senderAvatarCropOffsetY?: number;
  senderAvatarCropZoom?: number;
  serverIconAssetId?: string | null;
  serverIconCropOffsetX?: number;
  serverIconCropOffsetY?: number;
  serverIconCropZoom?: number;
  serverDescription?: string | null;
  memberCount?: number;
  onlineCount?: number;
};

export type RealtimePrivateMessagePayload = {
  spaceId?: string | null;
  messageId?: string | null;
  senderUserId?: string | null;
};

export type RealtimeServerInvitePayload = {
  serverId?: string | null;
  inviteId?: string | null;
};

export type RealtimeSystemNotificationPayload = {
  id: string;
  title: string;
  body: string;
  force?: boolean;
};

export function mapStoredWebNotification(
  notification: UserNotificationResponse
): WebNotificationItem | null {
  if (notification.readAt) {
    return null;
  }

  if (notification.kind === 'mention') {
    return {
      id: `mention:${notification.id}`,
      storedNotificationId: notification.id,
      kind: 'mention',
      title: notification.actorDisplayName
        ? `${notification.actorDisplayName} · ${notification.title}`
        : notification.title,
      body: notification.body,
      detail: notification.detail,
      createdAt: notification.createdAt,
      spaceId: notification.spaceId ?? undefined,
      serverId: notification.serverId ?? undefined,
      messageId: notification.messageId ?? undefined,
      messageCreatedAt: notification.messageCreatedAt ?? undefined,
      senderAvatarAssetId: notification.actorAvatarAssetId,
      senderAvatarCropOffsetX: notification.actorAvatarCropOffsetX,
      senderAvatarCropOffsetY: notification.actorAvatarCropOffsetY,
      senderAvatarCropZoom: notification.actorAvatarCropZoom
    };
  }

  if (notification.kind === 'private-space-invite' && notification.spaceId) {
    return {
      id: `private-space-invite:${notification.id}`,
      storedNotificationId: notification.id,
      kind: 'private-space-invite',
      title: notification.title,
      body: notification.actorDisplayName ?? notification.body,
      detail:
        notification.actorDisplayName != null
          ? notification.body
          : notification.detail,
      createdAt: notification.createdAt,
      spaceId: notification.spaceId,
      senderAvatarAssetId: notification.actorAvatarAssetId,
      senderAvatarCropOffsetX: notification.actorAvatarCropOffsetX,
      senderAvatarCropOffsetY: notification.actorAvatarCropOffsetY,
      senderAvatarCropZoom: notification.actorAvatarCropZoom
    };
  }

  if (notification.kind === 'friend-request') {
    return {
      id: `friend-request:${notification.id}`,
      storedNotificationId: notification.id,
      kind: 'friend-request',
      title: notification.title,
      body: notification.body,
      createdAt: notification.createdAt,
      senderAvatarAssetId: notification.actorAvatarAssetId,
      senderAvatarCropOffsetX: notification.actorAvatarCropOffsetX,
      senderAvatarCropOffsetY: notification.actorAvatarCropOffsetY,
      senderAvatarCropZoom: notification.actorAvatarCropZoom
    };
  }

  return null;
}

export function webNotificationPriority(kind: WebNotificationKind) {
  return kind === 'mention' ? 2 : kind === 'private-message' ? 1 : 0;
}

export function trimWebNotificationQueue(
  notifications: WebNotificationItem[],
  incomingId: string,
  maxVisible: number
) {
  if (notifications.length <= maxVisible) {
    return { items: notifications, evicted: null };
  }

  const transientIndex = notifications.findIndex(
    (item) => item.id !== incomingId && !item.persistent
  );
  const evictedIndex =
    transientIndex >= 0
      ? transientIndex
      : notifications.findIndex((item) => item.id !== incomingId);
  if (evictedIndex < 0) {
    return {
      items: notifications.slice(-maxVisible),
      evicted: null
    };
  }

  return {
    items: notifications.filter((_, index) => index !== evictedIndex),
    evicted: notifications[evictedIndex]
  };
}
