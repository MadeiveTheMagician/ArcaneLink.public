import { useCallback, useEffect, useRef, useState } from 'react';

import { apiJson, apiNoContent } from '../../../../shared/api/api';
import type {
  CreateServerInviteRequest,
  PermissionResponse,
  ServerAuditLogResponse,
  ServerBanResponse,
  ServerEffectivePermissionsResponse,
  ServerInviteResponse,
  ServerJoinRequestCursorResponse,
  ServerJoinRequestPageResponse,
  ServerJoinRequestResponse,
  ServerMemberDetailsResponse,
  ServerMemberResponse,
  ServerMemberRoleResponse,
  ServerPermissionCatalogResponse,
  ServerRoleResponse
} from '../../../../shared/types';
import { serverCopy } from '../../../shared';
import { resolveServerWorkspacePermissionCapabilities } from '../../utils/serverEffectivePermissions';
import type { ServerCoreTab } from '../../utils/serverWorkspaceModel';
import {
  mergeServerJoinRequestPages,
  serverJoinRequestPageSize
} from './serverJoinRequestPaginationModel';

type UseServerGovernanceOptions = {
  accessToken: string;
  currentUserId: string;
  selectedServerMembership: ServerMemberResponse | null;
  serverMembers: ServerMemberDetailsResponse[];
  loadServers: () => Promise<ServerMemberResponse[] | undefined>;
  loadServerMembers: (membership: ServerMemberResponse) => Promise<void>;
};

