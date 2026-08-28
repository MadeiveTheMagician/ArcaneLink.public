import type { Page, Route } from '@playwright/test';

import type {
  CreateServerInviteRequest,
  PermissionResponse,
  ServerEffectivePermissionsResponse,
  ServerInviteResponse,
  ServerMemberDisplayColorResponse,
  ServerPermissionDefinitionResponse,
  ServerRoleResponse,
  UserDeviceSessionResponse,
  UserFriendResponse
} from '../../src/shared/types';

const now = '2026-06-21T12:00:00.000Z';

const freeSubscription = {
  id: 'subscription-free',
  code: 'free',
  title: 'Free',
  rank: 0
};

const currentUser = {
  id: 'user-owner',
  login: 'lara',
  displayName: 'Lara',
  email: 'lara@example.test',
  createdAt: now,
  presenceStatus: 'online',
  lastSeenAt: now,
  subscriptionType: freeSubscription,
  tags: []
};

const publicProfile = {
  id: currentUser.id,
  login: currentUser.login,
  displayName: currentUser.displayName,
  avatarAssetId: null,
  avatarSourceAssetId: null,
  avatarCropOffsetX: 0,
  avatarCropOffsetY: 0,
  avatarCropZoom: 1,
  bannerAssetId: null,
  bio: null,
  websiteUrl: null,
  createdAt: now,
  presenceStatus: 'online',
  lastSeenAt: now
};

const profileSettings = {
  userId: currentUser.id,
  interfaceScale: 1,
  fontScale: 1,
  serverInterfaceScale: 1,
  isServerRailPinned: true,
  expandMessageAttachmentsByDefault: false,
  loadExternalMediaPreviews: true,
  horizontalVideoCardSize: 3,
  verticalVideoCardSize: 3,
  selectedThemeCode: 'sapphire',
  profileColor: null,
  profileBackgroundAssetId: null,
  applySystemThemeToOtherProfiles: true,
  directMessagePermission: 'everyone',
  presenceVisibility: 'everyone',
  showLastSeen: true,
  presenceMode: 'automatic',
  updatedAt: now
};

const server = {
  id: 'server-palas',
  createdByUserId: currentUser.id,
  ownerUserId: currentUser.id,
  slug: 'palas',
  title: 'Palas',
  description: 'Smoke test server',
  iconAssetId: null,
  iconCropOffsetX: 0,
  iconCropOffsetY: 0,
  iconCropZoom: 1,
  defaultTextSpaceId: 'space-chat',
  accessMode: 'private',
  isPublic: false,
  isSystem: false,
  createdAt: now,
  updatedAt: now
};

const membership = {
  id: 'member-owner',
  serverId: server.id,
  userId: currentUser.id,
  statusCode: 'active',
  joinedAt: now,
  leftAt: null,
  addedByUserId: null,
  createdAt: now,
  updatedAt: now,
  unreadCount: 0,
  server,
  lastMessage: {
    spaceId: 'space-chat',
    spaceTitle: 'болтальня',
    body: 'Добро пожаловать в smoke path.',
    createdAt: now
  }
};

const serverDiscovery = {
  server,
  isMember: true,
  membershipId: membership.id,
  joinedAt: membership.joinedAt,
  memberCount: 1,
  onlineMemberCount: 1,
  textSpaceCount: 1,
  voiceSpaceCount: 1,
  friendCount: 0,
  currentUserRoleTitles: ['Владелец'],
  lastActivityAt: now
};

const serverMember = {
  id: membership.id,
  serverId: server.id,
  userId: currentUser.id,
  statusCode: 'active',
  isOwner: true,
  joinedAt: now,
  leftAt: null,
  addedByUserId: null,
  createdAt: now,
  updatedAt: now,
  permissionCodes: [
    'server.manage',
    'server.invites.manage',
    'server.spaces.manage',
    'server.members.manage'
  ],
  roleAssignments: [],
  user: {
    id: currentUser.id,
    login: currentUser.login,
    displayName: currentUser.displayName,
    avatarAssetId: null,
    avatarCropOffsetX: 0,
    avatarCropOffsetY: 0,
    avatarCropZoom: 1,
    presenceStatus: 'online',
    lastSeenAt: now
  }
};

