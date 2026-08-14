import { expect, test } from '@playwright/test'
import { mockArcaneLinkApi } from './fixtures/arcaneLinkApi'

test('user can sign in and reach the hub shell', async ({ page }) => {
  await mockArcaneLinkApi(page)

  await page.goto('/')
  await expect(page.locator('form').first()).toBeVisible()

  await page.locator('input[autocomplete="username"]').fill('lara')
  await page.locator('input[autocomplete="current-password"]').fill('password')
  await page.locator('form').first().locator('button[type="submit"]').click()

  await expect(page.getByRole('button', { name: 'Open profile' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Palas/ })).toBeVisible()
})
