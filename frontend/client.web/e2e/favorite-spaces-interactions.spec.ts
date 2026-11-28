import { expect, test, type Page } from '@playwright/test'
import { mockArcaneLinkApi } from './fixtures/arcaneLinkApi'

async function signInWithFavorites(page: Page) {
  await mockArcaneLinkApi(page, { withVoiceChat: true })
  await page.addInitScript(() => {
    localStorage.setItem('arcanelink.favoriteSpaces.v1.user-owner', JSON.stringify([
      { serverId: 'server-palas', spaceId: 'space-category' },
      { serverId: 'server-palas', spaceId: 'space-chat' },
    ]))
  })
  await page.goto('/')
  await page.locator('input[autocomplete="username"]').fill('lara')
  await page.locator('input[autocomplete="current-password"]').fill('password')
  await page.locator('form').first().locator('button[type="submit"]').click()
}

test('favorites use space menus and open a voice chat without joining the call', async ({ page }) => {
  await signInWithFavorites(page)
  await page.locator('#server-rail').getByRole('button', { name: 'Избранное', exact: true }).click()
  const favorites = page.getByRole('complementary', { name: 'Избранное' })
  await expect(favorites.getByRole('button', { name: /Убрать.*из избранного/ })).toHaveCount(0)

  await favorites.getByRole('button', { name: 'голосовая', exact: true }).click({ button: 'right' })
  await page.getByRole('button', { name: 'Открыть чат голосового спейса', exact: true }).click()
  const join = page.getByRole('button', { name: 'Войти в голосовой спейс' })
  await expect(join).toBeVisible()
  await expect(page.locator('textarea[name="messageBody"]')).toBeVisible()

  const category = favorites.getByRole('button', { name: 'Общий раздел', exact: true })
  await category.focus()
  await category.press('Shift+F10')
  await page.getByRole('button', { name: 'Убрать из избранного', exact: true }).click()
  await expect(category).toHaveCount(0)
  await expect(favorites.getByRole('button', { name: 'болтальня', exact: true })).toHaveCount(1)
  await favorites.getByRole('button', { name: 'болтальня', exact: true }).click({ button: 'right' })
  await page.getByRole('button', { name: 'Открыть чат', exact: true }).click()
  await expect(page.getByText('Добро пожаловать в smoke path.')).toBeVisible()
})

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('long-press opens the favorites menu and the voice chat shortcut opens the composer', async ({ page }) => {
    await signInWithFavorites(page)
    await page.getByRole('navigation', { name: 'Мобильная навигация' })
      .getByRole('button', { name: 'Серверы' }).tap()
    await page.getByRole('button', { name: 'Избранное', exact: true }).tap()
    const favorites = page.getByRole('complementary', { name: 'Избранное' })
    const favoriteChat = favorites.getByRole('button', { name: 'болтальня', exact: true }).last()
    const bounds = await favoriteChat.boundingBox()
    if (!bounds) throw new Error('The favorite text space is missing')

    const session = await page.context().newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }],
    })
    const remove = page.getByRole('button', { name: 'Убрать из избранного', exact: true })
    await expect(remove).toBeVisible()
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(remove).toBeVisible()
    await remove.tap()
    await expect(favorites.getByRole('button', { name: 'болтальня', exact: true })).toHaveCount(1)

    await favorites.getByRole('button', { name: 'Открыть чат голосового спейса голосовая' }).tap()
    await expect(page.locator('textarea[name="messageBody"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Войти в голосовой спейс' })).toBeVisible()
    await page.getByRole('button', { name: 'Вернуться к спейсам сервера' }).tap()
    await expect(favorites.getByRole('button', { name: 'болтальня', exact: true })).toBeInViewport()
    await favorites.getByRole('button', { name: 'болтальня', exact: true }).tap()
    await expect(page.getByText('Добро пожаловать в smoke path.')).toBeVisible()
  })
})

test('compact desktop header buttons stay fixed while the members panel animates', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 820 })
  await signInWithFavorites(page)
  await page.getByRole('button', { name: /Palas/ }).click()
  await page.getByRole('button', { name: /болтальня/ }).first().click()
  const pin = page.getByRole('button', { name: 'Открыть закреплённые сообщения' })
  const toggle = page.getByRole('button', { name: /^(Скрыть|Показать) участников$/ })
  await expect(toggle).toBeVisible()

  for (const expanded of [false, true]) {
    const drift = await toggle.evaluate(async (button) => {
      const header = button.closest('[data-workspace-channel-header]')
      const pinned = header?.querySelector<HTMLButtonElement>('button[aria-pressed]')
      if (!pinned) throw new Error('The pins button is missing')

      const start = [button, pinned].map((control) => control.getBoundingClientRect().x)
      let largestMove = 0
      button.click()
      const startTime = performance.now()
      while (performance.now() - startTime <= 250) {
        await new Promise(requestAnimationFrame)
        for (const [index, control] of [button, pinned].entries()) {
          largestMove = Math.max(largestMove, Math.abs(control.getBoundingClientRect().x - start[index]))
        }
      }
      return largestMove
    })
    expect(drift).toBeLessThan(1)
    await expect(toggle).toHaveAttribute('aria-expanded', String(expanded))
  }

  const before = await pin.boundingBox()
  await pin.click()
  await expect(page.getByRole('complementary', { name: 'Закреплённые сообщения' })).toBeVisible()
  expect(await pin.boundingBox()).toEqual(before)
})
