import { expect, test } from '@playwright/test'
import { mockArcaneLinkApi } from './fixtures/arcaneLinkApi'
import type { PrivateSpaceResponse } from '../src/shared/types'

const recordSeparator = '\x1e'
const privateSpace: PrivateSpaceResponse = {
  spaceId: 'private-test',
  createdByUserId: 'user-owner',
  ownerUserId: 'user-owner',
  kind: 'group',
  title: 'Тестовая переписка',
  description: null,
  avatarAssetId: null,
  avatarCropOffsetX: 0,
  avatarCropOffsetY: 0,
  avatarCropZoom: 1,
  createdAt: '2026-06-21T12:00:00.000Z',
  updatedAt: '2026-06-21T12:00:00.000Z',
  deletedAt: null,
  unreadCount: 0,
  viewerSettings: {
    note: null,
    customNickname: null,
    customAvatarAssetId: null,
    customAvatarCropOffsetX: 0,
    customAvatarCropOffsetY: 0,
    customAvatarCropZoom: 1,
    mutedUntil: null,
    isMutedIndefinitely: false,
    isPeerBlocked: false,
  },
  members: [],
  lastMessage: null,
}

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'],
})

test('keeps the detached voice workspace active while navigating the hub', async ({ page }) => {
  await mockArcaneLinkApi(page)
  await page.route('**/api/private-spaces', (route) => route.fulfill({ json: [privateSpace] }))
  await page.route('**/hubs/realtime/negotiate?*', (route) => route.fulfill({
    json: {
      negotiateVersion: 1,
      connectionId: 'test-connection',
      connectionToken: 'test-connection',
      availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text'] }],
    },
  }))
  await page.route('**/api/voice/ice-servers', (route) => route.fulfill({
    json: {
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      iceTransportPolicy: 'relay',
      iceServers: [{
        urls: ['turn:127.0.0.1:3478'],
        username: 'test-user',
        credential: 'test-credential',
        credentialType: 'password',
      }],
    },
  }))
  await page.routeWebSocket(/\/hubs\/realtime\?/, (socket) => {
    socket.onMessage((data) => {
      for (const message of data.toString().split(recordSeparator).filter(Boolean)) {
        const invocation = JSON.parse(message)
        if (invocation.protocol) {
          socket.send('{}' + recordSeparator)
        } else if (invocation.invocationId !== undefined) {
          const result = invocation.target === 'JoinVoiceChannel'
            ? 'local-participant'
            : invocation.target === 'GetIncomingPrivateCalls' ? [] : null
          socket.send(JSON.stringify({ type: 3, invocationId: invocation.invocationId, result }) + recordSeparator)
        } else if (invocation.type === 6) {
          socket.send(JSON.stringify({ type: 6 }) + recordSeparator)
        }
      }
    })
  })

  await page.goto('/')
  await page.locator('input[autocomplete="username"]').fill('lara')
  await page.locator('input[autocomplete="current-password"]').fill('password')
  await page.locator('form').first().locator('button[type="submit"]').click()
  await page.getByRole('button', { name: /Palas/ }).click()
  await page.getByRole('button', { name: 'голосовая' }).click()

  const openSettings = page.getByRole('button', { name: 'Настройки', exact: true })
  const openWindow = page.getByRole('button', { name: 'Открыть спейс в отдельном окне' })
  await openSettings.focus()
  await page.keyboard.press('Enter')
  const popupPromise = page.waitForEvent('popup')
  await openWindow.focus()
  await page.keyboard.press('Enter')
  const popup = await popupPromise
  await expect(popup).toHaveTitle('голосовая - трансляции')

  await page.getByRole('button', { name: 'Open profile' }).click()
  await expect(openSettings).toBeHidden()
  await expect(popup).toHaveTitle('голосовая - трансляции')

  await page.getByRole('button', { name: 'Тестовая переписка' }).click()
  await expect(page.locator('[data-workspace-transition-key="private-space:private-test"]')).toBeVisible()
  await expect(popup).toHaveTitle('голосовая - трансляции')
  await popup.locator('.arcane-detached-content').hover()
  await popup.getByRole('button', { name: 'Выключить микрофон' }).focus()
  await popup.keyboard.press('Enter')
  await expect(popup.getByRole('button', { name: 'Включить микрофон' })).toBeAttached()

  await page.getByRole('button', { name: /Palas/ }).click()
  await expect(openSettings).toBeVisible()
  await expect(popup).toHaveTitle('голосовая - трансляции')
  const voiceDock = page.getByRole('complementary', { name: 'Голосовое подключение' })
  await Promise.all([
    popup.waitForEvent('close'),
    voiceDock.getByRole('button', { name: 'Выйти из канала' }).click(),
  ])
})
