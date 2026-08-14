import { expect, test } from '@playwright/test'
import {
  defaultNotificationPreferences,
  getNotificationPreferencesStorageKey,
  loadNotificationPreferences,
  parseNotificationPreferences,
  saveNotificationPreferences,
} from '../../src/system/Hub/components/notifications/notificationPreferences'

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
    removeItem(key: string) {
      values.delete(key)
    },
    values,
  }
}

test.describe('notification preferences', () => {
  test('stores preferences separately for each user', () => {
    const storage = createStorage()
    saveNotificationPreferences(
      'USER-A',
      {
        ...defaultNotificationPreferences,
        privateMessages: false,
        placement: 'bottom-left',
      },
      storage,
    )
    saveNotificationPreferences(
      'user-b',
      {
        ...defaultNotificationPreferences,
        system: false,
      },
      storage,
    )

    expect(loadNotificationPreferences('user-a', storage)).toMatchObject({
      privateMessages: false,
      placement: 'bottom-left',
      system: true,
    })
    expect(loadNotificationPreferences('USER-B', storage)).toMatchObject({
      privateMessages: true,
      placement: 'bottom-right',
      system: false,
    })
    expect(storage.values.size).toBe(2)
  })

  test('migrates supported values from the legacy browser-wide record', () => {
    const storage = createStorage()
    storage.setItem(
      'arcanelink:notification-preferences:v1',
      JSON.stringify({
        enabled: false,
        privateMessages: false,
        mentions: false,
        placement: 'bottom-left',
      }),
    )

    expect(loadNotificationPreferences('user-a', storage)).toEqual({
      ...defaultNotificationPreferences,
      enabled: false,
      privateMessages: false,
      mentions: false,
      placement: 'bottom-left',
    })
    expect(
      storage.values.has(getNotificationPreferencesStorageKey('user-a')),
    ).toBe(true)
    expect(storage.values.has('arcanelink:notification-preferences:v1')).toBe(
      false,
    )
    expect(loadNotificationPreferences('user-b', storage)).toEqual(
      defaultNotificationPreferences,
    )
  })

  test('rejects invalid persisted field values', () => {
    expect(
      parseNotificationPreferences(
        JSON.stringify({
          enabled: 'yes',
          privateMessages: 0,
          serverInvites: false,
          system: null,
          placement: 'top-right',
        }),
      ),
    ).toEqual({
      ...defaultNotificationPreferences,
      serverInvites: false,
    })
    expect(parseNotificationPreferences('{broken')).toEqual(
      defaultNotificationPreferences,
    )
  })
})
