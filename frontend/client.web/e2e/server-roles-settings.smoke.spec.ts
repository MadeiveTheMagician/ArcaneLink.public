import { expect, test, type Page } from '@playwright/test'

import type {
  ServerPermissionDefinitionResponse,
  ServerRoleResponse,
} from '../src/shared/types'
import { serverCopy } from '../src/system/shared/copy'
import {
  mockArcaneLinkApi,
  type MockCreateServerRoleRequest,
  type MockReorderServerRolesRequest,
  type MockUpdateServerMemberDisplayColorRequest,
  type MockUpdateServerRoleRequest,
} from './fixtures/arcaneLinkApi'

const roleTimestamp = '2026-06-21T12:00:00.000Z'

function createMockRole(
  id: string,
  title: string,
  level: number,
): ServerRoleResponse {
  return {
    id,
    serverId: 'server-palas',
    code: null,
    title,
    description: null,
    kind: 'standard',
    color: null,
    mentionable: false,
    createdByUserId: 'user-owner',
    level,
    isSystem: false,
    version: `${id}-version-1`,
    directAssignmentCount: 0,
    permissionSchemaVersion: 1,
    permissionCodes: [],
    permissions: [],
    createdAt: roleTimestamp,
    updatedAt: roleTimestamp,
  }
}

const serverPermissionGroups = [
  {
    group: 'access',
    codes: [
      'VIEW_TEXT_SPACES',
      'VIEW_VOICE_SPACES',
      'READ_MESSAGE_HISTORY',
      'READ_VOICE_CHAT_HISTORY',
    ],
  },
  {
    group: 'messaging',
    codes: [
      'SEND_MESSAGES',
      'SEND_MESSAGES_IN_VOICE_CHAT',
      'SEND_LINKS',
      'ATTACH_FILES',
      'ADD_REACTIONS',
      'MENTION_EVERYONE',
      'MENTION_HERE',
      'MANAGE_PINS',
      'MANAGE_MESSAGES',
    ],
  },
  {
    group: 'voice',
    codes: [
      'CONNECT_VOICE',
      'SPEAK_IN_VOICE',
      'USE_VIDEO',
      'SHARE_SCREEN',
      'MUTE_VOICE_MEMBERS',
      'DEAFEN_VOICE_MEMBERS',
      'MOVE_VOICE_MEMBERS',
      'DISCONNECT_VOICE_MEMBERS',
    ],
  },
  {
    group: 'members',
    codes: [
      'CHANGE_OWN_NICKNAME',
      'MANAGE_NICKNAMES',
      'APPROVE_JOIN_REQUESTS',
      'KICK_MEMBERS',
      'BAN_MEMBERS',
      'MANAGE_BANS',
      'TIMEOUT_MEMBERS',
    ],
  },
  {
    group: 'roles',
    codes: [
      'MANAGE_ROLES',
      'ASSIGN_ROLES',
      'MANAGE_DEFAULT_PERMISSIONS',
      'ADMINISTRATOR',
    ],
  },
  {
    group: 'spaces',
    codes: [
      'MANAGE_SPACE_SETTINGS',
      'MANAGE_SPACE_ACCESS',
      'REORDER_SPACES_AND_CATEGORIES',
      'CREATE_PUBLIC_CATEGORIES',
      'CREATE_PUBLIC_TEXT_SPACES',
      'CREATE_PUBLIC_VOICE_SPACES',
      'CREATE_PRIVATE_CATEGORIES',
      'CREATE_PRIVATE_TEXT_SPACES',
      'CREATE_PRIVATE_VOICE_SPACES',
      'DELETE_CATEGORIES',
      'DELETE_TEXT_SPACES',
      'DELETE_VOICE_SPACES',
    ],
  },
  {
    group: 'server',
    codes: [
      'CREATE_INVITES',
      'VIEW_INVITE_LOG',
      'MANAGE_INVITES',
      'MANAGE_SERVER_PROFILE',
      'MANAGE_SERVER_SETTINGS',
      'VIEW_AUDIT_LOG',
      'MANAGE_REPORTS',
    ],
  },
] as const

