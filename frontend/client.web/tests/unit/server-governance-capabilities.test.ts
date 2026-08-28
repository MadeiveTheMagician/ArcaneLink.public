import { expect, test } from '@playwright/test';

import type {
  PermissionResponse,
  ServerEffectivePermissionsResponse,
  ServerMemberDetailsResponse,
  ServerMemberRoleResponse,
  ServerRoleResponse
} from '../../src/shared/types';
import { buildMemberContextMenuItems } from '../../src/system/Server/components/context-menus/serverWorkspaceContextMenuItems';
import {
  canAccessServerSettings,
  resolveServerWorkspacePermissionCapabilities
} from '../../src/system/Server/utils/serverEffectivePermissions';
import {
  canManageServerReports,
  canRemoveServerMember,
  getAssignableServerRoles,
  getCreatableServerRolePermissions,
  resolveAccessibleServerCoreTab
} from '../../src/system/Server/utils/serverGovernanceCapabilities';

function permission(code: string): PermissionResponse {
  return {
    id: `permission-${code}`,
    code,
    title: code,
    description: null
  };
}

function role({
  id,
  level,
  permissionCodes = [],
  isSystem = false
}: {
  id: string;
  level: number;
  permissionCodes?: string[];
  isSystem?: boolean;
}): ServerRoleResponse {
  return {
    id,
    serverId: 'server-1',
    code: isSystem ? id : null,
    title: id,
    description: null,
    color: null,
    mentionable: false,
    createdByUserId: null,
    kind: isSystem ? 'integration' : 'standard',
    level,
    isSystem,
    version: `version-${id}`,
    directAssignmentCount: 0,
    permissionSchemaVersion: 1,
    permissionCodes,
    permissions: permissionCodes.map(permission),
    createdAt: '2026-07-19T00:00:00Z',
    updatedAt: '2026-07-19T00:00:00Z'
  };
}

function assignment(roleId: string): ServerMemberRoleResponse {
  return {
    id: `assignment-${roleId}`,
    serverId: 'server-1',
    memberId: 'actor-member',
    roleId,
    roleTitle: roleId,
    assignedAt: '2026-07-19T00:00:00Z',
    revokedAt: null
  };
}

function member({
  id,
  userId,
  permissionCodes = [],
  roleIds = [],
  isOwner = false
}: {
  id: string;
  userId: string;
  permissionCodes?: string[];
  roleIds?: string[];
  isOwner?: boolean;
}): ServerMemberDetailsResponse {
  return {
    id,
    serverId: 'server-1',
    userId,
    statusCode: 'active',
    isOwner,
    joinedAt: '2026-07-19T00:00:00Z',
    leftAt: null,
    addedByUserId: null,
    createdAt: '2026-07-19T00:00:00Z',
    updatedAt: '2026-07-19T00:00:00Z',
    permissionCodes,
    roleAssignments: roleIds.map(assignment),
    user: {
      id: userId,
      login: userId,
      displayName: userId,
      avatarAssetId: null,
      avatarCropOffsetX: 0,
      avatarCropOffsetY: 0,
      avatarCropZoom: 1
    }
  };
}

const actorRole = role({
  id: 'actor-role',
  level: 10,
  permissionCodes: ['manage_roles', 'view_audit_log']
});
const lowerAllowedRole = role({
  id: 'lower-allowed',
  level: 20,
  permissionCodes: ['view_audit_log']
});
const lowerPrivilegedRole = role({
  id: 'lower-privileged',
  level: 20,
  permissionCodes: ['manage_server']
});
const lowerForeignRole = role({
  id: 'lower-foreign',
  level: 20,
  permissionCodes: ['manage_members']
});
const higherRole = role({ id: 'higher', level: 5 });
const systemRole = role({ id: 'system', level: 30, isSystem: true });
const roles = [
  actorRole,
  lowerAllowedRole,
  lowerPrivilegedRole,
  lowerForeignRole,
  higherRole,
  systemRole
];