const spaceTypes = [
  {
    id: 'space-type-category',
    code: 'category',
    title: 'Категория',
    description: null
  },
  {
    id: 'space-type-text',
    code: 'text_chat',
    title: 'Текстовый спейс',
    description: null
  },
  {
    id: 'space-type-voice',
    code: 'voice_room',
    title: 'Голосовой спейс',
    description: null
  }
];

const spaces = [
  createSpace({
    id: 'space-category',
    typeId: 'space-type-category',
    typeCode: 'category',
    parentSpaceId: null,
    title: 'Общий раздел',
    position: 0
  }),
  createSpace({
    id: 'space-chat',
    typeId: 'space-type-text',
    typeCode: 'text_chat',
    parentSpaceId: 'space-category',
    title: 'болтальня',
    position: 1
  }),
  createSpace({
    id: 'space-voice',
    typeId: 'space-type-voice',
    typeCode: 'voice_room',
    parentSpaceId: 'space-category',
    title: 'голосовая',
    position: 2
  })
];

const pinnedAsset = {
  assetId: 'asset-pin-image',
  displayOrder: 0,
  fileName: 'pinned-preview.png',
  mimeType: 'image/png',
  sizeBytes: 1024,
  createdAt: now,
  isSpoiler: false
};

const pinnedNextAsset = {
  assetId: 'asset-pin-next-image',
  displayOrder: 1,
  fileName: 'pinned-preview-next.png',
  mimeType: 'image/png',
  sizeBytes: 2048,
  createdAt: now,
  isSpoiler: false
};

const initialMessages = [
  createMessage({
    id: 'message-welcome',
    body: 'Добро пожаловать в smoke path.',
    assets: [],
    createdAt: '2026-06-21T11:58:00.000Z'
  }),
  createMessage({
    id: 'message-pinned',
    body: 'Закреп с вложением для smoke-теста.',
    assets: [pinnedAsset, pinnedNextAsset],
    createdAt: '2026-06-21T11:59:00.000Z'
  })
];

const pinnedMessages = [initialMessages[1]];

function createSpace(overrides: {
  id: string;
  typeId: string;
  typeCode: string;
  parentSpaceId: string | null;
  title: string;
  position: number;
}) {
  return {
    serverId: server.id,
    createdByUserId: currentUser.id,
    description: null,
    requiredServerRoleId: null,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    unreadCount: 0,
    permissionOverrides: [],
    effectiveCapabilities: {
      canSendMessages: true,
      canConnectVoice: true,
      canManageSpace: true
    },
    ...overrides
  };
}

function createMessage(overrides: {
  id: string;
  body: string | null;
  assets: Array<typeof pinnedAsset>;
  createdAt: string;
}) {
  return {
    serverId: server.id,
    spaceId: 'space-chat',
    senderUserId: currentUser.id,
    senderDisplayName: currentUser.displayName,
    senderAvatarAssetId: null,
    senderAvatarCropOffsetX: 0,
    senderAvatarCropOffsetY: 0,
    senderAvatarCropZoom: 1,
    messageTypeId: 'message-type-text',
    messageTypeCode: 'text',
    payload: null,
    replyToMessageId: null,
    updatedAt: overrides.createdAt,
    editedAt: null,
    deletedAt: null,
    reactions: [],
    ...overrides
  };
}

export type MockArcaneLinkApiOptions = {
  friendCount?: number;
  serverInvites?: ServerInviteResponse[];
  serverInviteLoadDelayMs?: number;
  serverInviteLoadFailures?: number;
  onCreateServerInvite?: (request: CreateServerInviteRequest) => void;
  onLoadServerInvites?: () => void;
  serverPermissions?: PermissionResponse[];
  serverPermissionDefinitions?: ServerPermissionDefinitionResponse[];
  serverRoles?: ServerRoleResponse[];
  serverRoleUpdateConflicts?: number;
  serverEffectivePermissions?: ServerEffectivePermissionsResponse;
  onCreateServerRole?: (request: MockCreateServerRoleRequest) => void;
  onUpdateServerRole?: (
    roleId: string,
    request: MockUpdateServerRoleRequest
  ) => void;
  onBeforeUpdateServerRole?: (
    roleId: string,
    request: MockUpdateServerRoleRequest,
    currentRole: ServerRoleResponse
  ) => ServerRoleResponse | null | undefined;
  onReorderServerRoles?: (request: MockReorderServerRolesRequest) => void;
  serverMemberDisplayColor?: ServerMemberDisplayColorResponse;
  onUpdateServerMemberDisplayColor?: (
    request: MockUpdateServerMemberDisplayColorRequest
  ) => void;
};