const permissionTitles: Readonly<Record<string, string>> = {
  MANAGE_ROLES: 'Управление ролями',
  MANAGE_REPORTS: 'Управление жалобами',
  ADMINISTRATOR: 'Администратор',
}

const serverPermissionDefinitions: ServerPermissionDefinitionResponse[] =
  serverPermissionGroups
    .flatMap(({ group, codes }) =>
      codes.map((code) => ({ group, code })),
    )
    .map(({ group, code }, bit) => ({
      bit,
      code,
      group,
      title: permissionTitles[code] ?? code,
      description: null,
    }))

async function signInAndOpenServer(page: Page) {
  await page.goto('/')
  await page.locator('input[autocomplete="username"]').fill('lara')
  await page.locator('input[autocomplete="current-password"]').fill('password')
  await page.locator('form').first().locator('button[type="submit"]').click()
  await page.getByRole('button', { name: /Palas/ }).click()
}

async function openRoleSettings(page: Page) {
  const settingsTrigger = page.getByRole('button', {
    name: serverCopy.settings.title,
    exact: true,
  })
  await settingsTrigger.click()
  const dialog = page.getByRole('dialog', {
    name: serverCopy.settings.title,
  })
  await dialog
    .getByRole('button', { name: serverCopy.settings.roles, exact: true })
    .click()

  return {
    dialog,
    settingsTrigger,
    settingsDialogDom: page.locator('[data-server-settings-dialog]'),
    rolesSettings: dialog.getByRole('region', { name: 'Роли и права' }),
    roleEditor: page.getByRole('dialog', {
      name: /^(?:Создание|Редактирование) роли$/,
    }),
  }
}

