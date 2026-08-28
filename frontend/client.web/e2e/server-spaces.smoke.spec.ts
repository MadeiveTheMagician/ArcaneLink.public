import { expect, test } from '@playwright/test'
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
