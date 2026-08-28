import type { UserNotificationResponse } from '../../../../shared/types'

export type NotificationTarget =
  | {
      kind: 'private-message'
      spaceId: string
      messageId: string
      createdAt: string
    }
  | {
      kind: 'server-message'
      serverId: string
      spaceId: string
      messageId: string
      createdAt: string
    }
  | { kind: 'friend-requests' }

export function resolveNotificationTarget(
  notification: UserNotificationResponse,
): NotificationTarget | null {
  if (notification.kind === 'friend-request') {
    return { kind: 'friend-requests' }
  }

  if (
    notification.kind !== 'mention' ||
    !notification.spaceId ||
    !notification.messageId
  ) {
    return null
  }

  const messageTarget = {
    spaceId: notification.spaceId,
    messageId: notification.messageId,
    createdAt: notification.messageCreatedAt ?? notification.createdAt,
  }

  return notification.serverId
    ? {
        kind: 'server-message',
        serverId: notification.serverId,
        ...messageTarget,
      }
    : { kind: 'private-message', ...messageTarget }
}
