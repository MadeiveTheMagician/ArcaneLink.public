import { expect, test } from '@playwright/test'
import type { UserNotificationResponse } from '../../src/shared/types'
import {
  applyAllNotificationsRead,
  applyNotificationRead,
  clearReadNotificationHistory,
  rollbackAllNotificationsRead,
  rollbackNotificationRead,
} from '../../src/system/Hub/components/notifications/notificationCenterModel'

function notification(
  id: string,
  readAt: string | null = null,
): UserNotificationResponse {
  return {
    id,
    readAt,
  } as UserNotificationResponse
}

test.describe('notification center optimistic read model', () => {
  test('rolls back a failed single-item update', () => {
    const optimistic = applyNotificationRead(
      [notification('one')],
      'one',
      'optimistic',
    )

    expect(optimistic.notifications[0].readAt).toBe('optimistic')
    expect(
      rollbackNotificationRead(
        optimistic.notifications,
        optimistic.rollback!,
      )[0].readAt,
    ).toBeNull()
  })

  test('does not overwrite a newer server value during rollback', () => {
    const optimistic = applyNotificationRead(
      [notification('one')],
      'one',
      'optimistic',
    )
    const refreshed = [notification('one', 'server-value')]

    expect(
      rollbackNotificationRead(refreshed, optimistic.rollback!)[0].readAt,
    ).toBe('server-value')
  })

  test('rolls back only records changed by mark-all', () => {
    const original = [
      notification('unread'),
      notification('already-read', 'earlier'),
    ]
    const optimistic = applyAllNotificationsRead(original, 'optimistic')
    const concurrent = optimistic.notifications.map((item) =>
      item.id === 'unread' ? { ...item, readAt: 'server-value' } : item,
    )

    expect(
      rollbackAllNotificationsRead(
        optimistic.notifications,
        optimistic.rollbacks,
      ).map((item) => item.readAt),
    ).toEqual([null, 'earlier'])
    expect(
      rollbackAllNotificationsRead(concurrent, optimistic.rollbacks)[0].readAt,
    ).toBe('server-value')
  })

  test('clears only read notification history', () => {
    const unread = notification('unread')
    const read = notification('read', 'earlier')

    expect(clearReadNotificationHistory([read, unread])).toEqual([unread])
  })
})
