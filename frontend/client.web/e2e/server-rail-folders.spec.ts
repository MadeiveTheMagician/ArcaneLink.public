import { expect, test, type Locator, type Page } from '@playwright/test'

async function drag(page: Page, source: Locator, target: Locator, x = 0.5, y = 0.5) {
  const start = await source.boundingBox()
  const end = await target.boundingBox()
  if (!start || !end) throw new Error('Drag source or target is unavailable')
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width * x, end.y + end.height * y, { steps: 14 })
  await page.mouse.up()
}

test('server rail drags freely without scrolling, reorders, groups and edits folders', async ({ page }) => {
  await page.route('**/server-rail-harness', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<div id="root"></div><script type="module" src="/e2e/fixtures/server-rail-folders.harness.tsx"></script>',
  }))
  await page.goto('/server-rail-harness')
  const rail = page.locator('#server-rail')
  const alpha = rail.getByRole('button', { name: 'Открыть сервер Alpha' })
  const beta = rail.getByRole('button', { name: 'Открыть сервер Beta' })
  const gamma = rail.getByRole('button', { name: 'Открыть сервер Gamma' })
  const layout = async () => JSON.parse((await page.getByTestId('layout').textContent()) ?? '[]')
  await expect(alpha).toBeVisible()
  const beforeHover = (await alpha.boundingBox())!
  await page.mouse.move(beforeHover.x + 4, beforeHover.y + beforeHover.height - 1)
  await expect.poll(() => alpha.boundingBox()).toEqual(beforeHover)

  await drag(page, gamma, beta, 0.1)
  await expect.poll(async () => (await layout()).map((entry: { id: string }) => entry.id)).toEqual(['0', '2', '1', '3'])

  const mergeAnimation = page.waitForFunction(() =>
    document.querySelector('[data-merged]')?.getAnimations().some((animation) => animation instanceof CSSAnimation),
  )
  const opening = page.waitForFunction(() =>
    document.querySelector('[data-folder-open="true"]')?.getAnimations().some((motion) =>
      motion instanceof CSSTransition && motion.transitionProperty === 'grid-template-rows',
    ),
  )
  await drag(page, alpha, gamma)
  await mergeAnimation
  await opening
  await page.locator('[data-folder-open="true"]').evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  )
  const folder = rail.getByRole('button', { name: 'Папка Новая папка' })
  await expect(folder).toHaveAttribute('aria-expanded', 'true')
  await expect.poll(async () => (await layout())[0]).toMatchObject({ kind: 'folder', serverIds: ['2', '0'] })
  await expect(alpha).toBeVisible()

  await folder.hover()
  const folderTooltip = page.getByRole('tooltip').filter({ hasText: 'Новая папка' })
  await expect(folderTooltip.locator('strong')).toHaveText('Новая папка')
  await expect(folderTooltip.getByRole('listitem')).toHaveText(['Gamma', 'Alpha'])
  const titleRows = await folderTooltip.getByRole('listitem').evaluateAll((rows) =>
    rows.map((row) => row.getBoundingClientRect().top),
  )
  expect(titleRows[1]).toBeGreaterThan(titleRows[0])
  await page.mouse.move(300, 380)
  await expect(folderTooltip).toBeHidden()

  const members = rail.locator('#' + (await folder.getAttribute('aria-controls'))?.replaceAll(':', '\\:'))
  const memberPanel = await members.boundingBox()
  const serverButton = await alpha.boundingBox()
  expect(memberPanel!.width).toBeGreaterThan(serverButton!.width * 2)
  expect(serverButton!.width).toBeGreaterThan(43.5)
  const firstMember = (await gamma.boundingBox())!
  expect(firstMember.x - memberPanel!.x).toBeGreaterThanOrEqual(5)
  expect(serverButton!.x - firstMember.x - firstMember.width).toBeGreaterThanOrEqual(8)

  const list = rail.locator('[aria-busy]')
  await list.evaluate((element) => { element.style.cssText = 'max-height: 140px; grid-auto-rows: max-content' })
  const listBounds = (await list.boundingBox())!
  const start = (await alpha.boundingBox())!
  const stationaryFolder = await folder.boundingBox()
  expect((await gamma.boundingBox())!.x - listBounds.x).toBeGreaterThanOrEqual(4)
  expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)

  const dragY = start.y + start.height / 2
  await page.mouse.move(start.x + start.width / 2, dragY)
  await page.mouse.down()
  await page.mouse.move(listBounds.x + listBounds.width + 120, dragY, { steps: 8 })
  await expect(page.locator('body')).toHaveClass(/is-server-rail-dragging/)
  const preview = page.locator('[data-server-rail-drag-preview]')
  await expect.poll(async () => (await preview.boundingBox())?.x ?? 0).toBeGreaterThan(listBounds.x + listBounds.width)
  await page.mouse.move(0, dragY, { steps: 8 })
  await expect.poll(async () => (await preview.boundingBox())?.x ?? 0).toBeLessThan(listBounds.x)
  await page.mouse.move(listBounds.x + listBounds.width / 2, listBounds.y + listBounds.height - 3, { steps: 8 })
  // Allow time for the drag library's edge-scroll interval to run.
  await page.waitForTimeout(300)
  expect(await list.evaluate((element) => [element.scrollLeft, element.scrollTop])).toEqual([0, 0])
  expect(await folder.boundingBox()).toEqual(stationaryFolder)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await list.evaluate((element) => { element.removeAttribute('style') })

  await expect(rail.getByRole('button', { name: /Действия с папкой/ })).toHaveCount(0)
  await folder.click({ button: 'right' })
  const movement = page.getByRole('group', { name: 'Перемещение' })
  await expect(movement.getByRole('button', { name: 'Переместить вверх' })).toBeDisabled()
  await movement.getByRole('button', { name: 'Переместить вниз' }).click()
  await expect.poll(async () => (await layout())[1].kind).toBe('folder')
  await folder.click({ button: 'right' })
  await movement.getByRole('button', { name: 'Переместить вверх' }).click()
  await expect.poll(async () => (await layout())[0].kind).toBe('folder')
  await folder.click({ button: 'right' })
  await page.getByRole('button', { name: 'Настроить папку' }).click()
  const dialog = page.getByRole('dialog', { name: 'Настроить папку' })
  await expect(dialog).toBeVisible()

  const palette = dialog.getByRole('group', { name: 'Цвет рамки' })
  const backgroundBefore = await palette.evaluate((element) => getComputedStyle(element).backgroundImage)
  await dialog.getByRole('button', { name: 'Отмена' }).click()
  await page.getByRole('button', { name: 'Light theme' }).click()
  await folder.click({ button: 'right' })
  await page.getByRole('button', { name: 'Настроить папку' }).click()
  await expect(palette).not.toHaveCSS('background-image', backgroundBefore)
  const colorField = dialog.getByRole('textbox', { name: 'Цвет рамки' })
  const preset = palette.getByRole('button', { name: 'Выбрать цвет #42d4a7' })
  await preset.click()
  await expect(preset).toHaveAttribute('aria-pressed', 'true')
  await expect(colorField).toHaveValue('#42d4a7')
  await colorField.fill('#bad')
  await expect(dialog.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
  await dialog.getByLabel('Название').fill('Команда')

  await colorField.fill('#418AF2')
  const customColor = palette.getByRole('button', { name: 'Свой цвет' })
  await expect(customColor).toHaveAttribute('aria-expanded', 'false')
  await customColor.click()
  const hue = palette.getByRole('slider', { name: 'Оттенок' })
  const colorPlane = palette.getByRole('slider', { name: 'Насыщенность и яркость' })
  await expect(hue).toBeVisible()
  await hue.press('Home')
  await expect(hue).toHaveValue('0')
  const plane = (await colorPlane.boundingBox())!
  await page.mouse.move(plane.x + plane.width * 0.3, plane.y + plane.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(plane.x + plane.width * 0.72, plane.y + plane.height * 0.44, { steps: 6 })
  await page.mouse.up()
  await expect(colorPlane).toHaveAttribute('aria-valuenow', '72')
  await expect(colorField).toHaveValue(/^#[0-9a-f]{6}$/)
  const pointerColor = await colorField.inputValue()
  await colorPlane.press('Shift+ArrowUp')
  await expect(colorField).not.toHaveValue(pointerColor)
  const selectedColor = await colorField.inputValue()
  await customColor.click()
  await expect(colorPlane).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(dialog).toHaveCount(0)
  const namedFolder = rail.getByRole('button', { name: 'Папка Команда' })
  await expect(namedFolder).toBeVisible()
  await expect.poll(async () => (await layout())[0]).toMatchObject({ name: 'Команда', color: selectedColor })

  const utilities = rail.locator('[aria-label="Hub actions"]')
  await expect(utilities).toHaveCSS('grid-template-columns', /^\S+ \S+ \S+$/)
  const startedReflow = page.evaluate(() => new Promise<boolean>((resolve) => {
    const watch = () => {
      const items = document.querySelectorAll('[data-rail-item="rail:end"], [data-rail-item^="utility:"]')
      if (items.length === 4 && Array.from(items).every((item) => item.getAnimations().some((animation) => !(animation instanceof CSSAnimation)))) {
        resolve(true)
      } else {
        requestAnimationFrame(watch)
      }
    }
    requestAnimationFrame(watch)
    setTimeout(() => resolve(false), 3000)
  }))
  await page.getByRole('button', { name: 'One column' }).click()
  expect(await startedReflow).toBe(true)
  await expect(utilities).toHaveCSS('grid-template-columns', /^\S+$/)
  const oneColumn = await members.boundingBox()
  expect(oneColumn!.height).toBeGreaterThan(serverButton!.height * 2)

  await alpha.click({ button: 'right' })
  await page.getByRole('button', { name: 'Вынести из папки' }).click()
  await expect.poll(async () => (await layout())[0]).toMatchObject({ kind: 'folder', serverIds: ['2'] })
  await expect.poll(async () => (await layout())[1]).toEqual({ kind: 'server', id: '0' })

  const closing = page.waitForFunction(() =>
    document.querySelector('[data-folder-open="false"]')?.getAnimations().some((motion) =>
      motion instanceof CSSTransition && motion.transitionProperty === 'grid-template-rows',
    ),
  )
  await namedFolder.click()
  await closing
  await expect(namedFolder).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('[data-folder-open]')).toHaveCount(0)
  await expect(gamma).toHaveCount(0)
  await expect(alpha).toBeVisible()
})
