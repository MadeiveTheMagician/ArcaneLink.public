import type {
  UpsertSpacePermissionOverrideRequest,
} from '../../../../../shared/types'

export type SpacePermissionTargetKind = 'role' | 'member'
export type SpacePermissionEffect = 'allow' | 'deny'

export function buildSpacePermissionOverrideRequest(
  targetKind: SpacePermissionTargetKind,
  targetId: string,
  permissionId: string,
  effect: SpacePermissionEffect,
): UpsertSpacePermissionOverrideRequest | null {
  if (!targetId || !permissionId) {
    return null
  }

  return {
    roleId: targetKind === 'role' ? targetId : null,
    memberId: targetKind === 'member' ? targetId : null,
    permissionId,
    allow: effect === 'allow',
    deny: effect === 'deny',
  }
}