test('roles settings creates a safe draft and updates it with a CAS version', async ({
  page,
}) => {
  const createRequests: MockCreateServerRoleRequest[] = []
  const updateRequests: Array<{
    roleId: string
    request: MockUpdateServerRoleRequest
  }> = []
  const displayColorRequests: MockUpdateServerMemberDisplayColorRequest[] = []

  await mockArcaneLinkApi(page, {
    serverPermissionDefinitions,
    serverMemberDisplayColor: {
      mode: 'default',
      roleId: null,
      rolesVersion: 'member-roles-version-1',
      resolvedRoleId: null,
      resolvedColor: null,
      availableRoles: [
        {
          id: 'role-purple',
          title: 'Аметист',
          color: '#8f7cff',
          level: 20,
        },
      ],
    },
    onCreateServerRole: (request) => createRequests.push(request),
    onUpdateServerRole: (roleId, request) =>
      updateRequests.push({ roleId, request }),
    onUpdateServerMemberDisplayColor: (request) =>
      displayColorRequests.push(request),
  })
  await signInAndOpenServer(page)

  await page
    .getByRole('button', { name: serverCopy.settings.title, exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: serverCopy.settings.title,
  })
  await dialog
    .getByRole('button', { name: serverCopy.settings.roles, exact: true })
    .click()

  const rolesSettings = dialog.getByRole('region', {
    name: 'Роли и права',
  })
  const roleEditor = page.getByRole('dialog', {
    name: /^(?:Создание|Редактирование) роли$/,
  })
  const settingsDialogDom = page.locator('[data-server-settings-dialog]')
  await expect(rolesSettings).toBeVisible()
  const settingsBounds = await dialog.boundingBox()
  expect(settingsBounds?.width ?? 0).toBeGreaterThan(1100)
  await expect
    .poll(() => dialog.evaluate((element) => getComputedStyle(element).animationName))
    .toContain('serverSettingsDialogIn')
  await expect
    .poll(() =>
      dialog.evaluate((element) => {
        const backdrop = element.parentElement
        return backdrop
          ? getComputedStyle(backdrop).backdropFilter ||
              getComputedStyle(backdrop).webkitBackdropFilter
          : ''
      }),
    )
    .toContain('blur')
  await rolesSettings
    .getByLabel('Цвет имени на сервере')
    .selectOption('role:role-purple')
  await expect.poll(() => displayColorRequests.length).toBe(1)
  expect(displayColorRequests[0]).toEqual({
    mode: 'role',
    roleId: 'role-purple',
    expectedRolesVersion: 'member-roles-version-1',
  })
  await expect(rolesSettings.getByText('Цвет имени обновлён.')).toBeVisible()

  const createButton = rolesSettings.getByRole('button', {
    name: 'Создать',
    exact: true,
  })
  await expect(createButton).toBeEnabled()
  await createButton.click()

  await expect(roleEditor).toBeVisible()
  await expect
    .poll(() =>
      roleEditor.evaluate((element) => getComputedStyle(element).animationName),
    )
    .toContain('serverRoleEditorDialogIn')
  await expect(settingsDialogDom).toHaveAttribute('aria-hidden', 'true')
  await expect(
    roleEditor.getByText('Безопасный черновик без прав'),
  ).toBeVisible()
  await expect(
    roleEditor.getByRole('tab', { name: 'Участники' }),
  ).toBeDisabled()

  await roleEditor.getByLabel('Название').fill('  Модераторы  ')
  await roleEditor
    .getByLabel('Описание')
    .fill('  Следят за порядком  ')
  await roleEditor
    .getByRole('button', { name: 'Выбрать цвет #8f7cff' })
    .click()
  const mentionableCheckbox = roleEditor.getByRole('checkbox', {
    name: 'Разрешить участникам упоминать эту роль',
  })
  await mentionableCheckbox.press('Space')
  await expect(mentionableCheckbox).toBeChecked()
  await roleEditor
    .getByRole('button', { name: 'Сохранить', exact: true })
    .click()

  await expect.poll(() => createRequests.length).toBe(1)
  expect(createRequests[0]).toEqual({
    title: 'Модераторы',
    description: 'Следят за порядком',
    color: '#8f7cff',
    mentionable: true,
    permissionSchemaVersion: 1,
    permissionCodes: [],
  })
  await expect(roleEditor.locator('p[role="status"]')).toHaveText(
    'Роль сохранена.',
  )
  await expect(
    roleEditor.getByRole('tab', { name: 'Участники' }),
  ).toBeEnabled()

  await roleEditor.getByRole('tab', { name: 'Права' }).click()
  const permissionSwitches = roleEditor.getByRole('switch')
  await expect(permissionSwitches).toHaveCount(51)
  for (const groupTitle of [
    'Доступ и чтение',
    'Сообщения и контент',
    'Голос и видео',
    'Участники и модерация',
    'Роли',
    'Спейсы и категории',
    'Приглашения, сервер и аудит',
  ]) {
    await expect(
      roleEditor.getByRole('heading', {
        name: groupTitle,
        exact: true,
        level: 4,
      }),
    ).toHaveCount(1)
  }

  const permissionSearch = roleEditor.getByLabel('Поиск прав')
  await permissionSearch.fill('MANAGE_REPORTS')
  await expect(permissionSwitches).toHaveCount(1)
  await expect(
    roleEditor.getByRole('switch', { name: /MANAGE_REPORTS/ }),
  ).toBeVisible()
  await permissionSearch.fill('')
  await expect(permissionSwitches).toHaveCount(51)

  const manageRolesSwitch = roleEditor.getByRole('switch', {
    name: /Управление ролями/,
  })
  await manageRolesSwitch.click()
  await expect(manageRolesSwitch).toHaveAttribute('aria-checked', 'true')
  await roleEditor.getByRole('tab', { name: 'Отображение' }).click()
  await roleEditor.getByLabel('Название').fill('Старшие модераторы')
  await roleEditor
    .getByRole('button', { name: 'Сохранить', exact: true })
    .click()

  await expect.poll(() => updateRequests.length).toBe(1)
  expect(updateRequests[0]).toEqual({
    roleId: 'server-role-1',
    request: {
      title: 'Старшие модераторы',
      description: 'Следят за порядком',
      color: '#8f7cff',
      mentionable: true,
      permissionSchemaVersion: 1,
      permissionCodes: ['MANAGE_ROLES'],
      expectedVersion: 'server-role-version-1',
    },
  })
  await expect(
    roleEditor.getByRole('heading', {
      name: 'Старшие модераторы',
      level: 3,
    }),
  ).toBeVisible()
  await expect(roleEditor.locator('p[role="status"]')).toHaveText(
    'Роль сохранена.',
  )
})

