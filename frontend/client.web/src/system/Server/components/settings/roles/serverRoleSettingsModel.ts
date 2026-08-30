import type {
  PermissionResponse,
  ServerEffectivePermissionsResponse,
  ServerMemberDisplayColorResponse,
  ServerRoleResponse
} from '../../../../../shared/types';

export type ServerRoleEditorTab = 'appearance' | 'permissions' | 'members';

export type ServerRoleDraft = {
  title: string;
  description: string;
  color: string;
  mentionable: boolean;
  permissionCodes: string[];
};

export type ServerMemberDisplayColorSelection = {
  mode: ServerMemberDisplayColorResponse['mode'];
  roleId: string | null;
};

export type ServerRolePartition = {
  defaultRole: ServerRoleResponse | null;
  administratorRoles: ServerRoleResponse[];
  standardRoles: ServerRoleResponse[];
  systemRoles: ServerRoleResponse[];
};

export type ServerRoleManagementDecision = {
  allowed: boolean;
  reason:
    | 'allowed'
    | 'missing-permission'
    | 'system'
    | 'administrator'
    | 'hierarchy'
    | 'permission-subset';
};

export type ServerRoleVersionConflictResolution =
  | {
      kind: 'version-only';
      freshRole: ServerRoleResponse;
    }
  | {
      kind: 'remote-change';
      freshRole: ServerRoleResponse;
    }
  | {
      kind: 'deleted';
      freshRole: null;
    };

export type ServerPermissionGroup = {
  id:
    | 'access'
    | 'messaging'
    | 'voice'
    | 'members'
    | 'roles'
    | 'spaces'
    | 'server'
    | 'other';
  title: string;
  permissions: PermissionResponse[];
};

const permissionGroupOrder: ServerPermissionGroup['id'][] = [
  'access',
  'messaging',
  'voice',
  'members',
  'roles',
  'spaces',
  'server',
  'other'
];

const permissionCodesByGroup: Readonly<
  Record<Exclude<ServerPermissionGroup['id'], 'other'>, readonly string[]>
> = {
  access: [
    'VIEW_TEXT_SPACES',
    'VIEW_VOICE_SPACES',
    'READ_MESSAGE_HISTORY',
    'READ_VOICE_CHAT_HISTORY'
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
    'MANAGE_MESSAGES'
  ],
  voice: [
    'CONNECT_VOICE',
    'SPEAK_IN_VOICE',
    'USE_VIDEO',
    'SHARE_SCREEN',
    'MUTE_VOICE_MEMBERS',
    'DEAFEN_VOICE_MEMBERS',
    'MOVE_VOICE_MEMBERS',
    'DISCONNECT_VOICE_MEMBERS'
  ],
  members: [
    'CHANGE_OWN_NICKNAME',
    'MANAGE_NICKNAMES',
    'APPROVE_JOIN_REQUESTS',
    'KICK_MEMBERS',
    'BAN_MEMBERS',
    'MANAGE_BANS',
    'TIMEOUT_MEMBERS',
    // Compatibility alias used by roles created before permission schema v1.
    'MANAGE_MEMBERS'
  ],
  roles: [
    'MANAGE_ROLES',
    'ASSIGN_ROLES',
    'MANAGE_DEFAULT_PERMISSIONS',
    'ADMINISTRATOR',
    // Compatibility alias for the former all-access permission.
    'MANAGE_SERVER'
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
    'DELETE_VOICE_SPACES'
  ],
  server: [
    'CREATE_INVITES',
    'VIEW_INVITE_LOG',
    'MANAGE_INVITES',
    'MANAGE_SERVER_PROFILE',
    'MANAGE_SERVER_SETTINGS',
    'VIEW_AUDIT_LOG',
    'MANAGE_REPORTS'
  ]
};

