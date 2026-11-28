import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/message-drafts-harness', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<title>Message drafts QA</title><div id="root"></div><script type="module" src="/e2e/fixtures/message-drafts.harness.tsx"></script>',
  }))
  await page.goto('/message-drafts-harness')
})

test('restores drafts after switching chats, users and reloading', async ({ page }) => {
  const composer = page.locator('textarea[name="messageBody"]')
  await composer.fill('Draft for chat one')
  await page.getByRole('button', { name: 'Switch chat' }).click()
  await expect(composer).toHaveValue('')
  await composer.fill('Draft for chat two')
  await page.getByRole('button', { name: 'Switch chat' }).click()
  await expect(composer).toHaveValue('Draft for chat one')
  await page.getByRole('button', { name: 'Switch user' }).click()
  await expect(composer).toHaveValue('')
  await page.getByRole('button', { name: 'Switch user' }).click()
  await page.reload()
  await expect(composer).toHaveValue('Draft for chat one')
  await page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click()
  await expect(composer).toHaveValue('')
  await page.reload()
  await expect(composer).toHaveValue('')
})

test('keeps the compose draft when editing is cancelled or saved', async ({ page }) => {
  const composer = page.locator('textarea[name="messageBody"]')
  await composer.fill('My unsent draft')
  await page.getByText('Original message', { exact: true }).click({ button: 'right' })
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click()
  await expect(composer).toHaveValue('Original message')
  await composer.fill('Temporary edit')
  await page.getByRole('button', { name: 'Сбросить режим редактора' }).click()
  await expect(composer).toHaveValue('My unsent draft')
  await page.reload()
  await expect(composer).toHaveValue('My unsent draft')
  await page.getByText('Original message', { exact: true }).click({ button: 'right' })
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click()
  await composer.fill('Saved edit')
  await composer.press('Enter')
  await expect(composer).toHaveValue('My unsent draft')
})

test('restores reply and mention metadata after reload', async ({ page }) => {
  const composer = page.locator('textarea[name="messageBody"]')
  await page.getByText('Original message', { exact: true }).click({ button: 'right' })
  await page.getByRole('button', { name: 'Ответить', exact: true }).click()
  await composer.fill('Hello @everyone')
  await page.getByRole('option', { name: /Все участники/ }).click()
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('arcanelink.messageDraft.v1.alice.one')
    return raw ? JSON.parse(raw).mentions : []
  })).toContainEqual({ kind: 'everyone', targetId: null, token: '@everyone', start: 6, length: 9 })
  await page.reload()
  await expect(composer).toHaveValue('Hello @everyone ')
  await expect(page.getByRole('button', { name: 'Отменить ответ' })).toBeVisible()
  await page.getByRole('button', { name: 'Отменить ответ' }).click()
  await expect(composer).toHaveValue('Hello @everyone ')
})

test('clears a successful send that finishes after leaving the chat', async ({ page }) => {
  const composer = page.locator('textarea[name="messageBody"]')
  await composer.fill('Send while leaving')
  await page.getByRole('button', { name: 'Delay sends' }).click()
  await page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click()
  await page.getByRole('button', { name: 'Switch chat' }).click()
  await page.getByRole('button', { name: 'Finish send' }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('arcanelink.messageDraft.v1.alice.one'))).toBeNull()
  await page.getByRole('button', { name: 'Switch chat' }).click()
  await expect(composer).toHaveValue('')
})

test('failed sends survive reload and late successful sends do not erase newer drafts', async ({ page }) => {
  const composer = page.locator('textarea[name="messageBody"]')
  await page.getByRole('button', { name: 'Fail sends' }).click()
  await composer.fill('Keep on failure')
  await page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click()
  await page.reload()
  await expect(composer).toHaveValue('Keep on failure')
  await page.getByRole('button', { name: 'Delay sends' }).click()
  await page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click()
  await page.getByRole('button', { name: 'Switch chat' }).click()
  await page.getByRole('button', { name: 'Switch chat' }).click()
  await composer.fill('Newer draft')
  await page.getByRole('button', { name: 'Finish send' }).click()
  await expect(composer).toHaveValue('Newer draft')
  await page.reload()
  await expect(composer).toHaveValue('Newer draft')
})
