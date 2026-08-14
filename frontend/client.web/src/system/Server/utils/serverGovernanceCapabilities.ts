import type {
  PermissionResponse,
  ServerMemberDetailsResponse,
  ServerRoleResponse,
} from '../../../shared/types'
import type { ServerCoreTab } from './serverWorkspaceModel'

type SettingsAccess = {
  canInviteMembers: boolean
  canViewInvites?: boolean
  canManageJoinRequests?: boolean
  canManageBans?: boolean
  canManageReports?: boolean
  canManageRoles?: boolean
  canViewAuditLog: boolean
}

export function resolveAccessibleServerCoreTab(
  requestedTab: ServerCoreTab,
  access: SettingsAccess,
): ServerCoreTab {
  if (
    requestedTab === 'invites' &&
    !(access.canViewInvites ?? access.canInviteMembers)
  ) {
    return 'spaces'
  }

  if (
    requestedTab === 'join-requests' &&
    !access.canManageJoinRequests
  ) {
    return 'spaces'
  }

  if (requestedTab === 'audit' && !access.canViewAuditLog) {
    return 'spaces'
  }

  if (
    requestedTab === 'bans' &&
    !access.canManageBans
  ) {
    return 'spaces'
  }

  if (requestedTab === 'moderation' && !access.canManageReports) {
    return 'spaces'
  }

  if (requestedTab === 'roles' && !access.canManageRoles) {
    return 'spaces'
  }

  return requestedTab
}

export function canManageServerReports({
  isOwner,
  permissionCodes,
}: {
  isOwner: boolean
  permissionCodes: readonly string[]
}) {
  return (
    isOwner ||
    permissionCodes.some(
      (code) => {
        const normalizedCode = code.trim().toUpperCase()
        return (
          normalizedCode === 'ADMINISTRATOR' ||
          normalizedCode === 'MANAGE_SERVER' ||
          normalizedCode === 'MANAGE_REPORTS'
        )
      },
    )
  )
}

export function getCreatableServerRolePermissions(
  permissions: readonly PermissionResponse[],
  actorPermissionCodes: readonly string[],
  canManageServer: boolean,
) {
  if (canManageServer) {
    return [...permissions]
  }

  const allowedCodes = new Set(
    actorPermissionCodes.map((code) => code.trim().toUpperCase()),
  )

  return permissions.filter(
    (permission) =>
      !isAdministratorPermission(permission.code) &&
      allowedCodes.has(permission.code.trim().toUpperCase()),
  )
}

export function getAssignableServerRoles(
  roles: readonly ServerRoleResponse[],
  actor: ServerMemberDetailsResponse | null,
  canManageServer: boolean,
  isOwner: boolean,
) {
  const customRoles = roles.filter((role) => !role.isSystem)

  if (canManageServer) {
    return isOwner
      ? customRoles
      : customRoles.filter((role) => !roleHasAdministrator(role))
  }

  if (!actor) {
    return []
  }

  const activeRoleIds = new Set(
    actor.roleAssignments
      .filter((assignment) => !assignment.revokedAt)
      .map((assignment) => assignment.roleId),
  )
  const actorRoleLevels = roles
    .filter((role) => activeRoleIds.has(role.id))
    .map((role) => role.level)

  if (actorRoleLevels.length === 0) {
    return []
  }

  const actorTopRoleLevel = Math.min(...actorRoleLevels)
  const actorPermissionCodes = new Set(
    actor.permissionCodes.map((code) => code.trim().toUpperCase()),
  )

  return customRoles.filter(
    (role) =>
      role.level > actorTopRoleLevel &&
      role.permissions.every(
        (permission) =>
          !isAdministratorPermission(permission.code) &&
          actorPermissionCodes.has(permission.code.trim().toUpperCase()),
      ),
  )
}

export function canRemoveServerMember({
  member,
  currentMember,
  serverRoles,
  currentUserId,
  isOwner,
  canManageMembers,
}: {
  member: ServerMemberDetailsResponse
  currentMember: ServerMemberDetailsResponse | null
  serverRoles: readonly ServerRoleResponse[]
  currentUserId: string
  isOwner: boolean
  canManageMembers: boolean
}) {
  if (!canManageMembers) {
    return false
  }

  return canActOnServerMemberByHierarchy({
    member,
    currentMember,
    serverRoles,
    currentUserId,
    isOwner,
  })
}

export function canActOnServerMemberByHierarchy({
  member,
  currentMember,
  serverRoles,
  currentUserId,
  isOwner,
}: {
  member: ServerMemberDetailsResponse
  currentMember: ServerMemberDetailsResponse | null
  serverRoles: readonly ServerRoleResponse[]
  currentUserId: string
  isOwner: boolean
}) {
  if (member.isOwner || member.userId === currentUserId) {
    return false
  }

  if (isOwner) {
    return true
  }

  if (
    hasAdministratorAuthority(member, serverRoles) ||
    !currentMember
  ) {
    return false
  }

  const levelsByRoleId = new Map(
    serverRoles.map((role) => [role.id, role.level] as const),
  )
  const actorLevel = resolveHighestActiveRoleLevel(
    currentMember,
    levelsByRoleId,
  )
  const targetLevel = resolveHighestActiveRoleLevel(member, levelsByRoleId)

  return actorLevel < targetLevel
}

function hasAdministratorAuthority(
  member: ServerMemberDetailsResponse,
  serverRoles: readonly ServerRoleResponse[],
) {
  if (
    member.permissionCodes.some((code) => isAdministratorPermission(code))
  ) {
    return true
  }

  const activeRoleIds = new Set(
    member.roleAssignments
      .filter((assignment) => !assignment.revokedAt)
      .map((assignment) => assignment.roleId),
  )

  return serverRoles.some(
    (role) =>
      activeRoleIds.has(role.id) &&
      roleHasAdministrator(role),
  )
}

function roleHasAdministrator(role: ServerRoleResponse) {
  return (
    role.permissionCodes?.some(isAdministratorPermission) ||
    role.permissions.some((permission) =>
      isAdministratorPermission(permission.code),
    )
  )
}

function isAdministratorPermission(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  return (
    normalizedCode === 'ADMINISTRATOR' || normalizedCode === 'MANAGE_SERVER'
  )
}

function resolveHighestActiveRoleLevel(
  member: ServerMemberDetailsResponse,
  levelsByRoleId: ReadonlyMap<string, number>,
) {
  const levels = member.roleAssignments
    .filter((assignment) => !assignment.revokedAt)
    .map((assignment) => levelsByRoleId.get(assignment.roleId))
    .filter((level): level is number => level !== undefined)

  return levels.length > 0 ? Math.min(...levels) : Number.POSITIVE_INFINITY
}
