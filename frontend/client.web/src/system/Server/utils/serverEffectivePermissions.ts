import type { ServerEffectivePermissionsResponse } from '../../../shared/types'

export type ServerPermissionCode =
  | 'ADMINISTRATOR'
  | 'APPROVE_JOIN_REQUESTS'
  | 'ASSIGN_ROLES'
  | 'BAN_MEMBERS'
  | 'CREATE_INVITES'
  | 'DEAFEN_VOICE_MEMBERS'
  | 'DISCONNECT_VOICE_MEMBERS'
  | 'KICK_MEMBERS'
  | 'MANAGE_BANS'
  | 'MANAGE_DEFAULT_PERMISSIONS'
  | 'MANAGE_INVITES'
  | 'MANAGE_REPORTS'
  | 'MANAGE_ROLES'
  | 'MANAGE_SERVER_PROFILE'
  | 'MANAGE_SERVER_SETTINGS'
  | 'MOVE_VOICE_MEMBERS'
  | 'MUTE_VOICE_MEMBERS'
  | 'VIEW_AUDIT_LOG'
  | 'VIEW_INVITE_LOG'

export type ServerWorkspacePermissionCapabilities = {
  canAdministerServer: boolean
  canApproveJoinRequests: boolean
  canAssignRoles: boolean
  canBanMembers: boolean
  canCreateInvites: boolean
  canDeafenVoiceMembers: boolean
  canDisconnectVoiceMembers: boolean
  canKickMembers: boolean
  canManageBans: boolean
  canManageDefaultPermissions: boolean
  canManageInvites: boolean
  canManageReports: boolean
  canManageRoles: boolean
  canManageServerProfile: boolean
  canManageServerSettings: boolean
  canMoveVoiceMembers: boolean
  canMuteVoiceMembers: boolean
  canViewAuditLog: boolean
  canViewInviteLog: boolean
  canViewInvites: boolean
}

export function normalizeServerPermissionCode(code: string) {
  return code.trim().toUpperCase()
}

export function resolveServerWorkspacePermissionCapabilities(
  effectivePermissions: ServerEffectivePermissionsResponse | null,
  isOwner: boolean,
  expectedServerId?: string | null,
): ServerWorkspacePermissionCapabilities {
  const currentEffectivePermissions =
    expectedServerId && effectivePermissions?.serverId !== expectedServerId
      ? null
      : effectivePermissions
  const permissionCodes = new Set(
    (currentEffectivePermissions?.permissionCodes ?? []).map(
      normalizeServerPermissionCode,
    ),
  )
  const canAdministerServer =
    isOwner ||
    currentEffectivePermissions?.isOwner === true ||
    currentEffectivePermissions?.isAdministrator === true ||
    permissionCodes.has('ADMINISTRATOR')
  const has = (code: ServerPermissionCode) =>
    canAdministerServer || permissionCodes.has(code)
  const canCreateInvites = has('CREATE_INVITES')
  const canManageInvites = has('MANAGE_INVITES')
  const canManageRoles = has('MANAGE_ROLES')
  const canAssignRoles = has('ASSIGN_ROLES')
  const canManageDefaultPermissions = has('MANAGE_DEFAULT_PERMISSIONS')
  const canViewInviteLog = has('VIEW_INVITE_LOG')

  return {
    canAdministerServer,
    canApproveJoinRequests: has('APPROVE_JOIN_REQUESTS'),
    canAssignRoles,
    canBanMembers: has('BAN_MEMBERS'),
    canCreateInvites,
    canDeafenVoiceMembers: has('DEAFEN_VOICE_MEMBERS'),
    canDisconnectVoiceMembers: has('DISCONNECT_VOICE_MEMBERS'),
    canKickMembers: has('KICK_MEMBERS'),
    canManageBans: has('MANAGE_BANS'),
    canManageDefaultPermissions,
    canManageInvites,
    canManageReports: has('MANAGE_REPORTS'),
    canManageRoles,
    canManageServerProfile: has('MANAGE_SERVER_PROFILE'),
    canManageServerSettings: has('MANAGE_SERVER_SETTINGS'),
    canMoveVoiceMembers: has('MOVE_VOICE_MEMBERS'),
    canMuteVoiceMembers: has('MUTE_VOICE_MEMBERS'),
    canViewAuditLog: has('VIEW_AUDIT_LOG'),
    canViewInviteLog,
    canViewInvites:
      canCreateInvites || canManageInvites || canViewInviteLog,
  }
}

export function canAccessServerRoleSettings(
  capabilities: ServerWorkspacePermissionCapabilities,
) {
  return (
    capabilities.canManageRoles ||
    capabilities.canAssignRoles ||
    capabilities.canManageDefaultPermissions
  )
}

export function canAccessServerSettings(
  capabilities: ServerWorkspacePermissionCapabilities,
) {
  return (
    capabilities.canManageServerProfile ||
    capabilities.canManageServerSettings ||
    canAccessServerRoleSettings(capabilities) ||
    capabilities.canViewInvites ||
    capabilities.canApproveJoinRequests ||
    capabilities.canManageBans ||
    capabilities.canViewAuditLog ||
    capabilities.canManageReports
  )
}
