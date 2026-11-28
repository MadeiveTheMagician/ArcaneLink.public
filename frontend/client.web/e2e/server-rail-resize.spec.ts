import { expect, test } from '@playwright/test'
import { settingsCopy, voiceCopy } from '../src/system/shared/copy'
import { systemSettingsNavigationEventName } from '../src/system/shared/navigation/systemSettingsNavigation'
import { mockArcaneLinkApi } from './fixtures/arcaneLinkApi'

test('resizes the server rail and remembers its width when toggled off', async ({ page }) => {
  await mockArcaneLinkApi(page)
  await page.goto('/')
  async function signIn() {
    await page.locator('input[autocomplete="username"]').fill('lara')
    await page.locator('input[autocomplete="current-password"]').fill('password')
    await page.locator('form').first().locator('button[type="submit"]').click()
  }
  await signIn()

  const rail = page.locator('#server-rail')
  const separator = page.getByRole('separator', { name: settingsCopy.interface.serverRailWidth })
  await expect(rail.getByRole('button', { name: 'Palas' })).toBeVisible()
  await expect(rail).toHaveCSS('width', '74.5px')
  const bounds = await separator.boundingBox()
  if (!bounds) throw new Error('Resize separator is missing')

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 180)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 53, bounds.y + 180, { steps: 8 })
  await page.mouse.up()
  await expect(separator).toHaveAttribute('aria-valuenow', '2')
  await expect(rail).toHaveCSS('width', '135.5px')
  await expect(page.locator('.profile-page')).toHaveCSS('padding-left', '135.5px')

  await separator.press('ArrowRight')
  await expect(separator).toHaveAttribute('aria-valuenow', '3')
  await page.reload()
  await signIn()
  await expect(separator).toHaveAttribute('aria-valuenow', '3')

  async function openInterfaceSettings() {
    await page.evaluate((eventName) => {
      window.dispatchEvent(new CustomEvent(eventName, {
        detail: { requestId: crypto.randomUUID(), tab: 'interface', targetId: null },
      }))
    }, systemSettingsNavigationEventName)
    const dialog = page.getByRole('dialog', { name: settingsCopy.root.title })
    await dialog.getByRole('navigation', { name: settingsCopy.root.tabs })
      .getByRole('button', { name: settingsCopy.interface.advancedFeatures, exact: true })
      .click()
    return dialog
  }

  let dialog = await openInterfaceSettings()
  const resizeToggle = () => dialog.getByRole('checkbox', {
    name: new RegExp(settingsCopy.interface.enableServerRailResize),
  })
  await dialog.getByText(settingsCopy.interface.enableServerRailResize, { exact: true }).click()
  await expect(resizeToggle()).not.toBeChecked()
  await expect(separator).toBeHidden()
  await expect(rail).toHaveCSS('width', '74.5px')
  await dialog.getByRole('button', { name: settingsCopy.root.close }).click()
  await expect(dialog).toBeHidden()

  await page.reload()
  await signIn()
  await expect(rail.getByRole('button', { name: 'Palas' })).toBeVisible()
  await expect(separator).toBeHidden()
  dialog = await openInterfaceSettings()
  await expect(resizeToggle()).not.toBeChecked()
  await dialog.getByText(settingsCopy.interface.enableServerRailResize, { exact: true }).click()
  await expect(resizeToggle()).toBeChecked()
  await dialog.getByRole('button', { name: settingsCopy.root.close }).click()
  await expect(separator).toHaveAttribute('aria-valuenow', '3')
  await expect(rail).toHaveCSS('width', '196.5px')

  await page.setViewportSize({ width: 600, height: 720 })
  await expect(separator).toBeHidden()
  await expect(rail).toBeHidden()
})

test('voice dock stays clear of the server rail throughout motion and resizing', async ({ page }) => {
  await mockArcaneLinkApi(page, { isServerRailPinned: false })
  await page.addInitScript(() => {
    localStorage.setItem('arcanelink.serverRailPreferences.v1.user-owner', JSON.stringify({
      resizeEnabled: true,
      columnCount: 3,
    }))
  })
  await page.goto('/')
  await page.locator('input[autocomplete="username"]').fill('lara')
  await page.locator('input[autocomplete="current-password"]').fill('password')
  await page.locator('form').first().locator('button[type="submit"]').click()

  const rail = page.locator('#server-rail')
  const toggle = page.getByRole('complementary', { name: voiceCopy.dock.label })
    .getByRole('button', { name: /закладку серверов/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(async () => (await rail.boundingBox())?.x).toBe(0)

  for (const opening of [false, true]) {
    const samples = await toggle.evaluate(async (button) => {
      const railElement = document.getElementById('server-rail')!
      const dock = button.closest('aside')!
      const frames: { edge: number; gap: number }[] = []
      button.click()
      const start = performance.now()
      do {
        await new Promise(requestAnimationFrame)
        const edge = railElement.getBoundingClientRect().right
        frames.push({ edge, gap: dock.getBoundingClientRect().left - Math.max(0, edge) })
      } while (performance.now() - start < 340)
      return frames
    })
    await expect(toggle).toHaveAttribute('aria-expanded', String(opening))
    expect(samples.some(({ edge }) => edge > 10 && edge < 150)).toBe(true)
    expect(Math.min(...samples.map(({ gap }) => gap))).toBeGreaterThanOrEqual(9)
  }

  const seam = page.getByRole('separator', { name: settingsCopy.interface.serverRailWidth })
  await seam.press('ArrowRight')
  await expect(rail).toHaveCSS('width', '257.5px')
  const gap = await toggle.evaluate((button) =>
    button.closest('aside')!.getBoundingClientRect().left -
    document.getElementById('server-rail')!.getBoundingClientRect().right,
  )
  expect(gap).toBeGreaterThanOrEqual(9)
})