test('roles settings reorders with dnd-kit keyboard controls and locks a dirty draft', async ({
  page,
}) => {
  const reorderRequests: MockReorderServerRolesRequest[] = []
  const firstRole = createMockRole('role-alpha', 'Альфа', 10)
  const secondRole = createMockRole('role-beta', 'Бета', 20)

  await mockArcaneLinkApi(page, {
    serverPermissionDefinitions,
    serverRoles: [firstRole, secondRole],
    onReorderServerRoles: (request) => reorderRequests.push(request),
  })
  await signInAndOpenServer(page)

  await page
    .getByRole('button', { name: serverCopy.settings.title, exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: serverCopy.settings.title,
  })
  await dialog
    .getByRole('button', { name: serverCopy.settings.roles, exact: true })
    .click()
  const rolesSettings = dialog.getByRole('region', {
    name: 'Роли и права',
  })

  const alphaHandle = rolesSettings.getByRole('button', {
    name: 'Переместить роль Альфа',
  })
  await alphaHandle.press('ArrowDown')

  await expect.poll(() => reorderRequests.length).toBe(1)
  expect(reorderRequests[0]).toEqual({
    expectedAuthorizationVersion: 'authorization-version-1',
    roles: [
      { roleId: 'role-beta', expectedVersion: 'role-beta-version-1' },
      { roleId: 'role-alpha', expectedVersion: 'role-alpha-version-1' },
    ],
  })
  await expect(
    rolesSettings.getByText(
      'Роль Альфа перемещена на позицию 2 из 2.',
      { exact: true },
    ),
  ).toBeAttached()

  const roleOrder = rolesSettings.locator(
    'button[aria-label^="Редактировать роль"]',
  )
  await expect
    .poll(() =>
      roleOrder.evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute('aria-label')),
      ),
    )
    .toEqual(['Редактировать роль Бета', 'Редактировать роль Альфа'])

  const alphaPointerHandle = rolesSettings.getByRole('button', {
    name: 'Переместить роль Альфа',
  })
  const betaPointerHandle = rolesSettings.getByRole('button', {
    name: 'Переместить роль Бета',
  })
  await expect(alphaPointerHandle).toBeEnabled()
  const alphaBounds = await alphaPointerHandle.boundingBox()
  const betaBounds = await betaPointerHandle.boundingBox()
  expect(alphaBounds).not.toBeNull()
  expect(betaBounds).not.toBeNull()
  if (!alphaBounds || !betaBounds) {
    throw new Error('Role drag handles are not visible')
  }

  await page.mouse.move(
    alphaBounds.x + alphaBounds.width / 2,
    alphaBounds.y + alphaBounds.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    alphaBounds.x + alphaBounds.width / 2 + 10,
    alphaBounds.y + alphaBounds.height / 2 - 10,
    { steps: 3 },
  )
  await page.mouse.move(
    betaBounds.x + betaBounds.width / 2,
    betaBounds.y + betaBounds.height / 2,
    { steps: 12 },
  )
  await page.mouse.up()

  await expect.poll(() => reorderRequests.length).toBe(2)
  expect(reorderRequests[1]).toEqual({
    expectedAuthorizationVersion: 'authorization-version-1',
    roles: [
      {
        roleId: 'role-alpha',
        expectedVersion: 'role-alpha-version-1-reordered',
      },
      {
        roleId: 'role-beta',
        expectedVersion: 'role-beta-version-1-reordered',
      },
    ],
  })
  await expect
    .poll(() =>
      roleOrder.evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute('aria-label')),
      ),
    )
    .toEqual(['Редактировать роль Альфа', 'Редактировать роль Бета'])

  await rolesSettings
    .getByRole('button', { name: 'Редактировать роль Альфа' })
    .click()
  const roleEditor = page.getByRole('dialog', {
    name: 'Редактирование роли',
  })
  await roleEditor.getByLabel('Название').fill('Несохранённая Альфа')
  await expect(
    page.locator(
      '[data-server-settings-dialog] button[aria-label="Переместить роль Альфа"]',
    ),
  ).toBeDisabled()
  expect(reorderRequests).toHaveLength(2)
})

