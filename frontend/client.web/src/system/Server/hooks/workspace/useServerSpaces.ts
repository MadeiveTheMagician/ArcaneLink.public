import { useEffect, useRef, useState } from 'react';

import { apiJson, apiNoContent } from '../../../../shared/api/api';
import type {
  CreateSpaceRequest,
  DeleteSpaceRequest,
  PermissionResponse,
  ReorderSpacesRequest,
  ServerMemberResponse,
  SpacePermissionOverrideResponse,
  SpaceResponse,
  SpaceTypeResponse,
  UpdateSpaceRequest,
  UpsertSpacePermissionOverrideRequest
} from '../../../../shared/types';

export function useServerSpaces(
  accessToken: string,
  selectedServerMembership: ServerMemberResponse | null
) {
  const selectedServerId = selectedServerMembership?.serverId ?? null;
  const selectedServerIdRef = useRef<string | null>(selectedServerId);
  const [spaceTypes, setSpaceTypes] = useState<SpaceTypeResponse[]>([]);
  const [spacePermissions, setSpacePermissions] = useState<
    PermissionResponse[]
  >([]);
  const [serverSpaces, setServerSpaces] = useState<SpaceResponse[]>([]);
  const [loadedServerId, setLoadedServerId] = useState<string | null>(null);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [isMutatingSpaces, setIsMutatingSpaces] = useState(false);
  const visibleServerSpaces = selectedServerId
    ? serverSpaces.filter(
        (space) =>
          space.serverId?.toLowerCase() === selectedServerId.toLowerCase()
      )
    : [];

  async function loadSpaceTypes() {
    const [types, permissions] = await Promise.all([
      apiJson<SpaceTypeResponse[]>('/api/space-types', {
        accessToken
      }),
      apiJson<PermissionResponse[]>('/api/permissions/space', {
        accessToken
      })
    ]);
    setSpaceTypes(types);
    setSpacePermissions(permissions);
  }

  async function loadServerSpaces(silent = false) {
    const serverId = selectedServerId;

    if (!serverId) {
      setServerSpaces([]);
      return;
    }

    if (!silent) {
      setIsLoadingSpaces(true);
    }

    try {
      const spaces = await apiJson<SpaceResponse[]>(
        `/api/servers/${serverId}/spaces`,
        { accessToken }
      );

      if (selectedServerIdRef.current === serverId) {
        setServerSpaces(spaces);
        setLoadedServerId(serverId);
      }
    } finally {
      if (!silent && selectedServerIdRef.current === serverId) {
        setIsLoadingSpaces(false);
      }
    }
  }

  async function createSpace(request: CreateSpaceRequest) {
    if (!selectedServerMembership) {
      return null;
    }

    setIsMutatingSpaces(true);

    try {
      const space = await apiJson<SpaceResponse>(
        `/api/servers/${selectedServerMembership.serverId}/spaces`,
        {
          method: 'POST',
          accessToken,
          body: request
        }
      );
      setServerSpaces((current) => [...current, space]);
      return space;
    } finally {
      setIsMutatingSpaces(false);
    }
  }

  async function updateSpace(spaceId: string, request: UpdateSpaceRequest) {
    if (!selectedServerMembership) {
      return null;
    }

    setIsMutatingSpaces(true);

    try {
      const space = await apiJson<SpaceResponse>(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}`,
        {
          method: 'PATCH',
          accessToken,
          body: request
        }
      );
      setServerSpaces((current) =>
        current.map((item) => (item.id === space.id ? space : item))
      );
      return space;
    } finally {
      setIsMutatingSpaces(false);
    }
  }

  async function deleteSpace(
    spaceId: string,
    request: DeleteSpaceRequest = {}
  ) {
    if (!selectedServerMembership) {
      return false;
    }

    setIsMutatingSpaces(true);

    try {
      await apiNoContent(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}`,
        {
          method: 'DELETE',
          accessToken,
          body: request
        }
      );
      await loadServerSpaces(true);
      return true;
    } finally {
      setIsMutatingSpaces(false);
    }
  }

  async function reorderSpaces(request: ReorderSpacesRequest) {
    if (!selectedServerMembership || request.spaces.length === 0) {
      return false;
    }

    const previousSpaces = serverSpaces;
    const positionBySpaceId = new Map(
      request.spaces.map((space) => [space.spaceId, space])
    );

    setIsMutatingSpaces(true);
    setServerSpaces((current) =>
      current.map((space) => {
        const nextPosition = positionBySpaceId.get(space.id);

        return nextPosition
          ? {
              ...space,
              parentSpaceId: nextPosition.parentSpaceId,
              position: nextPosition.position
            }
          : space;
      })
    );

    try {
      await apiNoContent(
        `/api/servers/${selectedServerMembership.serverId}/spaces/reorder`,
        {
          method: 'PUT',
          accessToken,
          body: request
        }
      );
      await loadServerSpaces(true);
      return true;
    } catch (error) {
      setServerSpaces(previousSpaces);
      throw error;
    } finally {
      setIsMutatingSpaces(false);
    }
  }

  async function upsertSpacePermissionOverride(
    spaceId: string,
    request: UpsertSpacePermissionOverrideRequest
  ) {
    if (!selectedServerMembership) {
      return null;
    }

    setIsMutatingSpaces(true);

    try {
      const permissionOverride = await apiJson<SpacePermissionOverrideResponse>(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/permission-overrides`,
        {
          method: 'PUT',
          accessToken,
          body: request
        }
      );
      await loadServerSpaces(true);
      return permissionOverride;
    } finally {
      setIsMutatingSpaces(false);
    }
  }

  async function deleteSpacePermissionOverride(
    spaceId: string,
    overrideId: string
  ) {
    if (!selectedServerMembership) {
      return false;
    }

    setIsMutatingSpaces(true);

    try {
      await apiNoContent(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/permission-overrides/${overrideId}`,
        {
          method: 'DELETE',
          accessToken
        }
      );
      await loadServerSpaces(true);
      return true;
    } finally {
      setIsMutatingSpaces(false);
    }
  }

  useEffect(() => {
    void loadSpaceTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    selectedServerIdRef.current = selectedServerId;
    setServerSpaces([]);
    setLoadedServerId(null);

    void loadServerSpaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedServerId]);

  return {
    spaceTypes,
    spacePermissions,
    serverSpaces: visibleServerSpaces,
    isLoadingSpaces:
      isLoadingSpaces ||
      Boolean(selectedServerId && loadedServerId !== selectedServerId),
    isMutatingSpaces,
    loadServerSpaces,
    createSpace,
    updateSpace,
    deleteSpace,
    reorderSpaces,
    upsertSpacePermissionOverride,
    deleteSpacePermissionOverride
  };
}
