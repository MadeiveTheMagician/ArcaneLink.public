import { expect, test } from '@playwright/test'
import { serverCopy } from '../src/system/shared/copy/server.ru'
import { messageSearchCopy } from '../src/system/shared/components/message-search/messageSearch.copy'
import { mockArcaneLinkApi } from './fixtures/arcaneLinkApi'

test.beforeEach(async ({ page }) => {
  await mockArcaneLinkApi(page)
  await page.goto('/')
  await page.locator('input[autocomplete="username"]').fill('lara')
  await page.locator('input[autocomplete="current-password"]').fill('password')
  await page.locator('form').first().locator('button[type="submit"]').click()
  await page.getByRole('button', { name: /Palas/ }).click()
  await page.getByRole('button', { name: /болтальня/ }).first().click()
})

test('server opens the default text space and can send a message', async ({ page }) => {
  await expect(page.getByText('болтальня').first()).toBeVisible()
  await expect(page.getByText('Добро пожаловать в smoke path.')).toBeVisible()

  await page.getByPlaceholder(/Написать/).fill('Smoke message from Playwright')
  await page.getByRole('button', { name: 'Отправить сообщение' }).click()

  await expect(page.getByText('Smoke message from Playwright')).toBeVisible()
})

test('dropping a community into a text space preserves the draft', async ({ page }) => {
  const server = page.locator('#server-rail').getByRole('button', { name: /Palas/ })
  const composer = page.getByPlaceholder(/Написать/)
  await composer.fill('Приглашение')
  const start = (await server.boundingBox())!
  const target = (await composer.boundingBox())!

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 16 })
  await expect(page.locator('[data-server-rail-drag-preview]')).toBeVisible()
  await page.mouse.up()

  await expect(composer).toHaveValue('Приглашение')
})

test('pinned messages panel opens and expands an attached asset', async ({ page }) => {
  await page.getByRole('button', { name: 'Открыть закреплённые сообщения' }).click()

  const pinnedPanel = page.getByRole('complementary', {
    name: 'Закреплённые сообщения',
  })
  await expect(pinnedPanel).toBeVisible()
  await expect(
    pinnedPanel.getByText('Закреп с вложением для smoke-теста.'),
  ).toBeVisible()
  await expect(pinnedPanel.getByText('pinned-preview.png')).toBeVisible()

  const assetCard = pinnedPanel.locator('section').filter({
    hasText: 'pinned-preview.png',
  })
  await expect(assetCard).toHaveAttribute('data-expanded', 'false')
  await assetCard.getByRole('button', { name: /pinned-preview\.png/ }).click()
  await expect(assetCard).toHaveAttribute('data-expanded', 'true')
  await expect(pinnedPanel.locator('img[alt="pinned-preview.png"]')).toBeVisible()
})

test('message asset preview navigates with keyboard arrows', async ({ page }) => {
  await page
    .getByRole('button', { name: 'pinned-preview.png' })
    .first()
    .click()

  const preview = page.getByRole('dialog')
  await expect(preview).toHaveAttribute('aria-label', 'pinned-preview.png')

  await page.keyboard.press('ArrowLeft')
  await expect(preview).toHaveAttribute('aria-label', 'pinned-preview.png')

  await page.keyboard.press('ArrowRight')
  await expect(preview).toHaveAttribute(
    'aria-label',
    'pinned-preview-next.png',
  )

  await page.keyboard.press('ArrowRight')
  await expect(preview).toHaveAttribute(
    'aria-label',
    'pinned-preview-next.png',
  )

  await page.keyboard.press('ArrowLeft')
  await expect(preview).toHaveAttribute('aria-label', 'pinned-preview.png')

  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
})