test.describe('effective server governance capabilities', () => {
  test('limits delegated role management to lower custom roles within the actor permissions', () => {
    const actor = member({
      id: 'actor-member',
      userId: 'actor-user',
      permissionCodes: ['manage_roles', 'view_audit_log'],
      roleIds: ['actor-role']
    });

    expect(
      getAssignableServerRoles(roles, actor, false, false).map(
        (item) => item.id
      )
    ).toEqual(['lower-allowed']);
    expect(
      getAssignableServerRoles(roles, actor, true, true).map((item) => item.id)
    ).toEqual([
      'actor-role',
      'lower-allowed',
      'lower-privileged',
      'lower-foreign',
      'higher'
    ]);
    expect(
      getAssignableServerRoles(roles, actor, true, false).map((item) => item.id)
    ).toEqual(['actor-role', 'lower-allowed', 'lower-foreign', 'higher']);
  });

  test('does not offer role permissions the delegated manager does not own', () => {
    const permissions = [
      permission('manage_server'),
      permission('manage_roles'),
      permission('view_audit_log'),
      permission('manage_members')
    ];

    expect(
      getCreatableServerRolePermissions(
        permissions,
        ['manage_roles', 'view_audit_log'],
        false
      ).map((item) => item.code)
    ).toEqual(['manage_roles', 'view_audit_log']);
    expect(
      getCreatableServerRolePermissions(permissions, [], true).map(
        (item) => item.code
      )
    ).toEqual([
      'manage_server',
      'manage_roles',
      'view_audit_log',
      'manage_members'
    ]);
  });

  test('keeps audit and invite settings inaccessible without their permissions', () => {
    expect(
      resolveAccessibleServerCoreTab('general', {
        canInviteMembers: false,
        canManageServerProfile: false,
        canManageServerSettings: false,
        canDeleteServer: false,
        canViewAuditLog: false
      })
    ).toBe('spaces');
    expect(
      resolveAccessibleServerCoreTab('general', {
        canInviteMembers: false,
        canManageServerProfile: true,
        canViewAuditLog: false
      })
    ).toBe('general');
    expect(
      resolveAccessibleServerCoreTab('general', {
        canInviteMembers: false,
        canDeleteServer: true,
        canViewAuditLog: false
      })
    ).toBe('general');
    expect(
      resolveAccessibleServerCoreTab('audit', {
        canInviteMembers: true,
        canViewAuditLog: false
      })
    ).toBe('spaces');
    expect(
      resolveAccessibleServerCoreTab('invites', {
        canInviteMembers: false,
        canViewAuditLog: true
      })
    ).toBe('spaces');
    expect(
      resolveAccessibleServerCoreTab('roles', {
        canInviteMembers: false,
        canManageRoles: true,
        canViewAuditLog: false
      })
    ).toBe('roles');
    expect(
      resolveAccessibleServerCoreTab('bans', {
        canInviteMembers: true,
        canManageBans: false,
        canViewAuditLog: true
      })
    ).toBe('spaces');
    expect(
      resolveAccessibleServerCoreTab('moderation', {
        canInviteMembers: true,
        canManageReports: false,
        canViewAuditLog: true
      })
    ).toBe('spaces');
    expect(
      resolveAccessibleServerCoreTab('moderation', {
        canInviteMembers: false,
        canManageReports: true,
        canViewAuditLog: false
      })
    ).toBe('moderation');
    expect(
      resolveAccessibleServerCoreTab('join-requests', {
        canInviteMembers: true,
        canManageJoinRequests: false,
        canViewAuditLog: true
      })
    ).toBe('spaces');
    expect(
      resolveAccessibleServerCoreTab('join-requests', {
        canInviteMembers: false,
        canManageJoinRequests: true,
        canViewAuditLog: false
      })
    ).toBe('join-requests');
    expect(
      resolveAccessibleServerCoreTab('roles', {
        canInviteMembers: false,
        canManageRoles: false,
        canViewAuditLog: false
      })
    ).toBe('spaces');
  });

  test('derives exact v1 capabilities without reviving broad legacy grants', () => {
    const effectivePermissions: ServerEffectivePermissionsResponse = {
      serverId: 'server-1',
      memberId: 'member-1',
      authorizationVersion: 'version-1',
      permissionSchemaVersion: 1,
      isOwner: false,
      isAdministrator: false,
      authorityTier: 'standard',
      authorityPosition: 10,
      permissionCodes: [
        'ASSIGN_ROLES',
        'BAN_MEMBERS',
        'MOVE_VOICE_MEMBERS',
        'VIEW_INVITE_LOG'
      ]
    };

    const capabilities = resolveServerWorkspacePermissionCapabilities(
      effectivePermissions,
      false
    );

    expect(capabilities.canAssignRoles).toBe(true);
    expect(capabilities.canManageRoles).toBe(false);
    expect(capabilities.canBanMembers).toBe(true);
    expect(capabilities.canKickMembers).toBe(false);
    expect(capabilities.canMoveVoiceMembers).toBe(true);
    expect(capabilities.canMuteVoiceMembers).toBe(false);
    expect(capabilities.canViewInvites).toBe(true);
    expect(capabilities.canViewInviteLog).toBe(true);
    expect(capabilities.canCreateInvites).toBe(false);
    expect(capabilities.canAdministerServer).toBe(false);

    expect(
      resolveServerWorkspacePermissionCapabilities(null, true)
        .canAdministerServer
    ).toBe(true);
  });

  test('exposes server settings only for capabilities represented in that dialog', () => {
    const capabilitiesFor = (permissionCodes: string[], isOwner = false) =>
      resolveServerWorkspacePermissionCapabilities(
        {
          serverId: 'server-1',
          memberId: 'member-1',
          authorizationVersion: 'version-1',
          permissionSchemaVersion: 1,
          isOwner,
          isAdministrator: false,
          authorityTier: isOwner ? 'owner' : 'standard',
          authorityPosition: isOwner ? null : 10,
          permissionCodes
        },
        isOwner,
        'server-1'
      );

    expect(canAccessServerSettings(capabilitiesFor([]))).toBe(false);
    expect(canAccessServerSettings(capabilitiesFor(['SEND_MESSAGES']))).toBe(
      false
    );
    expect(
      canAccessServerSettings(capabilitiesFor(['MANAGE_SERVER_PROFILE']))
    ).toBe(true);

    for (const permissionCode of [
      'MANAGE_SERVER_SETTINGS',
      'MANAGE_ROLES',
      'ASSIGN_ROLES',
      'MANAGE_DEFAULT_PERMISSIONS',
      'CREATE_INVITES',
      'VIEW_INVITE_LOG',
      'MANAGE_INVITES',
      'APPROVE_JOIN_REQUESTS',
      'MANAGE_BANS',
      'VIEW_AUDIT_LOG',
      'MANAGE_REPORTS'
    ]) {
      expect(
        canAccessServerSettings(capabilitiesFor([permissionCode])),
        permissionCode
      ).toBe(true);
    }

    expect(canAccessServerSettings(capabilitiesFor([], true))).toBe(true);
  });

  test('allows report moderation only to owners and effective report managers', () => {
    expect(canManageServerReports({ isOwner: true, permissionCodes: [] })).toBe(
      true
    );
    expect(
      canManageServerReports({
        isOwner: false,
        permissionCodes: ['manage_server']
      })
    ).toBe(true);
    expect(
      canManageServerReports({
        isOwner: false,
        permissionCodes: ['manage_reports']
      })
    ).toBe(true);
    expect(
      canManageServerReports({
        isOwner: false,
        permissionCodes: ['manage_messages']
      })
    ).toBe(false);
  });

  test('allows managers to moderate only lower ordinary members and protects self, owner, and manage-server peers', () => {
    const actor = member({
      id: 'actor-member',
      userId: 'actor-user',
      roleIds: ['actor-role']
    });
    const ordinary = member({
      id: 'ordinary',
      userId: 'ordinary-user',
      roleIds: ['lower-allowed']
    });
    const equal = member({
      id: 'equal',
      userId: 'equal-user',
      roleIds: ['actor-role']
    });
    const manager = member({
      id: 'manager',
      userId: 'manager-user',
      permissionCodes: ['manage_server'],
      roleIds: ['lower-privileged']
    });
    const owner = member({ id: 'owner', userId: 'owner-user', isOwner: true });

    expect(
      canRemoveServerMember({
        member: ordinary,
        currentMember: actor,
        serverRoles: roles,
        currentUserId: 'actor-user',
        isOwner: false,
        canManageMembers: true
      })
    ).toBe(true);
    expect(
      canRemoveServerMember({
        member: manager,
        currentMember: actor,
        serverRoles: roles,
        currentUserId: 'actor-user',
        isOwner: false,
        canManageMembers: true
      })
    ).toBe(false);
    expect(
      canRemoveServerMember({
        member: manager,
        currentMember: null,
        serverRoles: roles,
        currentUserId: 'owner-user',
        isOwner: true,
        canManageMembers: true
      })
    ).toBe(true);
    expect(
      canRemoveServerMember({
        member: owner,
        currentMember: actor,
        serverRoles: roles,
        currentUserId: 'actor-user',
        isOwner: false,
        canManageMembers: true
      })
    ).toBe(false);
    expect(
      canRemoveServerMember({
        member: ordinary,
        currentMember: ordinary,
        serverRoles: roles,
        currentUserId: 'ordinary-user',
        isOwner: false,
        canManageMembers: true
      })
    ).toBe(false);
    expect(
      canRemoveServerMember({
        member: equal,
        currentMember: actor,
        serverRoles: roles,
        currentUserId: 'actor-user',
        isOwner: false,
        canManageMembers: true
      })
    ).toBe(false);
  });

  test('wires delegated role and member actions into the member context menu', () => {
    const actor = member({
      id: 'actor-member',
      userId: 'actor-user',
      permissionCodes: ['manage_roles', 'view_audit_log'],
      roleIds: ['actor-role']
    });
    const target = member({ id: 'target-member', userId: 'target-user' });
    const assignedRoleIds: string[] = [];
    const bannedMemberIds: string[] = [];
    const blockedUserIds: string[] = [];
    const openedProfileMemberIds: string[] = [];
    const commonOptions = {
      member: target,
      currentUserId: actor.userId,
      currentMember: actor,
      canAssignRoles: true,
      canBanMembers: false,
      canKickMembers: false,
      canManageServer: false,
      isOwner: false,
      friendUserIds: new Set<string>(),
      pendingOutgoingUserIds: new Set<string>(),
      inviteServers: [],
      serverRoles: roles,
      isMutatingFriends: false,
      isMutatingGovernance: false,
      isMutatingServerMember: false,
      isMutatingDirectMessageBlock: false,
      isUserBlockStatusResolved: true,
      isUserBlocked: false,
      onOpenMemberProfile: (selectedMember: ServerMemberDetailsResponse) =>
        openedProfileMemberIds.push(selectedMember.id),
      onOpenDirectSpace: () => undefined,
      onSendFriendRequest: () => undefined,
      onToggleUserBlock: (userId: string) => blockedUserIds.push(userId),
      onCreateDirectInvite: () => undefined,
      onAssignServerRole: (_memberId: string, roleId: string) =>
        assignedRoleIds.push(roleId),
      onTransferOwnership: () => undefined,
      onRemoveServerMember: () => undefined,
      onBanServerMember: (selectedMember: ServerMemberDetailsResponse) =>
        bannedMemberIds.push(selectedMember.id)
    };
    const roleItems = buildMemberContextMenuItems({
      ...commonOptions
    }).filter(
      (item) => item.type === 'item' && item.icon === 'role' && item.submenu
    );

    expect(roleItems).toHaveLength(1);
    const roleItem = roleItems[0];
    expect(roleItem.type).toBe('item');

    if (roleItem.type === 'item') {
      expect(roleItem.submenu?.map((item) => item.label)).toEqual([
        'lower-allowed'
      ]);
      roleItem.submenu?.[0]?.onSelect?.();
    }

    expect(assignedRoleIds).toEqual(['lower-allowed']);

    const nonModeratorItems = buildMemberContextMenuItems({
      ...commonOptions
    });
    const profileItem = nonModeratorItems.find(
      (item) => item.type === 'item' && item.icon === 'profile'
    );
    expect(profileItem?.type).toBe('item');
    if (profileItem?.type === 'item') profileItem.onSelect?.();
    expect(openedProfileMemberIds).toEqual(['target-member']);
    expect(
      nonModeratorItems.some(
        (item) =>
          item.type === 'item' && item.icon === 'block' && item.danger !== true
      )
    ).toBe(true);
    expect(
      nonModeratorItems.some(
        (item) =>
          item.type === 'item' && item.icon === 'block' && item.danger === true
      )
    ).toBe(false);

    const ordinaryTargetItems = buildMemberContextMenuItems({
      ...commonOptions,
      canBanMembers: true,
      canKickMembers: true
    });
    const personalBlockItem = ordinaryTargetItems.find(
      (item) =>
        item.type === 'item' && item.icon === 'block' && item.danger !== true
    );
    expect(personalBlockItem?.type).toBe('item');
    if (personalBlockItem?.type === 'item') {
      expect(personalBlockItem.label).toBe('Заблокировать');
      personalBlockItem.onSelect?.();
    }
    expect(blockedUserIds).toEqual(['target-user']);

    const unresolvedBlockItems = buildMemberContextMenuItems({
      ...commonOptions,
      isUserBlockStatusResolved: false
    });
    const unresolvedBlockItem = unresolvedBlockItems.find(
      (item) => item.type === 'item' && item.icon === 'block'
    );
    expect(unresolvedBlockItem?.type).toBe('item');
    if (unresolvedBlockItem?.type === 'item') {
      expect(unresolvedBlockItem.label).toBe('Проверяем блокировку…');
      expect(unresolvedBlockItem.disabled).toBe(true);
    }

    const alreadyBlockedItems = buildMemberContextMenuItems({
      ...commonOptions,
      isUserBlocked: true
    });
    expect(
      alreadyBlockedItems.find(
        (item) =>
          item.type === 'item' && item.icon === 'block' && item.danger !== true
      )?.label
    ).toBe('Разблокировать');

    expect(
      ordinaryTargetItems.some(
        (item) => item.type === 'item' && item.danger === true
      )
    ).toBe(true);
    const banItem = ordinaryTargetItems.find(
      (item) =>
        item.type === 'item' && item.icon === 'block' && item.danger === true
    );
    expect(banItem?.type).toBe('item');
    if (banItem?.type === 'item') {
      expect(banItem.label).toBe('Бан на сервере');
      banItem.onSelect?.();
    }
    expect(bannedMemberIds).toEqual(['target-member']);

    const protectedTargetItems = buildMemberContextMenuItems({
      ...commonOptions,
      member: member({
        id: 'protected-member',
        userId: 'protected-user',
        permissionCodes: ['manage_server']
      }),
      canBanMembers: true,
      canKickMembers: true
    });
    expect(
      protectedTargetItems.some(
        (item) => item.type === 'item' && item.danger === true
      )
    ).toBe(false);
    expect(
      protectedTargetItems.some(
        (item) =>
          item.type === 'item' && item.icon === 'block' && item.danger !== true
      )
    ).toBe(true);

    const selfItems = buildMemberContextMenuItems({
      ...commonOptions,
      member: actor,
      canBanMembers: true,
      canKickMembers: true
    });
    expect(
      selfItems.some(
        (item) =>
          item.type === 'item' && item.icon === 'block' && item.danger !== true
      )
    ).toBe(false);
  });
});
