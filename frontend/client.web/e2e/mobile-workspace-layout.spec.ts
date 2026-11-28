import { expect, test, type Page } from '@playwright/test'
import type { PrivateSpaceResponse } from '../src/shared/types'
import { mockArcaneLinkApi } from './fixtures/arcaneLinkApi'

const recordSeparator = '\x1e'
const privateSpace: PrivateSpaceResponse = {
  spaceId: 'private-test',
  createdByUserId: 'user-owner',
  ownerUserId: 'user-owner',
  kind: 'group',
  title: 'Очень длинное название групповой переписки для проверки поля ввода сообщения',
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
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'],
})

async function signIn(page: Page) {
  await page.goto('/')
  await page.locator('input[autocomplete="username"]').fill('lara')
  await page.locator('input[autocomplete="current-password"]').fill('password')
  await page.locator('form').first().locator('button[type="submit"]').click()
}

test('mobile lists show icon actions and message search opens below the header', async ({ page }) => {
  await mockArcaneLinkApi(page)
  await page.addInitScript(() => localStorage.setItem('arcanelink.favoriteSpaces.v1.user-owner', JSON.stringify([
    { serverId: 'server-palas', spaceId: 'space-chat' },
  ])))
  await page.route('**/api/private-spaces', (route) => route.fulfill({ json: [privateSpace] }))
  await page.route('**/api/private-spaces/private-test/**', (route) => route.fulfill({ json: [] }))
  await signIn(page)
  const nav = page.getByRole('navigation', { name: 'Мобильная навигация' })
  await nav.getByRole('button', { name: 'Серверы' }).click()
  const heading = page.getByRole('heading', { name: 'Серверы', exact: true })
  const header = heading.locator('..')
  const create = header.getByRole('button', { name: 'Создать сервер', exact: true })
  const favorite = header.getByRole('button', { name: 'Избранное', exact: true })
  await expect(create).toBeVisible()
  await expect(favorite).toBeVisible()
  await expect(create).toHaveText('')
  await expect(favorite).toHaveText('★')
  const [title, add, star] = await Promise.all([heading.boundingBox(), create.boundingBox(), favorite.boundingBox()])
  if (!title || !add || !star) throw new Error('Missing mobile server header controls')
  expect(star.x).toBeGreaterThan(add.x)
  expect(Math.abs(title.y + title.height / 2 - (star.y + star.height / 2))).toBeLessThan(2)
  await favorite.click()
  await expect(page.getByRole('complementary', { name: 'Избранное', exact: true })).toBeVisible()

  await nav.getByRole('button', { name: 'Сообщения' }).click()
  await page.getByRole('button', { name: new RegExp(privateSpace.title ?? '') }).tap({ force: true })
  const composer = page.locator('textarea[name=messageBody]')
  const placeholder = composer.locator('..').locator('span[aria-hidden=true]').last()
  await expect(composer).toBeVisible()
  const overflow = await placeholder.evaluate((element) => ({
    overflow: element.scrollWidth > element.clientWidth,
    ellipsis: getComputedStyle(element).textOverflow,
    whiteSpace: getComputedStyle(element).whiteSpace,
  }))
  expect(overflow).toEqual({ overflow: true, ellipsis: 'ellipsis', whiteSpace: 'nowrap' })
  const empty = await composer.boundingBox()
  await composer.fill('Тест')
  const singleLine = await composer.boundingBox()
  expect(empty?.height).toBe(singleLine?.height)
  await composer.fill('Первая строка\nВторая строка')
  await expect.poll(async () => (await composer.boundingBox())?.height).toBeGreaterThan(singleLine?.height ?? 0)

  const lens = page.getByRole('button', { name: 'Поиск сообщений', exact: true })
  const search = page.getByRole('textbox', { name: 'Поиск сообщений', exact: true })
  await expect(lens).toBeVisible()
  await expect(search).toBeHidden()
  await lens.click()
  await expect(search).toBeVisible()
  await expect(lens).toHaveAttribute('aria-expanded', 'true')
  await search.click()
  const filters = page.getByRole('listbox', { name: 'Поиск сообщений', exact: true })
  await expect(filters).toBeVisible()
  await filters.getByText('Поиск определённого типа данных', { exact: false }).click()
  await expect(search).toBeVisible()
  await lens.click()
  await expect(search).toBeHidden()

  await page.getByRole('button', { name: 'Вернуться к личным сообщениям' }).click()
  await nav.getByRole('button', { name: 'Серверы' }).click()
  await create.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('collapsed mobile voice panel can be dragged again and reopened at its new position', async ({ page }) => {
  await mockArcaneLinkApi(page)
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
  await signIn(page)
  await page.getByRole('navigation', { name: 'Мобильная навигация' }).getByRole('button', { name: 'Серверы' }).click()
  await page.getByRole('button', { name: /Palas/ }).click()
  await page.getByRole('button', { name: 'Открыть сервер' }).click()
  await page.getByRole('button', { name: 'Вернуться к спейсам' }).click()
  await page.getByRole('button', { name: 'голосовая' }).click()
  await page.getByRole('button', { name: 'Войти в голосовой спейс' }).click()
  const collapse = page.getByRole('button', { name: 'Свернуть панель голосового подключения' })
  const collapsed = page.locator('[data-mobile-voice-collapsed=true]')
  await collapse.click()
  await expect(collapsed).toBeVisible()

  const cdp = await page.context().newCDPSession(page)
  async function drag(dx: number, dy: number) {
    const bounds = await collapsed.boundingBox()
    if (!bounds) throw new Error('The collapsed voice panel is missing')
    const x = bounds.x + bounds.width / 2
    const y = bounds.y + bounds.height / 2
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (const step of [0.3, 0.6, 1]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step, y: y + dy * step }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(collapsed).toBeVisible()
    await expect.poll(async () => (await collapsed.boundingBox())?.x).toBeCloseTo(bounds.x + dx, 0)
    await expect.poll(async () => (await collapsed.boundingBox())?.y).toBeCloseTo(bounds.y + dy, 0)
  }
  await drag(-100, -130)
  await drag(-40, -100)

  const final = await collapsed.boundingBox()
  if (!final) throw new Error('The moved voice panel is missing')
  await expect(collapsed).toBeEnabled()
  await collapsed.tap()
  await expect(collapse).toBeVisible()
  await collapse.tap()
  await expect.poll(async () => (await collapsed.boundingBox())?.x).toBeCloseTo(final.x, 0)
  await expect.poll(async () => (await collapsed.boundingBox())?.y).toBeCloseTo(final.y, 0)
  await drag(45, -35)
})