const permissionGroupByCode = new Map<string, ServerPermissionGroup['id']>(
  Object.entries(permissionCodesByGroup).flatMap(([groupId, codes]) =>
    codes.map((code) => [code, groupId as ServerPermissionGroup['id']])
  )
);

export function createServerRoleDraft(
  role?: ServerRoleResponse | null
): ServerRoleDraft {
  return {
    title: role?.title ?? '',
    description: role?.description ?? '',
    color: role?.color ?? '',
    mentionable: role?.mentionable ?? false,
    permissionCodes: role
      ? normalizeServerPermissionCodes(getServerRolePermissionCodes(role))
      : []
  };
}

export function formatDisplayColorSelection(
  mode: ServerMemberDisplayColorResponse['mode'],
  roleId: string | null
) {
  return mode === 'role' && roleId ? `role:${roleId}` : mode;
}

export function parseDisplayColorSelection(
  value: string
): ServerMemberDisplayColorSelection | null {
  if (value === 'auto' || value === 'default') {
    return { mode: value, roleId: null };
  }

  if (value.startsWith('role:') && value.length > 'role:'.length) {
    return { mode: 'role', roleId: value.slice('role:'.length) };
  }

  return null;
}

export function isServerRoleDraftDirty(
  draft: ServerRoleDraft,
  role?: ServerRoleResponse | null
) {
  const baseline = createServerRoleDraft(role);

  return (
    draft.title.trim() !== baseline.title ||
    normalizeOptionalText(draft.description) !==
      normalizeOptionalText(baseline.description) ||
    normalizeRoleColor(draft.color) !== normalizeRoleColor(baseline.color) ||
    draft.mentionable !== baseline.mentionable ||
    !sameStringSet(draft.permissionCodes, baseline.permissionCodes)
  );
}

export function resolveServerRoleVersionConflict(
  baselineRole: ServerRoleResponse,
  freshRole: ServerRoleResponse | null
): ServerRoleVersionConflictResolution {
  if (!freshRole || freshRole.id !== baselineRole.id) {
    return { kind: 'deleted', freshRole: null };
  }

  return isServerRoleDraftDirty(createServerRoleDraft(freshRole), baselineRole)
    ? { kind: 'remote-change', freshRole }
    : { kind: 'version-only', freshRole };
}

export function normalizeServerRoleDraft(draft: ServerRoleDraft) {
  return {
    title: draft.title.trim(),
    description: normalizeOptionalText(draft.description),
    color: normalizeRoleColor(draft.color),
    mentionable: draft.mentionable,
    permissionCodes: normalizeServerPermissionCodes(draft.permissionCodes)
  };
}

export function toggleServerRolePermission(
  permissionCodes: readonly string[],
  permissionCode: string,
  enabled: boolean
) {
  const normalizedCode = normalizeServerPermissionCode(permissionCode);
  const current = new Set(normalizeServerPermissionCodes(permissionCodes));

  if (!normalizedCode) {
    return [...current];
  }

  if (isAdministratorPermissionCode(normalizedCode)) {
    return enabled ? ['ADMINISTRATOR'] : [];
  }

  if ([...current].some(isAdministratorPermissionCode)) {
    return ['ADMINISTRATOR'];
  }

  if (enabled) {
    current.add(normalizedCode);
  } else {
    current.delete(normalizedCode);
  }

  return [...current].sort((left, right) => left.localeCompare(right));
}

export function isAdministratorServerRole(role: ServerRoleResponse) {
  return getServerRolePermissionCodes(role).some(isAdministratorPermissionCode);
}

export function isAdministratorPermissionCode(permissionCode: string) {
  const normalizedCode = permissionCode.trim().toUpperCase();
  return (
    normalizedCode === 'ADMINISTRATOR' || normalizedCode === 'MANAGE_SERVER'
  );
}

export function hasAdministratorPermission(permissionCodes: readonly string[]) {
  return permissionCodes.some(isAdministratorPermissionCode);
}