test('message search and its filter menu stay usable with the members panel hidden', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const members = page.getByRole('complementary', {
    name: serverCopy.labels.members,
  })
  const search = page.getByRole('textbox', {
    name: serverCopy.labels.searchMessages,
  })
  const sidebar = await members.boundingBox()
  const field = await search.boundingBox()
  const chatHeader = await page.locator('[data-workspace-channel-header]').boundingBox()
  if (!sidebar || !field || !chatHeader) throw new Error('The search, header, or members panel is missing')
  expect(field.y).toBeGreaterThanOrEqual(chatHeader.y)
  expect(field.y + field.height).toBeLessThanOrEqual(chatHeader.y + chatHeader.height + 1)
  expect(Math.abs(sidebar.y - (chatHeader.y + chatHeader.height))).toBeLessThanOrEqual(1)

  const searchWidth = field.width
  const resizer = page.locator('[data-members-resizer=true]')
  const handle = await resizer.boundingBox()
  if (!handle) throw new Error('The members resize handle is missing')
  const x = handle.x + handle.width / 2
  const y = handle.y + 50

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 70, y, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await members.boundingBox())?.width).toBeGreaterThan(sidebar.width + 20)
  await expect.poll(async () => (await search.boundingBox())?.width).toBeCloseTo(searchWidth, 0)

  await page.mouse.move(x - 70, y)
  await page.mouse.down()
  await page.mouse.move(x + 35, y, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await members.boundingBox())?.width).toBeLessThan(sidebar.width - 15)
  await expect.poll(async () => (await search.boundingBox())?.width).toBeCloseTo(searchWidth, 0)

  await page.getByRole('button', { name: 'Скрыть участников', exact: true }).click()
  await expect(members).toBeHidden()
  await expect(search).toBeVisible()
  await expect.poll(async () => (await search.boundingBox())?.width).toBeCloseTo(searchWidth, 0)
  await search.click()

  const menu = page.getByRole('listbox', {
    name: serverCopy.labels.searchMessages,
  })
  await expect(menu.getByText(messageSearchCopy.filters.menuTitle)).toBeVisible()
  await menu.getByText(messageSearchCopy.filters.attachmentDescription).click()
  await menu.getByText(messageSearchCopy.attachments.image, { exact: true }).click()
  await expect(page.getByRole('button', {
    name: messageSearchCopy.chips.attachment(messageSearchCopy.attachments.image),
  })).toBeVisible()
  await expect(menu).toBeHidden()
})

test('the favorites panel resizes on either side of opening a space', async ({ page }) => {
  await page.getByRole('button', { name: 'Общий раздел', exact: true }).click({ button: 'right' })
  await page.getByRole('button', { name: 'Добавить в избранное', exact: true }).click()
  await page.locator('#server-rail').getByRole('button', { name: 'Избранное', exact: true }).click()

  const panel = page.getByRole('complementary', { name: 'Избранное', exact: true })
  const resizer = page.locator('[data-favorites-resizer=true]')
  const initial = await panel.boundingBox()
  if (!initial) throw new Error('The favorites panel is missing')
  async function drag(delta: number) {
    const handle = await resizer.boundingBox()
    if (!handle) throw new Error('The favorites resize handle is missing')
    const x = handle.x + handle.width / 2
    const y = handle.y + 130
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + delta, y, { steps: 6 })
    await page.mouse.up()
  }
  await drag(86)
  await expect.poll(async () => (await panel.boundingBox())?.width).toBeGreaterThan(initial.width + 50)

  await panel.getByRole('button', { name: 'болтальня', exact: true }).click()
  await expect(page.getByText('Добро пожаловать в smoke path.')).toBeVisible()
  await expect.poll(async () => (await panel.boundingBox())?.width).toBeGreaterThan(initial.width + 50)
  await drag(-126)
  await expect.poll(async () => (await panel.boundingBox())?.width).toBeLessThan(initial.width - 15)
  await expect(page.getByText('Добро пожаловать в smoke path.')).toBeVisible()

  await page.setViewportSize({ width: 520, height: 800 })
  await expect(resizer).toBeHidden()
})
