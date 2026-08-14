import { apiJson, apiNoContent } from '../../../../../shared/api/api'
import type {
  PermissionResponse,
  ServerPermissionCatalogResponse,
  ServerEffectivePermissionsResponse,
  ServerMemberDisplayColorResponse,
  ServerMemberPageResponse,
  ServerMemberRoleResponse,
  ServerRoleDeletionImpactResponse,
  ServerRoleResponse,
} from '../../../../../shared/types'
import type {
  ServerMemberDisplayColorSelection,
  ServerRoleDraft,
} from './serverRoleSettingsModel'
import { normalizeServerRoleDraft } from './serverRoleSettingsModel'

type ServerRoleApiContext = {
  accessToken: string
  serverId: string
}

export async function loadServerRoleSettingsData({
  accessToken,
  serverId,
}: ServerRoleApiContext) {
  const [roles, permissions, effectivePermissions] = await Promise.all([
    apiJson<ServerRoleResponse[]>(`/api/servers/${serverId}/roles`, {
      accessToken,
    }),
    apiJson<ServerPermissionCatalogResponse>('/api/permissions/server/v1', {
      accessToken,
    }),
    apiJson<ServerEffectivePermissionsResponse>(
      `/api/servers/${serverId}/members/me/effective-permissions`,
      { accessToken },
    ),
  ])

  return {
    roles,
    permissions: toPermissionResponses(permissions),
    effectivePermissions,
  }
}

export function loadServerEffectivePermissions({
  accessToken,
  serverId,
}: ServerRoleApiContext) {
  return apiJson<ServerEffectivePermissionsResponse>(
    `/api/servers/${serverId}/members/me/effective-permissions`,
    { accessToken },
  )
}

export function loadServerMemberDisplayColor({
  accessToken,
  serverId,
}: ServerRoleApiContext) {
  return apiJson<ServerMemberDisplayColorResponse>(
    `/api/servers/${serverId}/members/me/display-color`,
    { accessToken },
  )
}

export function updateServerMemberDisplayColor(
  context: ServerRoleApiContext,
  current: ServerMemberDisplayColorResponse,
  selection: ServerMemberDisplayColorSelection,
) {
  return apiJson<ServerMemberDisplayColorResponse>(
    `/api/servers/${context.serverId}/members/me/display-color`,
    {
      method: 'PATCH',
      accessToken: context.accessToken,
      body: {
        mode: selection.mode,
        roleId: selection.roleId,
        expectedRolesVersion: current.rolesVersion,
      },
    },
  )
}

export function createServerRole(
  context: ServerRoleApiContext,
  draft: ServerRoleDraft,
) {
  const normalized = normalizeServerRoleDraft(draft)

  return apiJson<ServerRoleResponse>(
    `/api/servers/${context.serverId}/roles`,
    {
      method: 'POST',
      accessToken: context.accessToken,
      body: {
        ...normalized,
        permissionSchemaVersion: 1,
      },
    },
  )
}

export function updateServerRole(
  context: ServerRoleApiContext,
  roleId: string,
  expectedVersion: string,
  draft: ServerRoleDraft,
) {
  const normalized = normalizeServerRoleDraft(draft)

  return apiJson<ServerRoleResponse>(
    `/api/servers/${context.serverId}/roles/${roleId}`,
    {
      method: 'PATCH',
      accessToken: context.accessToken,
      body: {
        ...normalized,
        permissionSchemaVersion: 1,
        expectedVersion,
      },
    },
  )
}

function toPermissionResponses(
  catalog: ServerPermissionCatalogResponse,
): PermissionResponse[] {
  if (catalog.permissionSchemaVersion !== 1) {
    throw new Error(
      `Unsupported server permission schema: ${catalog.permissionSchemaVersion}`,
    )
  }

  return catalog.permissions.map((permission) => ({
    id: permission.code,
    code: permission.code,
    title: permission.title,
    description: permission.description,
  }))
}

export function duplicateServerRole(
  context: ServerRoleApiContext,
  role: ServerRoleResponse,
  confirmAdministrator: boolean,
) {
  return apiJson<ServerRoleResponse>(
    `/api/servers/${context.serverId}/roles/${role.id}/duplicate`,
    {
      method: 'POST',
      accessToken: context.accessToken,
      body: {
        expectedVersion: role.version,
        confirmAdministrator,
      },
    },
  )
}

export function loadServerRoleDeletionImpact(
  context: ServerRoleApiContext,
  roleId: string,
) {
  return apiJson<ServerRoleDeletionImpactResponse>(
    `/api/servers/${context.serverId}/roles/${roleId}/deletion-impact`,
    { accessToken: context.accessToken },
  )
}

export function deleteServerRole(
  context: ServerRoleApiContext,
  role: ServerRoleResponse,
) {
  const params = new URLSearchParams({ expectedVersion: role.version })

  return apiNoContent(
    `/api/servers/${context.serverId}/roles/${role.id}?${params.toString()}`,
    {
      method: 'DELETE',
      accessToken: context.accessToken,
    },
  )
}

export function reorderServerRoles(
  context: ServerRoleApiContext,
  authorizationVersion: string,
  roles: readonly ServerRoleResponse[],
) {
  return apiNoContent(
    `/api/servers/${context.serverId}/roles/order`,
    {
      method: 'PUT',
      accessToken: context.accessToken,
      body: {
        expectedAuthorizationVersion: authorizationVersion,
        roles: roles.map((role) => ({
          roleId: role.id,
          expectedVersion: role.version,
        })),
      },
    },
  )
}

export function loadServerRoleMembers(
  context: ServerRoleApiContext,
  roleId: string,
  query = '',
) {
  const params = new URLSearchParams({ limit: '100' })
  const normalizedQuery = query.trim()

  if (normalizedQuery) {
    params.set('q', normalizedQuery)
  } else {
    params.set('roleId', roleId)
  }

  return apiJson<ServerMemberPageResponse>(
    `/api/servers/${context.serverId}/members?${params.toString()}`,
    { accessToken: context.accessToken },
  )
}

export function assignServerRoleToMember(
  context: ServerRoleApiContext,
  memberId: string,
  roleId: string,
) {
  return apiJson<ServerMemberRoleResponse>(
    `/api/servers/${context.serverId}/members/${memberId}/roles`,
    {
      method: 'POST',
      accessToken: context.accessToken,
      body: { roleId },
    },
  )
}

export function revokeServerMemberRole(
  context: ServerRoleApiContext,
  memberRoleId: string,
) {
  return apiNoContent(
    `/api/servers/${context.serverId}/member-roles/${memberRoleId}`,
    {
      method: 'DELETE',
      accessToken: context.accessToken,
    },
  )
}