export function normalizeServerPermissionCode(permissionCode: string) {
  const normalizedCode = permissionCode.trim().toUpperCase();
  return normalizedCode === 'MANAGE_SERVER' ? 'ADMINISTRATOR' : normalizedCode;
}

export function serverPermissionCodesEqual(left: string, right: string) {
  return (
    normalizeServerPermissionCode(left) === normalizeServerPermissionCode(right)
  );
}

export function partitionServerRoles(
  roles: readonly ServerRoleResponse[]
): ServerRolePartition {
  const sorted = [...roles].sort(compareServerRoles);
  const defaultRole = sorted.find((role) => role.kind === 'everyone') ?? null;
  const customRoles = sorted.filter(
    (role) => !role.isSystem && role.kind === 'standard'
  );

  return {
    defaultRole,
    administratorRoles: customRoles.filter(isAdministratorServerRole),
    standardRoles: customRoles.filter(
      (role) => !isAdministratorServerRole(role)
    ),
    systemRoles: sorted.filter(
      (role) =>
        role.isSystem ||
        role.kind === 'integration' ||
        (role.kind === 'everyone' && role.id !== defaultRole?.id)
    )
  };
}

export function filterServerRoles(
  roles: readonly ServerRoleResponse[],
  query: string
) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  if (!normalizedQuery) {
    return [...roles];
  }

  return roles.filter((role) =>
    [
      role.title,
      role.description ?? '',
      ...getServerRolePermissionCodes(role),
      ...role.permissions.flatMap((permission) => [
        permission.code,
        permission.title,
        permission.description ?? ''
      ])
    ].some((value) =>
      value.toLocaleLowerCase('ru-RU').includes(normalizedQuery)
    )
  );
}

export function resolveServerRoleManagement(
  role: ServerRoleResponse,
  effectivePermissions: ServerEffectivePermissionsResponse | null,
  actorPermissionCodes: readonly string[],
  canManageRoles: boolean
): ServerRoleManagementDecision {
  if (!effectivePermissions) {
    return { allowed: false, reason: 'missing-permission' };
  }

  const actorPermissions = new Set(
    actorPermissionCodes.map(normalizeServerPermissionCode)
  );
  const isUnrestricted =
    effectivePermissions.isOwner || effectivePermissions.isAdministrator;

  if (role.kind === 'everyone') {
    return isUnrestricted || actorPermissions.has('MANAGE_DEFAULT_PERMISSIONS')
      ? { allowed: true, reason: 'allowed' }
      : { allowed: false, reason: 'missing-permission' };
  }

  if (role.isSystem || role.kind !== 'standard') {
    return { allowed: false, reason: 'system' };
  }

  if (
    !isUnrestricted &&
    !canManageRoles &&
    !actorPermissions.has('MANAGE_ROLES')
  ) {
    return { allowed: false, reason: 'missing-permission' };
  }

  if (effectivePermissions.isOwner) {
    return { allowed: true, reason: 'allowed' };
  }

  if (isAdministratorServerRole(role)) {
    return { allowed: false, reason: 'administrator' };
  }

  if (effectivePermissions.isAdministrator) {
    return { allowed: true, reason: 'allowed' };
  }

  if (
    effectivePermissions.authorityPosition == null ||
    role.level <= effectivePermissions.authorityPosition
  ) {
    return { allowed: false, reason: 'hierarchy' };
  }

  if (
    getServerRolePermissionCodes(role).some(
      (permissionCode) =>
        !actorPermissions.has(normalizeServerPermissionCode(permissionCode))
    )
  ) {
    return { allowed: false, reason: 'permission-subset' };
  }

  return { allowed: true, reason: 'allowed' };
}