export type MockCreateServerRoleRequest = {
  title: string;
  description: string | null;
  color: string | null;
  mentionable: boolean;
  permissionSchemaVersion: number;
  permissionCodes: string[];
  level?: number | null;
};

export type MockUpdateServerRoleRequest = MockCreateServerRoleRequest & {
  expectedVersion: string;
};

export type MockReorderServerRolesRequest = {
  expectedAuthorizationVersion: string;
  roles: Array<{
    roleId: string;
    expectedVersion: string;
  }>;
};

export type MockUpdateServerMemberDisplayColorRequest = {
  mode: ServerMemberDisplayColorResponse['mode'];
  roleId: string | null;
  expectedRolesVersion: string;
};

export async function mockArcaneLinkApi(
  page: Page,
  options: MockArcaneLinkApiOptions = {}
) {
  const messages = [...initialMessages];
  const friends = Array.from({ length: options.friendCount ?? 0 }, (_, index) =>
    createFriend(index + 1)
  );
  const serverInvites = [...(options.serverInvites ?? [])];
  const serverRoles = [...(options.serverRoles ?? [])];
  let deviceSessions: UserDeviceSessionResponse[] = [
    {
      id: 'device-e2e',
      deviceName: 'Current browser',
      ipAddress: '127.0.0.1',
      userAgent: 'Playwright',
      createdAt: now,
      lastUsedAt: now,
      isCurrent: true
    },
    {
      id: 'device-other',
      deviceName: 'Other browser',
      ipAddress: '127.0.0.2',
      userAgent: 'Playwright',
      createdAt: now,
      lastUsedAt: now,
      isCurrent: false
    }
  ];
  let serverMemberDisplayColor: ServerMemberDisplayColorResponse =
    options.serverMemberDisplayColor ?? {
      mode: 'default',
      roleId: null,
      rolesVersion: 'member-roles-version-1',
      resolvedRoleId: null,
      resolvedColor: null,
      availableRoles: []
    };
  let remainingServerInviteLoadFailures = options.serverInviteLoadFailures ?? 0;
  let remainingServerRoleUpdateConflicts =
    options.serverRoleUpdateConflicts ?? 0;

  await page.route(/^https?:\/\/[^/]+\/hubs(?:\/|$)/, (route) =>
    route.fulfill({ status: 404, body: '' })
  );

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === 'POST' && path === '/api/auth/login') {
      return json(route, {
        ...currentUser,
        accessToken: 'e2e-access-token',
        refreshToken: 'e2e-refresh-token',
        deviceSessionId: 'device-e2e'
      });
    }

    if (method === 'POST' && path === '/api/auth/logout') {
      return json(route, {});
    }

    if (method === 'GET' && path === '/api/auth/sessions') {
      return json(route, deviceSessions);
    }

    if (
      method === 'POST' &&
      path.startsWith('/api/auth/sessions/') &&
      path.endsWith('/revoke')
    ) {
      const sessionId = path.split('/')[4];
      deviceSessions = deviceSessions.filter(
        (session) => session.id !== sessionId || session.isCurrent
      );
      return route.fulfill({ status: 204, body: '' });
    }

    if (method === 'POST' && path === '/api/auth/sessions/revoke-others') {
      deviceSessions = deviceSessions.filter((session) => session.isCurrent);
      return route.fulfill({ status: 204, body: '' });
    }

    if (method === 'POST' && path === '/api/auth/sessions/revoke-all') {
      deviceSessions = [];
      return route.fulfill({ status: 204, body: '' });
    }

    if (method === 'GET' && path === '/api/users/me') {
      return json(route, currentUser);
    }

    if (method === 'GET' && path === '/api/users/me/profile') {
      return json(route, publicProfile);
    }

    if (method === 'GET' && path === `/api/users/${currentUser.id}`) {
      return json(route, publicProfile);
    }

    if (method === 'GET' && path === '/api/users/me/profile/settings') {
      return json(route, profileSettings);
    }

    if (method === 'GET' && path === '/api/servers/me') {
      return json(route, [membership]);
    }

    if (method === 'GET' && path === '/api/servers/discover') {
      return json(route, [serverDiscovery]);
    }

    if (method === 'GET' && path === `/api/servers/${server.id}/members`) {
      if (url.searchParams.has('limit')) {
        return json(route, {
          items: [serverMember],
          nextCursor: null,
          totalCount: 1
        });
      }

      return json(route, [serverMember]);
    }

    if (method === 'GET' && path === '/api/space-types') {
      return json(route, spaceTypes);
    }

    if (method === 'GET' && path === `/api/servers/${server.id}/spaces`) {
      return json(route, spaces);
    }

    if (
      method === 'GET' &&
      path === `/api/servers/${server.id}/spaces/space-chat/messages`
    ) {
      return json(route, messages);
    }

    if (
      method === 'GET' &&
      path === `/api/servers/${server.id}/spaces/space-chat/messages/pinned`
    ) {
      return json(route, pinnedMessages);
    }

    if (
      method === 'PUT' &&
      path === `/api/servers/${server.id}/spaces/space-chat/messages/read-state`
    ) {
      const requestBody = (await request.postDataJSON()) as {
        throughMessageId: string;
      };
      return json(route, {
        userId: currentUser.id,
        serverId: server.id,
        spaceId: 'space-chat',
        lastReadMessageId: requestBody.throughMessageId,
        lastReadMessageCreatedAt: now,
        readAt: now,
        updatedAt: now,
        advanced: true,
        unreadCount: 0
      });
    }

    if (
      method === 'POST' &&
      path === `/api/servers/${server.id}/spaces/space-chat/messages`
    ) {
      const requestBody = (await request.postDataJSON()) as {
        body?: string | null;
      };
      const message = createMessage({
        id: `message-${messages.length + 1}`,
        body: requestBody.body ?? null,
        assets: [],
        createdAt: now
      });
      messages.push(message);
      return json(route, message);
    }

    if (method === 'GET' && path === '/api/friends') {
      return json(route, friends);
    }

    if (method === 'GET' && path === '/api/friends/requests/incoming') {
      return json(route, []);
    }

    if (method === 'GET' && path === '/api/friends/requests/outgoing') {
      return json(route, []);
    }

    if (method === 'GET' && path === '/api/private-spaces') {
      return json(route, []);
    }

    if (method === 'GET' && path === '/api/private-space-folders') {
      return json(route, []);
    }

    if (method === 'GET' && path === '/api/permissions/space') {
      return json(route, []);
    }

    if (method === 'GET' && path === '/api/server-invites/me') {
      return json(route, []);
    }

    if (method === 'GET' && path === `/api/servers/${server.id}/invites`) {
      options.onLoadServerInvites?.();

      if (options.serverInviteLoadDelayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.serverInviteLoadDelayMs)
        );
      }

      if (remainingServerInviteLoadFailures > 0) {
        remainingServerInviteLoadFailures -= 1;
        return json(route, { message: 'Mock server invite load failed' }, 500);
      }

      return json(route, serverInvites);
    }

    if (method === 'POST' && path === `/api/servers/${server.id}/invites`) {
      const requestBody =
        (await request.postDataJSON()) as CreateServerInviteRequest;
      options.onCreateServerInvite?.(requestBody);

      const invite = createServerInvite(requestBody, serverInvites.length + 1);
      serverInvites.unshift(invite);
      return json(route, invite);
    }

    if (method === 'GET' && path === '/api/permissions/server') {
      return json(route, resolveLegacyServerPermissions(options));
    }

    if (method === 'GET' && path === '/api/permissions/server/v1') {
      return json(route, {
        permissionSchemaVersion: 1,
        permissions: options.serverPermissionDefinitions ?? []
      });
    }

    if (method === 'GET' && path === `/api/servers/${server.id}/roles`) {
      return json(route, serverRoles);
    }

    if (
      method === 'GET' &&
      path === `/api/servers/${server.id}/members/me/effective-permissions`
    ) {
      return json(
        route,
        options.serverEffectivePermissions ?? {
          serverId: server.id,
          memberId: serverMember.id,
          authorizationVersion: 'authorization-version-1',
          permissionSchemaVersion: 1,
          isOwner: true,
          isAdministrator: false,
          authorityTier: 'owner',
          authorityPosition: null,
          permissionCodes: []
        }
      );
    }

    if (
      method === 'GET' &&
      path === `/api/servers/${server.id}/members/me/display-color`
    ) {
      return json(route, serverMemberDisplayColor);
    }

    if (
      method === 'PATCH' &&
      path === `/api/servers/${server.id}/members/me/display-color`
    ) {
      const requestBody =
        (await request.postDataJSON()) as MockUpdateServerMemberDisplayColorRequest;
      if (
        requestBody.expectedRolesVersion !==
        serverMemberDisplayColor.rolesVersion
      ) {
        return json(
          route,
          { code: 'server_member_display_color_conflict' },
          409
        );
      }

      options.onUpdateServerMemberDisplayColor?.(requestBody);
      const selectedRole =
        requestBody.mode === 'role'
          ? (serverMemberDisplayColor.availableRoles.find(
              (role) => role.id === requestBody.roleId
            ) ?? null)
          : requestBody.mode === 'auto'
            ? (serverMemberDisplayColor.availableRoles[0] ?? null)
            : null;
      serverMemberDisplayColor = {
        ...serverMemberDisplayColor,
        mode: requestBody.mode,
        roleId: requestBody.roleId,
        rolesVersion: `${serverMemberDisplayColor.rolesVersion}-next`,
        resolvedRoleId: selectedRole?.id ?? null,
        resolvedColor: selectedRole?.color ?? null
      };
      return json(route, serverMemberDisplayColor);
    }

    if (method === 'POST' && path === `/api/servers/${server.id}/roles`) {
      const requestBody =
        (await request.postDataJSON()) as MockCreateServerRoleRequest;
      options.onCreateServerRole?.(requestBody);
      const createdRole = createServerRoleResponse(
        requestBody,
        serverRoles.length + 1,
        resolveLegacyServerPermissions(options)
      );
      serverRoles.push(createdRole);
      return json(route, createdRole);
    }

    if (method === 'PUT' && path === `/api/servers/${server.id}/roles/order`) {
      const requestBody =
        (await request.postDataJSON()) as MockReorderServerRolesRequest;
      options.onReorderServerRoles?.(requestBody);

      const nextRoles = requestBody.roles
        .map((item, index) => {
          const role = serverRoles.find(
            (candidate) => candidate.id === item.roleId
          );
          if (!role || role.version !== item.expectedVersion) {
            return null;
          }

          return {
            ...role,
            level: 10 + index,
            version: `${role.version}-reordered`,
            updatedAt: now
          };
        })
        .filter((role): role is ServerRoleResponse => role !== null);
      if (nextRoles.length !== requestBody.roles.length) {
        return json(route, { code: 'server_role_conflict' }, 409);
      }

      serverRoles.splice(0, serverRoles.length, ...nextRoles);
      return route.fulfill({ status: 204 });
    }

    const roleMatch = path.match(
      new RegExp(`^/api/servers/${server.id}/roles/([^/]+)$`)
    );
    if (method === 'PATCH' && roleMatch) {
      const roleId = roleMatch[1] ?? '';
      const roleIndex = serverRoles.findIndex((role) => role.id === roleId);
      if (roleIndex < 0) {
        return json(route, { code: 'server_role_not_found' }, 404);
      }

      const requestBody =
        (await request.postDataJSON()) as MockUpdateServerRoleRequest;
      let currentRole = serverRoles[roleIndex];
      const replacementRole = currentRole
        ? options.onBeforeUpdateServerRole?.(roleId, requestBody, currentRole)
        : undefined;
      if (replacementRole === null) {
        serverRoles.splice(roleIndex, 1);
        return json(route, { code: 'server_role_conflict' }, 409);
      }
      if (replacementRole) {
        serverRoles[roleIndex] = replacementRole;
        currentRole = replacementRole;
      }
      if (remainingServerRoleUpdateConflicts > 0) {
        remainingServerRoleUpdateConflicts -= 1;
        return json(route, { code: 'server_role_conflict' }, 409);
      }
      if (!currentRole || currentRole.version !== requestBody.expectedVersion) {
        return json(route, { code: 'server_role_conflict' }, 409);
      }

      options.onUpdateServerRole?.(roleId, requestBody);
      const updatedRole: ServerRoleResponse = {
        ...currentRole,
        title: requestBody.title,
        description: requestBody.description,
        color: requestBody.color,
        mentionable: requestBody.mentionable,
        version: `${currentRole.version}-next`,
        permissionSchemaVersion: requestBody.permissionSchemaVersion,
        permissionCodes: normalizeV1PermissionCodes(
          requestBody.permissionCodes
        ),
        permissions: resolveServerRolePermissions(
          requestBody.permissionCodes,
          resolveLegacyServerPermissions(options)
        ),
        updatedAt: now
      };
      serverRoles[roleIndex] = updatedRole;
      return json(route, updatedRole);
    }

    if (method === 'GET' && path === `/api/servers/${server.id}/audit-logs`) {
      return json(route, []);
    }

    if (method === 'GET' && path.startsWith('/api/assets/')) {
      return route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="#21145f"/><circle cx="32" cy="24" r="12" fill="#8f7cff"/></svg>'
      });
    }

    return json(
      route,
      { message: `Unhandled e2e API route: ${method} ${path}` },
      404
    );
  });
}