export function useServerGovernance({
  accessToken,
  currentUserId,
  selectedServerMembership,
  serverMembers,
  loadServers,
  loadServerMembers
}: UseServerGovernanceOptions) {
  const [serverCoreTab, setServerCoreTab] = useState<ServerCoreTab>('spaces');
  const [serverInvites, setServerInvites] = useState<ServerInviteResponse[]>(
    []
  );
  const [directServerInvites, setDirectServerInvites] = useState<
    ServerInviteResponse[]
  >([]);
  const [serverRoles, setServerRoles] = useState<ServerRoleResponse[]>([]);
  const [serverPermissions, setServerPermissions] = useState<
    PermissionResponse[]
  >([]);
  const [serverEffectivePermissions, setServerEffectivePermissions] =
    useState<ServerEffectivePermissionsResponse | null>(null);
  const [memberRoles, setMemberRoles] = useState<ServerMemberRoleResponse[]>(
    []
  );
  const [serverAuditLogs, setServerAuditLogs] = useState<
    ServerAuditLogResponse[]
  >([]);
  const [serverBans, setServerBans] = useState<ServerBanResponse[]>([]);
  const [serverJoinRequests, setServerJoinRequests] = useState<
    ServerJoinRequestResponse[]
  >([]);
  const [serverJoinRequestTotalCount, setServerJoinRequestTotalCount] =
    useState(0);
  const [serverJoinRequestError, setServerJoinRequestError] = useState<
    string | null
  >(null);
  const [hasMoreServerJoinRequests, setHasMoreServerJoinRequests] =
    useState(false);
  const [isLoadingMoreServerJoinRequests, setIsLoadingMoreServerJoinRequests] =
    useState(false);
  const [isLoadingGovernance, setIsLoadingGovernance] = useState(false);
  const [isMutatingGovernance, setIsMutatingGovernance] = useState(false);
  const serverJoinRequestCursorRef =
    useRef<ServerJoinRequestCursorResponse | null>(null);
  const serverJoinRequestServerIdRef = useRef<string | null>(null);
  const serverJoinRequestVersionRef = useRef(0);
  const isLoadingMoreServerJoinRequestsRef = useRef(false);

  const selectedServerId = selectedServerMembership?.serverId ?? null;
  const isOwner =
    selectedServerMembership?.server.ownerUserId === currentUserId;
  const permissionCapabilities = resolveServerWorkspacePermissionCapabilities(
    serverEffectivePermissions,
    isOwner,
    selectedServerId
  );
  const canViewAuditLog = permissionCapabilities.canViewAuditLog;
  const canManageJoinRequests = permissionCapabilities.canApproveJoinRequests;

  const loadEffectivePermissions = useCallback(
    (serverId: string) =>
      apiJson<ServerEffectivePermissionsResponse>(
        `/api/servers/${serverId}/members/me/effective-permissions`,
        { accessToken }
      ),
    [accessToken]
  );

  const loadAuditLogsSafe = useCallback(
    async (serverId: string, isAllowed: boolean) => {
      if (!isAllowed) {
        return [];
      }

      try {
        return await apiJson<ServerAuditLogResponse[]>(
          `/api/servers/${serverId}/audit-logs`,
          { accessToken }
        );
      } catch {
        return [];
      }
    },
    [accessToken]
  );

  useEffect(() => {
    setServerInvites([]);
    setServerRoles([]);
    setServerPermissions([]);
    setServerEffectivePermissions(null);
    setMemberRoles([]);
    setServerAuditLogs([]);
    setServerBans([]);
    setServerJoinRequests([]);
    setServerJoinRequestTotalCount(0);
    setServerJoinRequestError(null);
    serverJoinRequestVersionRef.current += 1;
    serverJoinRequestServerIdRef.current = selectedServerId;
    serverJoinRequestCursorRef.current = null;
    isLoadingMoreServerJoinRequestsRef.current = false;
    setHasMoreServerJoinRequests(false);
    setIsLoadingMoreServerJoinRequests(false);

    if (!selectedServerId) {
      return undefined;
    }

    const serverId = selectedServerId;
    let isCancelled = false;

    async function loadOverviewGovernance() {
      const [permissions, roles, effectivePermissions] = await Promise.all([
        apiJson<ServerPermissionCatalogResponse>('/api/permissions/server/v1', {
          accessToken
        }),
        apiJson<ServerRoleResponse[]>(`/api/servers/${serverId}/roles`, {
          accessToken
        }),
        loadEffectivePermissions(serverId)
      ]);
      const nextCapabilities = resolveServerWorkspacePermissionCapabilities(
        effectivePermissions,
        isOwner,
        serverId
      );
      const auditLogs = await loadAuditLogsSafe(
        serverId,
        nextCapabilities.canViewAuditLog
      );

      if (isCancelled) {
        return;
      }

      setServerPermissions(mapServerPermissionCatalog(permissions));
      setServerRoles(roles);
      setServerEffectivePermissions(effectivePermissions);
      setServerAuditLogs(auditLogs);
    }

    void loadOverviewGovernance();

    return () => {
      isCancelled = true;
    };
  }, [
    accessToken,
    isOwner,
    loadAuditLogsSafe,
    loadEffectivePermissions,
    selectedServerId
  ]);

  useEffect(() => {
    setMemberRoles(
      selectedServerId
        ? serverMembers
            .filter((member) => member.serverId === selectedServerId)
            .flatMap((member) => member.roleAssignments)
        : []
    );
  }, [selectedServerId, serverMembers]);

  async function loadFirstServerJoinRequestPage(serverId: string) {
    const requestVersion = serverJoinRequestVersionRef.current + 1;

    serverJoinRequestVersionRef.current = requestVersion;
    serverJoinRequestServerIdRef.current = serverId;
    serverJoinRequestCursorRef.current = null;
    isLoadingMoreServerJoinRequestsRef.current = false;
    setHasMoreServerJoinRequests(false);
    setIsLoadingMoreServerJoinRequests(false);
    setServerJoinRequestError(null);

    try {
      const page = await apiJson<ServerJoinRequestPageResponse>(
        `/api/servers/${serverId}/join-requests?limit=${serverJoinRequestPageSize}`,
        { accessToken }
      );

      if (
        requestVersion !== serverJoinRequestVersionRef.current ||
        serverJoinRequestServerIdRef.current !== serverId
      ) {
        return;
      }

      setServerJoinRequests(page.items);
      setServerJoinRequestTotalCount(page.totalCount);
      serverJoinRequestCursorRef.current = page.nextCursor;
      setHasMoreServerJoinRequests(page.nextCursor !== null);
    } catch {
      if (
        requestVersion === serverJoinRequestVersionRef.current &&
        serverJoinRequestServerIdRef.current === serverId
      ) {
        setServerJoinRequestError(serverCopy.settings.loadJoinRequestsFailed);
      }
    }
  }

  async function reloadServerRoles(silent = false) {
    if (!selectedServerMembership) {
      return [];
    }

    if (!silent) {
      setIsLoadingGovernance(true);
    }

    try {
      const [permissions, roles, effectivePermissions] = await Promise.all([
        apiJson<ServerPermissionCatalogResponse>('/api/permissions/server/v1', {
          accessToken
        }),
        apiJson<ServerRoleResponse[]>(
          `/api/servers/${selectedServerMembership.serverId}/roles`,
          { accessToken }
        ),
        loadEffectivePermissions(selectedServerMembership.serverId)
      ]);
      const nextCapabilities = resolveServerWorkspacePermissionCapabilities(
        effectivePermissions,
        isOwner,
        selectedServerMembership.serverId
      );
      const auditLogs = await loadAuditLogsSafe(
        selectedServerMembership.serverId,
        nextCapabilities.canViewAuditLog
      );

      setServerPermissions(mapServerPermissionCatalog(permissions));
      setServerRoles(roles);
      setServerEffectivePermissions(effectivePermissions);
      setServerAuditLogs(auditLogs);
      return roles;
    } finally {
      if (!silent) {
        setIsLoadingGovernance(false);
      }
    }
  }

  async function loadServerGovernance(tab = serverCoreTab, silent = false) {
    if (!selectedServerMembership) {
      return;
    }

    if (tab === 'roles') {
      await reloadServerRoles(silent);
      return;
    }

    const effectivePermissions = await loadEffectivePermissions(
      selectedServerMembership.serverId
    );
    setServerEffectivePermissions(effectivePermissions);
    const nextCapabilities = resolveServerWorkspacePermissionCapabilities(
      effectivePermissions,
      isOwner,
      selectedServerMembership.serverId
    );

    if (tab === 'general' || tab === 'spaces' || tab === 'moderation') {
      return;
    }

    if (!silent) {
      setIsLoadingGovernance(true);
    }

    try {
      if (tab === 'invites') {
        setServerInvites(
          await apiJson<ServerInviteResponse[]>(
            `/api/servers/${selectedServerMembership.serverId}/invites`,
            { accessToken }
          )
        );
      }

      if (tab === 'join-requests' && nextCapabilities.canApproveJoinRequests) {
        await loadFirstServerJoinRequestPage(selectedServerMembership.serverId);
      }

      if (tab === 'audit') {
        setServerAuditLogs(
          await loadAuditLogsSafe(
            selectedServerMembership.serverId,
            nextCapabilities.canViewAuditLog
          )
        );
      }

      if (tab === 'bans' && nextCapabilities.canManageBans) {
        setServerBans(
          await apiJson<ServerBanResponse[]>(
            `/api/servers/${selectedServerMembership.serverId}/bans`,
            { accessToken }
          )
        );
      }
    } finally {
      if (!silent) {
        setIsLoadingGovernance(false);
      }
    }
  }

  async function loadDirectServerInvites(silent = false) {
    if (!silent) {
      setIsLoadingGovernance(true);
    }

    try {
      setDirectServerInvites(
        await apiJson<ServerInviteResponse[]>('/api/server-invites/me', {
          accessToken
        })
      );
    } finally {
      if (!silent) {
        setIsLoadingGovernance(false);
      }
    }
  }

  useEffect(() => {
    void loadDirectServerInvites(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function openServerCoreTab(tab: ServerCoreTab) {
    setServerCoreTab(tab);
    void loadServerGovernance(tab);
  }

  function selectServerCoreTab(tab: ServerCoreTab) {
    setServerCoreTab(tab);
  }

  async function loadMoreServerJoinRequests() {
    const serverId = serverJoinRequestServerIdRef.current;
    const cursor = serverJoinRequestCursorRef.current;

    if (
      !serverId ||
      !cursor ||
      !canManageJoinRequests ||
      isLoadingMoreServerJoinRequestsRef.current
    ) {
      return false;
    }

    const requestVersion = serverJoinRequestVersionRef.current;
    const params = new URLSearchParams({
      limit: String(serverJoinRequestPageSize),
      afterCreatedAt: cursor.createdAt,
      afterId: cursor.id
    });

    isLoadingMoreServerJoinRequestsRef.current = true;
    setIsLoadingMoreServerJoinRequests(true);
    setServerJoinRequestError(null);

    try {
      const page = await apiJson<ServerJoinRequestPageResponse>(
        `/api/servers/${serverId}/join-requests?${params.toString()}`,
        { accessToken }
      );

      if (
        requestVersion !== serverJoinRequestVersionRef.current ||
        serverJoinRequestServerIdRef.current !== serverId
      ) {
        return false;
      }

      setServerJoinRequests((current) =>
        mergeServerJoinRequestPages(current, page.items)
      );
      setServerJoinRequestTotalCount(page.totalCount);
      serverJoinRequestCursorRef.current = page.nextCursor;
      setHasMoreServerJoinRequests(page.nextCursor !== null);

      return page.items.length > 0;
    } catch {
      if (
        requestVersion === serverJoinRequestVersionRef.current &&
        serverJoinRequestServerIdRef.current === serverId
      ) {
        setServerJoinRequestError(serverCopy.settings.loadJoinRequestsFailed);
      }

      return false;
    } finally {
      if (
        requestVersion === serverJoinRequestVersionRef.current &&
        serverJoinRequestServerIdRef.current === serverId
      ) {
        isLoadingMoreServerJoinRequestsRef.current = false;
        setIsLoadingMoreServerJoinRequests(false);
      }
    }
  }

  async function createServerInvite(request: CreateServerInviteRequest = {}) {
    if (!selectedServerMembership) {
      return null;
    }

    setIsMutatingGovernance(true);

    try {
      const invite = await apiJson<ServerInviteResponse>(
        `/api/servers/${selectedServerMembership.serverId}/invites`,
        {
          method: 'POST',
          accessToken,
          body: {
            kindCode: request.kindCode ?? 'link',
            targetUserId: request.targetUserId ?? null,
            maxUses: request.maxUses ?? null,
            expiresAt: request.expiresAt ?? null
          }
        }
      );
      setServerInvites((current) => [invite, ...current]);
      return invite;
    } finally {
      setIsMutatingGovernance(false);
    }
  }

  async function revokeServerInvite(inviteId: string) {
    if (!selectedServerMembership) {
      return;
    }

    setIsMutatingGovernance(true);

    try {
      await apiNoContent(
        `/api/servers/${selectedServerMembership.serverId}/invites/${inviteId}/revoke`,
        {
          method: 'POST',
          accessToken
        }
      );

      await loadServerGovernance('invites');
    } finally {
      setIsMutatingGovernance(false);
    }
  }

  async function approveServerJoinRequest(requestId: string) {
    if (!selectedServerMembership || !canManageJoinRequests) {
      return;
    }

    setIsMutatingGovernance(true);
    setServerJoinRequestError(null);

    try {
      await apiJson<ServerMemberResponse>(
        `/api/servers/${selectedServerMembership.serverId}/join-requests/${requestId}/approve`,
        {
          method: 'POST',
          accessToken
        }
      );
      setServerJoinRequests((current) =>
        current.filter((request) => request.id !== requestId)
      );
      setServerJoinRequestTotalCount((current) => Math.max(0, current - 1));
      await loadServerMembers(selectedServerMembership);
    } catch {
      setServerJoinRequestError(serverCopy.settings.approveJoinRequestFailed);
    } finally {
      setIsMutatingGovernance(false);
    }
  }

  async function declineServerJoinRequest(requestId: string) {
    if (!selectedServerMembership || !canManageJoinRequests) {
      return;
    }

    setIsMutatingGovernance(true);
    setServerJoinRequestError(null);

    try {
      await apiNoContent(
        `/api/servers/${selectedServerMembership.serverId}/join-requests/${requestId}/decline`,
        {
          method: 'POST',
          accessToken
        }
      );
      setServerJoinRequests((current) =>
        current.filter((request) => request.id !== requestId)
      );
      setServerJoinRequestTotalCount((current) => Math.max(0, current - 1));
    } catch {
      setServerJoinRequestError(serverCopy.settings.declineJoinRequestFailed);
    } finally {
      setIsMutatingGovernance(false);
    }
  }

  async function assignServerRole(memberId: string, roleId: string) {
    if (!selectedServerMembership || !roleId) {
      return;
    }

    setIsMutatingGovernance(true);

    try {
      const assignment = await apiJson<ServerMemberRoleResponse>(
        `/api/servers/${selectedServerMembership.serverId}/members/${memberId}/roles`,
        {
          method: 'POST',
          accessToken,
          body: { roleId }
        }
      );
      setMemberRoles((current) => [
        ...current.filter((item) => item.id !== assignment.id),
        assignment
      ]);
      await loadServerMembers(selectedServerMembership);
      await loadServerGovernance('audit');
    } finally {
      setIsMutatingGovernance(false);
    }
  }

  async function transferServerOwnership(member: ServerMemberDetailsResponse) {
    if (!selectedServerMembership) {
      return;
    }

    setIsMutatingGovernance(true);

    try {
      await apiNoContent(
        `/api/servers/${selectedServerMembership.serverId}/ownership-transfers`,
        {
          method: 'POST',
          accessToken,
          body: {
            toMemberId: member.id
          }
        }
      );

      const memberships = await loadServers();
      const updatedMembership =
        memberships?.find(
          (membership) =>
            membership.serverId === selectedServerMembership.serverId
        ) ?? selectedServerMembership;

      await loadServerMembers(updatedMembership);
      await loadServerGovernance('audit');
    } finally {
      setIsMutatingGovernance(false);
    }
  }

  async function banServerMember(
    member: ServerMemberDetailsResponse,
    reason: string
  ) {
    if (!selectedServerMembership || !reason.trim()) {
      return null;
    }

    setIsMutatingGovernance(true);

    try {
      const ban = await apiJson<ServerBanResponse>(
        `/api/servers/${selectedServerMembership.serverId}/members/${member.id}/ban`,
        {
          method: 'POST',
          accessToken,
          body: { reason: reason.trim() }
        }
      );
      setServerBans((current) => [
        ban,
        ...current.filter((item) => item.memberId !== ban.memberId)
      ]);
      await loadServerMembers(selectedServerMembership);
      setServerAuditLogs(
        await loadAuditLogsSafe(
          selectedServerMembership.serverId,
          canViewAuditLog
        )
      );
      return ban;
    } finally {
      setIsMutatingGovernance(false);
    }
  }

  async function unbanServerMember(memberId: string) {
    if (!selectedServerMembership) {
      return;
    }

    setIsMutatingGovernance(true);

    try {
      await apiNoContent(
        `/api/servers/${selectedServerMembership.serverId}/bans/${memberId}`,
        {
          method: 'DELETE',
          accessToken
        }
      );
      setServerBans((current) =>
        current.filter((item) => item.memberId !== memberId)
      );
      setServerAuditLogs(
        await loadAuditLogsSafe(
          selectedServerMembership.serverId,
          canViewAuditLog
        )
      );
    } finally {
      setIsMutatingGovernance(false);
    }
  }

  async function acceptDirectServerInvite(inviteId: string) {
    setIsMutatingGovernance(true);

    try {
      await apiJson<ServerMemberResponse>(
        `/api/server-invites/${inviteId}/accept`,
        {
          method: 'POST',
          accessToken
        }
      );
      await Promise.all([loadServers(), loadDirectServerInvites(true)]);
    } finally {
      setIsMutatingGovernance(false);
    }
  }

  async function declineDirectServerInvite(inviteId: string) {
    setIsMutatingGovernance(true);

    try {
      await apiNoContent(`/api/server-invites/${inviteId}/decline`, {
        method: 'POST',
        accessToken
      });
      await loadDirectServerInvites(true);
    } finally {
      setIsMutatingGovernance(false);
    }
  }

  return {
    serverCoreTab,
    serverInvites,
    directServerInvites,
    serverRoles,
    serverPermissions,
    serverEffectivePermissions,
    memberRoles,
    serverAuditLogs,
    serverBans,
    serverJoinRequests,
    serverJoinRequestTotalCount,
    serverJoinRequestError,
    hasMoreServerJoinRequests,
    isLoadingMoreServerJoinRequests,
    isLoadingGovernance,
    isMutatingGovernance,
    loadServerGovernance,
    reloadServerRoles,
    loadDirectServerInvites,
    openServerCoreTab,
    selectServerCoreTab,
    createServerInvite,
    revokeServerInvite,
    loadMoreServerJoinRequests,
    approveServerJoinRequest,
    declineServerJoinRequest,
    assignServerRole,
    transferServerOwnership,
    banServerMember,
    unbanServerMember,
    acceptDirectServerInvite,
    declineDirectServerInvite
  };
}

function mapServerPermissionCatalog(
  catalog: ServerPermissionCatalogResponse
): PermissionResponse[] {
  if (catalog.permissionSchemaVersion !== 1) {
    throw new Error(
      `Unsupported server permission schema: ${catalog.permissionSchemaVersion}`
    );
  }

  return catalog.permissions.map((permission) => ({
    id: permission.code,
    code: permission.code,
    title: permission.title,
    description: permission.description
  }));
}
