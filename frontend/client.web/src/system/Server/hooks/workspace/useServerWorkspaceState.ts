import { useMemo } from 'react'
import type {
  ServerMemberDetailsResponse,
  ServerEffectivePermissionsResponse,
  ServerMemberRoleResponse,
  ServerMemberResponse,
  ServerRoleResponse,
  SpaceResponse,
  UserResponse,
} from '../../../../shared/types'
import { compareSpaces, type ServerDetail } from '../../utils/serverWorkspaceModel'
import {
  canAccessServerRoleSettings,
  resolveServerWorkspacePermissionCapabilities,
} from '../../utils/serverEffectivePermissions'

type UseServerWorkspaceStateOptions = {
  selectedServerMembership: ServerMemberResponse
  user: UserResponse
  serverMembers: ServerMemberDetailsResponse[]
  memberRoles: ServerMemberRoleResponse[]
  serverRoles: ServerRoleResponse[]
  serverSpaces: SpaceResponse[]
  activeDetail: ServerDetail | null
  effectivePermissions: ServerEffectivePermissionsResponse | null
}

export function hasManageServerAccess(
  isOwner: boolean,
  permissionCodes: readonly string[] | undefined,
) {
  return isOwner || Boolean(permissionCodes?.includes('manage_server'))
}

export function hasEffectiveServerPermission(
  isOwner: boolean,
  permissionCodes: readonly string[] | undefined,
  requiredCode: string,
) {
  return (
    hasManageServerAccess(isOwner, permissionCodes) ||
    Boolean(permissionCodes?.includes(requiredCode))
  )
}

export function useServerWorkspaceState({
  selectedServerMembership,
  user,
  serverMembers,
  memberRoles,
  serverRoles,
  serverSpaces,
  activeDetail,
  effectivePermissions,
}: UseServerWorkspaceStateOptions) {
  const server = selectedServerMembership.server
  const isOwner = server.ownerUserId === user.id
  const currentMember = serverMembers.find((member) => member.userId === user.id)
  const permissionCapabilities =
    resolveServerWorkspacePermissionCapabilities(
      effectivePermissions,
      isOwner,
      server.id,
    )
  const canManageServer = permissionCapabilities.canAdministerServer
  const canManageRoles = canAccessServerRoleSettings(
    permissionCapabilities,
  )
  const rootSpaces = useMemo(
    () =>
      serverSpaces
        .filter((space) => !space.parentSpaceId)
        .sort(compareSpaces),
    [serverSpaces],
  )
  const textSpaces = useMemo(
    () =>
      serverSpaces
        .filter((space) => space.typeCode === 'text_room')
        .sort(compareSpaces),
    [serverSpaces],
  )
  const activeMemberExists =
    activeDetail?.type !== 'member' ||
    serverMembers.some((member) => member.id === activeDetail.memberId)
  const activeChannelExists =
    activeDetail?.type !== 'channel' ||
    activeDetail.spaceId === null ||
    serverSpaces.some((space) => space.id === activeDetail.spaceId)
  const visibleDetail: ServerDetail | null =
    activeDetail && activeMemberExists && activeChannelExists
      ? activeDetail
      : null
  const hasSelectedDetail = Boolean(visibleDetail)
  const visibleChannel =
    visibleDetail?.type === 'channel' ? visibleDetail : null
  const activeTextSpaceId =
    visibleChannel?.kind === 'text' ? visibleChannel.spaceId : null
  const selectedMember =
    visibleDetail?.type === 'member'
      ? serverMembers.find((member) => member.id === visibleDetail.memberId) ??
        null
      : null
  const selectedMemberRoles = selectedMember
    ? memberRoles
        .filter(
          (assignment) =>
            assignment.memberId === selectedMember.id && !assignment.revokedAt,
        )
        .map((assignment) =>
          serverRoles.find((role) => role.id === assignment.roleId),
        )
        .filter((role): role is ServerRoleResponse => Boolean(role))
    : []

  return {
    activeTextSpaceId,
    canAssignRoles: permissionCapabilities.canAssignRoles,
    canBanMembers: permissionCapabilities.canBanMembers,
    canDeafenVoiceMembers: permissionCapabilities.canDeafenVoiceMembers,
    canDisconnectVoiceMembers:
      permissionCapabilities.canDisconnectVoiceMembers,
    canInviteMembers: permissionCapabilities.canCreateInvites,
    canKickMembers: permissionCapabilities.canKickMembers,
    canManageBans: permissionCapabilities.canManageBans,
    canManageInvites: permissionCapabilities.canManageInvites,
    canManageJoinRequests: permissionCapabilities.canApproveJoinRequests,
    canManageReports: permissionCapabilities.canManageReports,
    canManageRoles,
    canManageServer,
    canManageServerProfile: permissionCapabilities.canManageServerProfile,
    canManageServerSettings: permissionCapabilities.canManageServerSettings,
    canMoveVoiceParticipants: permissionCapabilities.canMoveVoiceMembers,
    canMuteVoiceMembers: permissionCapabilities.canMuteVoiceMembers,
    canViewAuditLog: permissionCapabilities.canViewAuditLog,
    canViewInviteLog: permissionCapabilities.canViewInviteLog,
    canViewInvites: permissionCapabilities.canViewInvites,
    currentMember: currentMember ?? null,
    hasSelectedDetail,
    isOwner,
    rootSpaces,
    selectedMember,
    selectedMemberRoles,
    server,
    textSpaces,
    visibleChannel,
    visibleDetail,
  }
}