test('role editor keeps an unsaved draft until nested close is confirmed', async ({
  page,
}) => {
  const role = createMockRole('role-alpha', 'Альфа', 10)
  await mockArcaneLinkApi(page, {
    serverPermissionDefinitions,
    serverRoles: [role],
  })
  await signInAndOpenServer(page)
  const { settingsTrigger, settingsDialogDom, rolesSettings, roleEditor } =
    await openRoleSettings(page)

  await rolesSettings
    .getByRole('button', { name: 'Редактировать роль Альфа' })
    .click()
  await expect(roleEditor).toBeVisible()

  const titleInput = roleEditor.getByLabel('Название')
  await titleInput.fill('Несохранённая Альфа')

  page.once('dialog', (confirmation) => confirmation.dismiss())
  await roleEditor.getByRole('button', { name: 'Назад' }).click()
  await expect(roleEditor).toBeVisible()
  await expect(titleInput).toHaveValue('Несохранённая Альфа')

  page.once('dialog', (confirmation) => confirmation.dismiss())
  await page.keyboard.press('Escape')
  await expect(roleEditor).toBeVisible()
  await expect(settingsDialogDom).toBeVisible()
  await expect(titleInput).toHaveValue('Несохранённая Альфа')

  page.once('dialog', (confirmation) => confirmation.accept())
  const roleEditorBackdrop = roleEditor.locator('..')
  await roleEditor
    .getByRole('button', { name: 'Закрыть редактор роли' })
    .click()
  await expect(roleEditorBackdrop).toHaveAttribute('data-state', 'closing')
  await expect(roleEditor).toBeHidden()
  await expect(rolesSettings).toBeVisible()
  await expect(
    rolesSettings.getByRole('button', { name: 'Редактировать роль Альфа' }),
  ).toBeFocused()

  await settingsDialogDom
    .getByRole('button', { name: serverCopy.settings.spaces, exact: true })
    .click()
  await expect(rolesSettings).toBeHidden()

  const settingsBackdrop = settingsDialogDom.locator('..')
  await settingsDialogDom
    .getByRole('button', { name: serverCopy.settings.close })
    .click()
  await expect(settingsBackdrop).toHaveAttribute('data-state', 'closing')
  await expect(settingsDialogDom).toBeHidden()
  await expect(settingsTrigger).toBeFocused()
})

test('roles settings safely rebases a version-only CAS conflict', async ({
  page,
}) => {
  const role = createMockRole('role-alpha', 'Альфа', 10)
  const attempts: MockUpdateServerRoleRequest[] = []
  await mockArcaneLinkApi(page, {
    serverPermissionDefinitions,
    serverRoles: [role],
    onBeforeUpdateServerRole: (_roleId, request, currentRole) => {
      attempts.push(request)
      if (attempts.length !== 1) {
        return undefined
      }

      return {
        ...currentRole,
        version: 'role-alpha-version-2',
        directAssignmentCount: 3,
        updatedAt: '2026-08-10T01:00:00.000Z',
      }
    },
  })
  await signInAndOpenServer(page)
  const { rolesSettings, roleEditor } = await openRoleSettings(page)

  await rolesSettings
    .getByRole('button', { name: 'Редактировать роль Альфа' })
    .click()

  const titleInput = roleEditor.getByLabel('Название')
  const saveButton = roleEditor.getByRole('button', {
    name: 'Сохранить',
    exact: true,
  })
  await titleInput.fill('Локальная Альфа')
  await saveButton.click()

  await expect(
    roleEditor.getByText(
      'Версия роли обновлена. Локальный черновик сохранён — повторите сохранение.',
    ),
  ).toBeVisible()
  await expect(titleInput).toHaveValue('Локальная Альфа')
  await expect(saveButton).toBeEnabled()
  await saveButton.click()

  await expect.poll(() => attempts.length).toBe(2)
  expect(attempts.map((request) => request.expectedVersion)).toEqual([
    'role-alpha-version-1',
    'role-alpha-version-2',
  ])
  await expect(
    roleEditor.getByRole('heading', {
      name: 'Локальная Альфа',
      level: 3,
    }),
  ).toBeVisible()
})