function createFriend(index: number): UserFriendResponse {
  const id = `friend-${String(index).padStart(2, '0')}`;

  return {
    userId: currentUser.id,
    friendUserId: id,
    createdByRequestId: `friend-request-${index}`,
    createdAt: now,
    friend: {
      id,
      login: `arcane_friend_${String(index).padStart(2, '0')}`,
      displayName: `Arcane Friend ${String(index).padStart(2, '0')}`,
      avatarAssetId: null,
      avatarCropOffsetX: 0,
      avatarCropOffsetY: 0,
      avatarCropZoom: 1,
      presenceStatus: index % 2 === 0 ? 'online' : 'offline',
      lastSeenAt: now,
      tags: [],
      mutualServerCount: 1,
      mutualFriendCount: 0,
      sharedTagCount: 0,
      recommendationScore: 0,
      isFriend: true,
      hasIncomingFriendRequest: false,
      hasOutgoingFriendRequest: false
    }
  };
}

function createServerInvite(
  request: CreateServerInviteRequest,
  sequence: number
): ServerInviteResponse {
  const kindCode = request.kindCode ?? 'link';

  return {
    id: `server-invite-${sequence}`,
    serverId: server.id,
    serverTitle: server.title,
    serverDescription: server.description,
    serverIconAssetId: server.iconAssetId,
    serverIconCropOffsetX: server.iconCropOffsetX,
    serverIconCropOffsetY: server.iconCropOffsetY,
    serverIconCropZoom: server.iconCropZoom,
    memberCount: 1,
    onlineCount: 1,
    kindCode,
    code: kindCode === 'link' ? `palas-generated-${sequence}` : null,
    targetUserId: request.targetUserId ?? null,
    maxUses: request.maxUses ?? null,
    usedCount: 0,
    expiresAt: request.expiresAt ?? null,
    createdAt: now,
    revokedAt: null,
    isActive: true
  };
}