export function groupServerRolePermissions(
  permissions: readonly PermissionResponse[]
): ServerPermissionGroup[] {
  const groups = new Map<ServerPermissionGroup['id'], PermissionResponse[]>();

  for (const permission of permissions) {
    const groupId = resolvePermissionGroupId(permission.code);
    const group = groups.get(groupId) ?? [];
    group.push(permission);
    groups.set(groupId, group);
  }

  return permissionGroupOrder.flatMap((id) => {
    const groupPermissions = groups.get(id);
    if (!groupPermissions?.length) {
      return [];
    }

    return [
      {
        id,
        title: getPermissionGroupTitle(id),
        permissions: [...groupPermissions].sort(compareServerPermissions)
      }
    ];
  });
}

export function resolveAvailableServerRolePermissionCodes(
  permissions: readonly PermissionResponse[],
  effectivePermissions: ServerEffectivePermissionsResponse | null
) {
  if (!effectivePermissions) {
    return new Set<string>();
  }

  if (effectivePermissions.isOwner) {
    return new Set(permissions.map((permission) => permission.code));
  }

  const grantedCodes = new Set(
    effectivePermissions.permissionCodes.map(normalizeServerPermissionCode)
  );

  return new Set(
    permissions
      .filter(
        (permission) =>
          !isAdministratorPermissionCode(permission.code) &&
          grantedCodes.has(normalizeServerPermissionCode(permission.code))
      )
      .map((permission) => permission.code)
  );
}

export function reorderServerRolesWithinTier(
  roles: readonly ServerRoleResponse[],
  activeRoleId: string,
  overRoleId: string
) {
  const activeIndex = roles.findIndex((role) => role.id === activeRoleId);
  const overIndex = roles.findIndex((role) => role.id === overRoleId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return [...roles];
  }

  const next = [...roles];
  const [activeRole] = next.splice(activeIndex, 1);
  if (!activeRole) {
    return [...roles];
  }

  next.splice(overIndex, 0, activeRole);
  return next;
}

function compareServerRoles(
  left: ServerRoleResponse,
  right: ServerRoleResponse
) {
  return (
    left.level - right.level ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  const leftSorted = normalizeServerPermissionCodes(left);
  const rightSorted = normalizeServerPermissionCodes(right);

  return (
    leftSorted.length === rightSorted.length &&
    leftSorted.every((value, index) => value === rightSorted[index])
  );
}

function getServerRolePermissionCodes(role: ServerRoleResponse) {
  return role.permissionSchemaVersion === 1
    ? role.permissionCodes
    : role.permissions.map((permission) => permission.code);
}

function normalizeServerPermissionCodes(permissionCodes: readonly string[]) {
  return [
    ...new Set(
      permissionCodes.map(normalizeServerPermissionCode).filter(Boolean)
    )
  ].sort((left, right) => left.localeCompare(right));
}

function normalizeOptionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function normalizeRoleColor(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function resolvePermissionGroupId(
  permissionCode: string
): ServerPermissionGroup['id'] {
  const normalizedCode = permissionCode.trim().toUpperCase();
  return permissionGroupByCode.get(normalizedCode) ?? 'other';
}

function getPermissionGroupTitle(id: ServerPermissionGroup['id']) {
  switch (id) {
    case 'access':
      return 'Доступ и чтение';
    case 'messaging':
      return 'Сообщения и контент';
    case 'voice':
      return 'Голос и видео';
    case 'members':
      return 'Участники и модерация';
    case 'roles':
      return 'Роли';
    case 'spaces':
      return 'Спейсы и категории';
    case 'server':
      return 'Приглашения, сервер и аудит';
    default:
      return 'Прочее';
  }
}

function compareServerPermissions(
  left: PermissionResponse,
  right: PermissionResponse
) {
  const leftIsAdministrator = isAdministratorPermissionCode(left.code);
  const rightIsAdministrator = isAdministratorPermissionCode(right.code);

  if (leftIsAdministrator !== rightIsAdministrator) {
    return leftIsAdministrator ? -1 : 1;
  }

  return (
    left.title.localeCompare(right.title, 'ru-RU') ||
    left.code.localeCompare(right.code)
  );
}