test('roles settings releases a same-version transient CAS conflict', async ({
  page,
}) => {
  const role = createMockRole('role-alpha', 'Альфа', 10)
  const attempts: MockUpdateServerRoleRequest[] = []
  await mockArcaneLinkApi(page, {
    serverPermissionDefinitions,
    serverRoles: [role],
    serverRoleUpdateConflicts: 1,
    onBeforeUpdateServerRole: (_roleId, request) => {
      attempts.push(request)
      return undefined
    },
  })
  await signInAndOpenServer(page)
  const { rolesSettings, roleEditor } = await openRoleSettings(page)

  await rolesSettings
    .getByRole('button', { name: 'Редактировать роль Альфа' })
    .click()

  const titleInput = roleEditor.getByLabel('Название')
  const saveButton = roleEditor.getByRole('button', {
    name: 'Сохранить',
    exact: true,
  })
  await titleInput.fill('Локальная Альфа')
  await saveButton.click()

  await expect(
    roleEditor.getByText(
      'Версия роли обновлена. Локальный черновик сохранён — повторите сохранение.',
    ),
  ).toBeVisible()
  await expect(saveButton).toBeEnabled()
  await saveButton.click()

  await expect.poll(() => attempts.length).toBe(2)
  expect(attempts.map((request) => request.expectedVersion)).toEqual([
    'role-alpha-version-1',
    'role-alpha-version-1',
  ])
  await expect(titleInput).toHaveValue('Локальная Альфа')
})

test('roles settings blocks overwrite when remote editable fields changed', async ({
  page,
}) => {
  const role = createMockRole('role-alpha', 'Альфа', 10)
  let firstAttempt = true
  await mockArcaneLinkApi(page, {
    serverPermissionDefinitions,
    serverRoles: [role],
    onBeforeUpdateServerRole: (_roleId, _request, currentRole) => {
      if (!firstAttempt) {
        return undefined
      }

      firstAttempt = false
      return {
        ...currentRole,
        title: 'Серверная Альфа',
        version: 'role-alpha-version-2',
        updatedAt: '2026-08-10T01:00:00.000Z',
      }
    },
  })
  await signInAndOpenServer(page)
  const { rolesSettings, roleEditor } = await openRoleSettings(page)

  await rolesSettings
    .getByRole('button', { name: 'Редактировать роль Альфа' })
    .click()

  const titleInput = roleEditor.getByLabel('Название')
  const saveButton = roleEditor.getByRole('button', {
    name: 'Сохранить',
    exact: true,
  })
  await titleInput.fill('Локальная Альфа')
  await saveButton.click()

  await expect(titleInput).toHaveValue('Локальная Альфа')
  await expect(saveButton).toBeDisabled()
  await expect(
    roleEditor.getByRole('button', {
      name: 'Загрузить версию сервера',
    }),
  ).toBeVisible()
  await roleEditor
    .getByRole('button', { name: 'Загрузить версию сервера' })
    .click()

  await expect(titleInput).toHaveValue('Серверная Альфа')
  await expect(
    roleEditor.getByText('Загружена версия роли с сервера.'),
  ).toBeVisible()
})
