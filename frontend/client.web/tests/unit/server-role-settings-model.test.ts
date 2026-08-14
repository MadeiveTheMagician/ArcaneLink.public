import { expect, test } from '@playwright/test'

import type {
  PermissionResponse,
  ServerEffectivePermissionsResponse,
  ServerRoleResponse,
} from '../../src/shared/types'
import {
  createServerRoleDraft,
  filterServerRoles,
  formatDisplayColorSelection,
  groupServerRolePermissions,
  isAdministratorServerRole,
  isServerRoleDraftDirty,
  normalizeServerRoleDraft,
  partitionServerRoles,
  parseDisplayColorSelection,
  reorderServerRolesWithinTier,
  resolveAvailableServerRolePermissionCodes,
  resolveServerRoleManagement,
  resolveServerRoleVersionConflict,
  toggleServerRolePermission,
} from '../../src/system/Server/components/settings/roles/serverRoleSettingsModel'

function permission(code: string, title = code): PermissionResponse {
  return {
    id: `permission-${code}`,
    code,
    title,
    description: null,
  }
}

const v1PermissionCodesByGroup = {
  access: [
    'VIEW_TEXT_SPACES',
    'VIEW_VOICE_SPACES',
    'READ_MESSAGE_HISTORY',
    'READ_VOICE_CHAT_HISTORY',
  ],
  messaging: [
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
  voice: [
    'CONNECT_VOICE',
    'SPEAK_IN_VOICE',
    'USE_VIDEO',
    'SHARE_SCREEN',
    'MUTE_VOICE_MEMBERS',
    'DEAFEN_VOICE_MEMBERS',
    'MOVE_VOICE_MEMBERS',
    'DISCONNECT_VOICE_MEMBERS',
  ],
  members: [
    'CHANGE_OWN_NICKNAME',
    'MANAGE_NICKNAMES',
    'APPROVE_JOIN_REQUESTS',
    'KICK_MEMBERS',
    'BAN_MEMBERS',
    'MANAGE_BANS',
    'TIMEOUT_MEMBERS',
  ],
  roles: [
    'MANAGE_ROLES',
    'ASSIGN_ROLES',
    'MANAGE_DEFAULT_PERMISSIONS',
    'ADMINISTRATOR',
  ],
  spaces: [
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
  server: [
    'CREATE_INVITES',
    'VIEW_INVITE_LOG',
    'MANAGE_INVITES',
    'MANAGE_SERVER_PROFILE',
    'MANAGE_SERVER_SETTINGS',
    'VIEW_AUDIT_LOG',
    'MANAGE_REPORTS',
  ],
} as const

function role({
  id,
  level,
  permissionCodes = [],
  kind = 'standard',
  isSystem = false,
  title = id,
}: {
  id: string
  level: number
  permissionCodes?: string[]
  kind?: ServerRoleResponse['kind']
  isSystem?: boolean
  title?: string
}): ServerRoleResponse {
  return {
    id,
    serverId: 'server-1',
    code: isSystem ? id : null,
    title,
    description: null,
    kind,
    color: null,
    mentionable: false,
    createdByUserId: null,
    level,
    isSystem,
    version: `version-${id}`,
    directAssignmentCount: 0,
    permissionSchemaVersion: 1,
    permissionCodes,
    permissions: permissionCodes.map((code) => permission(code)),
    createdAt: '2026-08-10T00:00:00Z',
    updatedAt: '2026-08-10T00:00:00Z',
  }
}

function effectivePermissions(
  overrides: Partial<ServerEffectivePermissionsResponse> = {},
): ServerEffectivePermissionsResponse {
  return {
    serverId: 'server-1',
    memberId: 'member-1',
    authorizationVersion: 'authorization-version-1',
    permissionSchemaVersion: 1,
    isOwner: false,
    isAdministrator: false,
    authorityTier: 'standard',
    authorityPosition: 10,
    permissionCodes: ['MANAGE_ROLES'],
    ...overrides,
  }
}

test.describe('server role settings model', () => {
  test('creates a safe empty draft and normalizes editable values', () => {
    expect(createServerRoleDraft()).toEqual({
      title: '',
      description: '',
      color: '',
      mentionable: false,
      permissionCodes: [],
    })

    expect(
      normalizeServerRoleDraft({
        title: '  Moderators  ',
        description: '  Handles reports  ',
        color: '  #AABBCC  ',
        mentionable: true,
        permissionCodes: ['manage_roles', 'MANAGE_ROLES', '  manage_members '],
      }),
    ).toEqual({
      title: 'Moderators',
      description: 'Handles reports',
      color: '#aabbcc',
      mentionable: true,
      permissionCodes: ['MANAGE_MEMBERS', 'MANAGE_ROLES'],
    })
  })

  test('compares drafts by normalized editable state', () => {
    const source = {
      ...role({ id: 'moderators', level: 20 }),
      title: 'Moderators',
      description: 'Handles reports',
      color: '#aabbcc',
      mentionable: true,
      permissions: [permission('manage_roles')],
    }
    const draft = createServerRoleDraft(source)

    expect(isServerRoleDraftDirty(draft, source)).toBe(false)
    expect(
      isServerRoleDraftDirty(
        {
          ...draft,
          title: ' Moderators ',
          description: ' Handles reports ',
          color: '#AABBCC',
        },
        source,
      ),
    ).toBe(false)
    expect(
      isServerRoleDraftDirty({ ...draft, mentionable: false }, source),
    ).toBe(true)
  })

  test('rebases a version-only role conflict without treating metadata as an edit', () => {
    const baseline = {
      ...role({ id: 'moderators', level: 20 }),
      title: 'Moderators',
      description: 'Handles reports',
      color: '#aabbcc',
      mentionable: true,
      permissions: [permission('manage_roles')],
    }
    const freshRole = {
      ...baseline,
      version: 'version-moderators-2',
      directAssignmentCount: 4,
      updatedAt: '2026-08-10T01:00:00Z',
    }

    expect(resolveServerRoleVersionConflict(baseline, freshRole)).toEqual({
      kind: 'version-only',
      freshRole,
    })
  })

  test('blocks automatic rebase when editable server fields changed', () => {
    const baseline = role({ id: 'moderators', level: 20 })
    const freshRole = {
      ...baseline,
      title: 'Remote moderators',
      version: 'version-moderators-2',
    }

    expect(resolveServerRoleVersionConflict(baseline, freshRole)).toEqual({
      kind: 'remote-change',
      freshRole,
    })
  })

  test('preserves the local draft when a conflicted role was deleted', () => {
    const baseline = role({ id: 'moderators', level: 20 })

    expect(resolveServerRoleVersionConflict(baseline, null)).toEqual({
      kind: 'deleted',
      freshRole: null,
    })
  })

  test('keeps administrator permission exclusive', () => {
    expect(
      toggleServerRolePermission(
        ['MANAGE_ROLES', 'KICK_MEMBERS'],
        'ADMINISTRATOR',
        true,
      ),
    ).toEqual(['ADMINISTRATOR'])
    expect(
      toggleServerRolePermission(['manage_server'], 'manage_server', false),
    ).toEqual([])
    expect(
      toggleServerRolePermission(
        ['ADMINISTRATOR'],
        'MANAGE_ROLES',
        true,
      ),
    ).toEqual(['ADMINISTRATOR'])
  })

  test('recognizes the schema-v1 administrator and its legacy alias', () => {
    expect(
      isAdministratorServerRole(role({
        id: 'v1-administrator',
        level: 5,
        permissionCodes: ['ADMINISTRATOR'],
      })),
    ).toBe(true)
    expect(
      isAdministratorServerRole(role({
        id: 'legacy-administrator',
        level: 5,
        permissionCodes: ['manage_server'],
      })),
    ).toBe(true)
  })

  test('serializes display-color modes without treating color as authority', () => {
    expect(formatDisplayColorSelection('auto', null)).toBe('auto')
    expect(formatDisplayColorSelection('default', null)).toBe('default')
    expect(formatDisplayColorSelection('role', 'role-purple')).toBe(
      'role:role-purple',
    )
    expect(parseDisplayColorSelection('auto')).toEqual({
      mode: 'auto',
      roleId: null,
    })
    expect(parseDisplayColorSelection('role:role-purple')).toEqual({
      mode: 'role',
      roleId: 'role-purple',
    })
    expect(parseDisplayColorSelection('role:')).toBeNull()
    expect(parseDisplayColorSelection('administrator')).toBeNull()
  })

  test('partitions and filters roles without changing hierarchy order', () => {
    const everyone = role({
      id: 'everyone',
      level: 100,
      kind: 'everyone',
      title: 'Все участники',
    })
    const administrator = role({
      id: 'administrator',
      level: 5,
      permissionCodes: ['ADMINISTRATOR'],
    })
    const moderator = role({
      id: 'moderator',
      level: 20,
      permissionCodes: ['manage_members'],
      title: 'Модератор',
    })
    const helper = role({ id: 'helper', level: 30 })
    const integration = role({
      id: 'integration',
      level: 40,
      kind: 'integration',
    })
    const system = role({ id: 'owner', level: 1, isSystem: true })
    const roles = [helper, integration, moderator, everyone, system, administrator]

    const partition = partitionServerRoles(roles)
    expect(partition.defaultRole?.id).toBe('everyone')
    expect(partition.administratorRoles.map((item) => item.id)).toEqual([
      'administrator',
    ])
    expect(partition.standardRoles.map((item) => item.id)).toEqual([
      'moderator',
      'helper',
    ])
    expect(partition.systemRoles.map((item) => item.id)).toEqual([
      'owner',
      'integration',
    ])
    expect(filterServerRoles(roles, 'модер').map((item) => item.id)).toEqual([
      'moderator',
    ])
    expect(
      filterServerRoles(roles, 'manage_members').map((item) => item.id),
    ).toEqual(['moderator'])
  })

  test('enforces system, administrator, hierarchy, and permission-subset gates', () => {
    const manageable = role({
      id: 'manageable',
      level: 20,
      permissionCodes: ['manage_roles'],
    })
    const foreignPermission = role({
      id: 'foreign',
      level: 20,
      permissionCodes: ['manage_members'],
    })
    const higher = role({ id: 'higher', level: 5 })
    const administrator = role({
      id: 'administrator',
      level: 20,
      permissionCodes: ['ADMINISTRATOR'],
    })
    const system = role({ id: 'system', level: 30, isSystem: true })
    const actor = effectivePermissions()

    expect(
      resolveServerRoleManagement(
        manageable,
        actor,
        ['manage_roles'],
        true,
      ),
    ).toEqual({ allowed: true, reason: 'allowed' })
    expect(
      resolveServerRoleManagement(higher, actor, ['manage_roles'], true).reason,
    ).toBe('hierarchy')
    expect(
      resolveServerRoleManagement(
        foreignPermission,
        actor,
        ['manage_roles'],
        true,
      ).reason,
    ).toBe('permission-subset')
    expect(
      resolveServerRoleManagement(
        administrator,
        effectivePermissions({ isAdministrator: true }),
        ['ADMINISTRATOR'],
        true,
      ).reason,
    ).toBe('administrator')
    expect(
      resolveServerRoleManagement(system, actor, ['manage_roles'], true).reason,
    ).toBe('system')
    expect(
      resolveServerRoleManagement(
        manageable,
        effectivePermissions({ permissionCodes: ['ASSIGN_ROLES'] }),
        ['ASSIGN_ROLES'],
        false,
      ).reason,
    ).toBe('missing-permission')

    const everyone = role({
      id: 'everyone',
      level: Number.MAX_SAFE_INTEGER,
      kind: 'everyone',
      isSystem: true,
    })
    expect(
      resolveServerRoleManagement(
        everyone,
        actor,
        ['MANAGE_DEFAULT_PERMISSIONS'],
        false,
      ),
    ).toEqual({ allowed: true, reason: 'allowed' })
    expect(
      resolveServerRoleManagement(
        everyone,
        actor,
        ['MANAGE_ROLES'],
        true,
      ).reason,
    ).toBe('missing-permission')
    expect(
      resolveServerRoleManagement(
        administrator,
        effectivePermissions({
          isOwner: true,
          authorityTier: 'owner',
          authorityPosition: null,
        }),
        [],
        true,
      ),
    ).toEqual({ allowed: true, reason: 'allowed' })
  })

  test('groups all 51 schema-v1 permissions into the seven registry groups', () => {
    const allPermissions = Object.values(v1PermissionCodesByGroup)
      .flat()
      .map((code) => permission(code))
    expect(allPermissions).toHaveLength(51)

    const groups = groupServerRolePermissions(allPermissions)
    expect(groups.map((group) => group.id)).toEqual([
      'access',
      'messaging',
      'voice',
      'members',
      'roles',
      'spaces',
      'server',
    ])
    expect(
      Object.fromEntries(
        groups.map((group) => [group.id, group.permissions.length]),
      ),
    ).toEqual({
      access: 4,
      messaging: 9,
      voice: 8,
      members: 7,
      roles: 4,
      spaces: 12,
      server: 7,
    })
    expect(groups.find((group) => group.id === 'roles')?.permissions[0]?.code)
      .toBe('ADMINISTRATOR')
  })

  test('limits assignable permissions to the effective v1 permission set', () => {
    const catalogue = [
      permission('ADMINISTRATOR'),
      permission('MANAGE_ROLES'),
      permission('KICK_MEMBERS'),
      permission('VIEW_AUDIT_LOG'),
    ]

    expect([
      ...resolveAvailableServerRolePermissionCodes(
        catalogue,
        effectivePermissions({
          permissionCodes: [
            'ADMINISTRATOR',
            'MANAGE_ROLES',
            'KICK_MEMBERS',
          ],
        }),
      ),
    ]).toEqual(['MANAGE_ROLES', 'KICK_MEMBERS'])
    expect([
      ...resolveAvailableServerRolePermissionCodes(
        catalogue,
        effectivePermissions({
          isOwner: true,
          authorityTier: 'owner',
          authorityPosition: null,
          permissionCodes: [],
        }),
      ),
    ]).toEqual(catalogue.map((item) => item.code))
    expect([
      ...resolveAvailableServerRolePermissionCodes(
        [permission('manage_roles')],
        effectivePermissions({ permissionCodes: ['MANAGE_ROLES'] }),
      ),
    ]).toEqual(['manage_roles'])
  })

  test('keeps an unknown future permission visible in the fallback group', () => {
    const groups = groupServerRolePermissions([
      permission('CUSTOM_PERMISSION', 'Custom'),
    ])

    expect(groups.map((group) => group.id)).toEqual(['other'])
  })

  test('reorders only the provided role tier', () => {

    const first = role({ id: 'first', level: 10 })
    const second = role({ id: 'second', level: 20 })
    const third = role({ id: 'third', level: 30 })
    expect(
      reorderServerRolesWithinTier([first, second, third], 'third', 'first').map(
        (item) => item.id,
      ),
    ).toEqual(['third', 'first', 'second'])
    expect(
      reorderServerRolesWithinTier([first, second], 'missing', 'first'),
    ).toEqual([first, second])
  })
})