function createServerRoleResponse(
  request: MockCreateServerRoleRequest,
  sequence: number,
  permissions: readonly PermissionResponse[]
): ServerRoleResponse {
  return {
    id: `server-role-${sequence}`,
    serverId: server.id,
    code: null,
    title: request.title,
    description: request.description,
    kind: 'standard',
    color: request.color,
    mentionable: request.mentionable,
    createdByUserId: currentUser.id,
    level: request.level ?? 10 + sequence,
    isSystem: false,
    version: `server-role-version-${sequence}`,
    directAssignmentCount: 0,
    permissionSchemaVersion: request.permissionSchemaVersion,
    permissionCodes: normalizeV1PermissionCodes(request.permissionCodes),
    permissions: resolveServerRolePermissions(
      request.permissionCodes,
      permissions
    ),
    createdAt: now,
    updatedAt: now
  };
}

function resolveServerRolePermissions(
  permissionCodes: readonly string[],
  permissions: readonly PermissionResponse[]
) {
  const requestedCodes = new Set(normalizeV1PermissionCodes(permissionCodes));
  return permissions.filter((permission) =>
    requestedCodes.has(permission.code.trim().toUpperCase())
  );
}

function normalizeV1PermissionCodes(permissionCodes: readonly string[]) {
  return [
    ...new Set(
      permissionCodes
        .map((permissionCode) => permissionCode.trim().toUpperCase())
        .filter(Boolean)
    )
  ].sort((left, right) => left.localeCompare(right));
}

function resolveLegacyServerPermissions(
  options: MockArcaneLinkApiOptions
): PermissionResponse[] {
  if (options.serverPermissions) {
    return options.serverPermissions;
  }

  return (options.serverPermissionDefinitions ?? []).map((permission) => ({
    id: permission.code,
    code: permission.code,
    title: permission.title,
    description: permission.description
  }));
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });
}
