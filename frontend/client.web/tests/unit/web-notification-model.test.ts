import { expect, test } from '@playwright/test'
import type { UserNotificationResponse } from '../../src/shared/types'
import {
  mapStoredWebNotification,
  trimWebNotificationQueue,
  webNotificationPriority,
} from '../../src/system/Hub/components/notifications/webNotificationModel'
import type { WebNotificationItem } from '../../src/system/Hub/components/notifications/webNotificationModel'

function notification(
  patch: Partial<UserNotificationResponse>,
): UserNotificationResponse {
  return {
    id: 'notification-id',
    kind: 'mention',
    title: 'Упоминание',
    body: 'Вас упомянули в #general на сервере «Сервер»',
    detail: 'Текст сообщения',
    actorUserId: 'actor-id',
    actorDisplayName: 'Автор',
    actorAvatarAssetId: 'avatar-id',
    actorAvatarCropOffsetX: 0.1,
    actorAvatarCropOffsetY: -0.2,
    actorAvatarCropZoom: 1.3,
    serverId: 'server-id',
    serverTitle: 'Сервер',
    serverIconAssetId: null,
    serverIconCropOffsetX: 0,
    serverIconCropOffsetY: 0,
    serverIconCropZoom: 1,
    spaceId: 'space-id',
    spaceTitle: 'general',
    messageId: 'message-id',
    messageCreatedAt: '2026-07-26T09:59:59.000Z',
    inviteId: null,
    createdAt: '2026-07-26T10:00:00.000Z',
    readAt: null,
    ...patch,
  }
}

test.describe('stored web notification mapping', () => {
  test('maps mention with a shared message key and actor avatar', () => {
    expect(mapStoredWebNotification(notification({}))).toMatchObject({
      id: 'mention:notification-id',
      kind: 'mention',
      title: 'Автор · Упоминание',
      body: 'Вас упомянули в #general на сервере «Сервер»',
      detail: 'Текст сообщения',
      messageId: 'message-id',
      serverId: 'server-id',
      spaceId: 'space-id',
      senderAvatarAssetId: 'avatar-id',
    })
  })

  test('maps private-space invitation and ignores read or unrelated rows', () => {
    expect(
      mapStoredWebNotification(
        notification({
          kind: 'private-space-invite',
          serverId: null,
          messageId: null,
        }),
      ),
    ).toMatchObject({
      kind: 'private-space-invite',
      spaceId: 'space-id',
      body: 'Автор',
    })
    expect(
      mapStoredWebNotification(
        notification({ readAt: '2026-07-26T10:01:00.000Z' }),
      ),
    ).toBeNull()
    expect(mapStoredWebNotification(notification({ kind: 'system' }))).toBeNull()
  })

  test('maps a persistent friend-request record to an actor notification', () => {
    expect(
      mapStoredWebNotification(
        notification({
          kind: 'friend-request',
          serverId: null,
          spaceId: null,
          messageId: null,
        }),
      ),
    ).toMatchObject({
      id: 'friend-request:notification-id',
      storedNotificationId: 'notification-id',
      kind: 'friend-request',
      body: 'Вас упомянули в #general на сервере «Сервер»',
      senderAvatarAssetId: 'avatar-id',
    })
  })

  test('gives mention priority over an ordinary private message', () => {
    expect(webNotificationPriority('mention')).toBeGreaterThan(
      webNotificationPriority('private-message'),
    )
  })

  test('keeps an incoming alert visible when persistent invites fill the stack', () => {
    const persistentInvites = Array.from({ length: 4 }, (_, index) =>
      webNotification({
        id: `invite-${index}`,
        kind: 'server-invite',
        persistent: true,
      }),
    )
    const incoming = webNotification({
      id: 'incoming-mention',
      kind: 'mention',
    })

    const result = trimWebNotificationQueue(
      [...persistentInvites, incoming],
      incoming.id,
      4,
    )

    expect(result.items).toContainEqual(incoming)
    expect(result.items).toHaveLength(4)
    expect(result.evicted?.id).toBe('invite-0')
  })
})

function webNotification(
  patch: Partial<WebNotificationItem>,
): WebNotificationItem {
  return {
    id: 'web-notification',
    kind: 'system',
    title: 'Уведомление',
    body: 'Текст',
    createdAt: '2026-07-26T10:00:00.000Z',
    ...patch,
  }
}
