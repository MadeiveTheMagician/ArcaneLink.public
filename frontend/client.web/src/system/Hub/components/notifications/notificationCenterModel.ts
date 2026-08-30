import type { UserNotificationResponse } from '../../../../shared/types';

export type NotificationReadRollback = {
  id: string;
  previousReadAt: string | null;
  optimisticReadAt: string;
};

export function applyNotificationRead(
  notifications: UserNotificationResponse[],
  id: string,
  readAt: string
) {
  const item = notifications.find((notification) => notification.id === id);
  if (!item || item.readAt) {
    return {
      notifications,
      rollback: null
    };
  }

  return {
    notifications: notifications.map((notification) =>
      notification.id === id ? { ...notification, readAt } : notification
    ),
    rollback: {
      id,
      previousReadAt: item.readAt,
      optimisticReadAt: readAt
    } satisfies NotificationReadRollback
  };
}

export function rollbackNotificationRead(
  notifications: UserNotificationResponse[],
  rollback: NotificationReadRollback
) {
  return notifications.map((notification) =>
    notification.id === rollback.id &&
    notification.readAt === rollback.optimisticReadAt
      ? { ...notification, readAt: rollback.previousReadAt }
      : notification
  );
}

export function applyAllNotificationsRead(
  notifications: UserNotificationResponse[],
  readAt: string
) {
  const rollbacks: NotificationReadRollback[] = [];
  const next = notifications.map((notification) => {
    if (notification.readAt) {
      return notification;
    }

    rollbacks.push({
      id: notification.id,
      previousReadAt: null,
      optimisticReadAt: readAt
    });
    return { ...notification, readAt };
  });

  return { notifications: next, rollbacks };
}

export function rollbackAllNotificationsRead(
  notifications: UserNotificationResponse[],
  rollbacks: NotificationReadRollback[]
) {
  const rollbackById = new Map(
    rollbacks.map((rollback) => [rollback.id, rollback])
  );

  return notifications.map((notification) => {
    const rollback = rollbackById.get(notification.id);
    if (!rollback || notification.readAt !== rollback.optimisticReadAt) {
      return notification;
    }

    return { ...notification, readAt: rollback.previousReadAt };
  });
}

export function clearReadNotificationHistory(
  notifications: UserNotificationResponse[]
) {
  return notifications.filter((notification) => !notification.readAt);
}
