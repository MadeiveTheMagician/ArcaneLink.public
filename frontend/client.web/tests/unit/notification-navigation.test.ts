import { expect, test } from '@playwright/test'
import type { UserNotificationResponse } from '../../src/shared/types'
import { resolveNotificationTarget } from '../../src/system/Hub/components/notifications/notificationNavigation'

function notification(
  patch: Partial<UserNotificationResponse> = {},
): UserNotificationResponse {
  return {
    id: 'notification-id',
    kind: 'mention',
    title: 'Упоминание',
    body: 'Вас упомянули',
    detail: null,
    actorUserId: 'actor-id',
    actorDisplayName: 'Автор',
    actorAvatarAssetId: null,
    actorAvatarCropOffsetX: 0,
    actorAvatarCropOffsetY: 0,
    actorAvatarCropZoom: 1,
    serverId: 'server-id',
    serverTitle: 'Сервер',
    serverIconAssetId: null,
    serverIconCropOffsetX: 0,
    serverIconCropOffsetY: 0,
    serverIconCropZoom: 1,
    spaceId: 'space-id',
    spaceTitle: 'general',
    messageId: 'message-id',
    messageCreatedAt: '2026-08-14T09:59:58.000Z',
    inviteId: null,
    createdAt: '2026-08-14T10:00:00.000Z',
    readAt: null,
    ...patch,
  }
}

test.describe('notification navigation', () => {
  test('resolves an exact server message target', () => {
    expect(resolveNotificationTarget(notification())).toEqual({
      kind: 'server-message',
      serverId: 'server-id',
      spaceId: 'space-id',
      messageId: 'message-id',
      createdAt: '2026-08-14T09:59:58.000Z',
    })
  })

  test('resolves an exact private message target', () => {
    expect(
      resolveNotificationTarget(notification({ serverId: null })),
    ).toEqual({
      kind: 'private-message',
      spaceId: 'space-id',
      messageId: 'message-id',
      createdAt: '2026-08-14T09:59:58.000Z',
    })
  })

  test('routes friend requests and ignores incomplete mentions', () => {
    expect(
      resolveNotificationTarget(notification({ kind: 'friend-request' })),
    ).toEqual({ kind: 'friend-requests' })
    expect(
      resolveNotificationTarget(notification({ messageId: null })),
    ).toBeNull()
  })
})
