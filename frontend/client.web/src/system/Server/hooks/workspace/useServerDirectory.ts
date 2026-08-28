import { useEffect, useMemo, useRef, useState } from 'react';

import { apiJson, apiNoContent } from '../../../../shared/api/api';
import type {
  ServerDiscoveryResponse,
  ServerJoinResponse
} from '../../../../shared/types';
import { createRealtimeRefreshCoalescer } from '../../../shared/hooks/realtimeRefreshCoalescer';
import { serverDirectoryChangedWindowEvent } from '../../../shared/hooks/serverRealtimeEvents';
import { useUserPresenceChanged } from '../../../shared/hooks/useUserPresenceChanged';
import {
  type ServerDirectoryRequest,
  type ServerDirectorySort,
  type ServerDirectoryVisibility,
  createServerDirectoryRequest
} from '../../components/navigation/serverDirectoryModel';

export function useServerDirectory(
  accessToken: string,
  visibility: ServerDirectoryVisibility
) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ServerDirectorySort>('active');
  const [serversByScope, setServersByScope] = useState(
    () => new Map<string, ServerDiscoveryResponse[]>()
  );
  const [loadingRequestKey, setLoadingRequestKey] = useState<string | null>(
    null
  );
  const [settledRequestKey, setSettledRequestKey] = useState<string | null>(
    null
  );
  const [errorRequestKey, setErrorRequestKey] = useState<string | null>(null);
  const [mutatingServerIds, setMutatingServerIds] = useState<Set<string>>(
    () => new Set()
  );
  const requestRef = useRef<ServerDirectoryRequest | null>(null);
  const refreshRef = useRef<ReturnType<
    typeof createRealtimeRefreshCoalescer
  > | null>(null);

  useEffect(() => {
    const refresh = createRealtimeRefreshCoalescer(async () => {
      const request = requestRef.current;
      if (!request) {
        return;
      }

      setLoadingRequestKey(request.key);
      setErrorRequestKey((current) =>
        current === request.key ? null : current
      );

      try {
        const nextServers = await apiJson<ServerDiscoveryResponse[]>(
          request.url,
          { accessToken: request.accessToken }
        );

        if (requestRef.current?.key === request.key) {
          const scopeKey = createScopeKey(
            request.accessToken,
            request.visibility
          );
          setServersByScope((current) => {
            const next = new Map(current);
            next.set(scopeKey, nextServers);
            return next;
          });
        }
      } catch {
        if (requestRef.current?.key === request.key) {
          setErrorRequestKey(request.key);
        }
      } finally {
        if (requestRef.current?.key === request.key) {
          setSettledRequestKey(request.key);
          setLoadingRequestKey(null);
        }
      }
    }, 220);
    refreshRef.current = refresh;

    return () => {
      refresh.dispose();

      if (refreshRef.current === refresh) {
        refreshRef.current = null;
        requestRef.current = null;
      }
    };
  }, []);

  const request = useMemo(
    () =>
      createServerDirectoryRequest({
        accessToken,
        query: visibility === 'member' ? '' : query,
        sort: visibility === 'member' ? 'active' : sort,
        visibility
      }),
    [accessToken, query, sort, visibility]
  );

  useEffect(() => {
    requestRef.current = request;
    refreshRef.current?.request();
  }, [request]);

  useUserPresenceChanged(() => {
    refreshRef.current?.request();
  });

  useEffect(() => {
    function handleServerDirectoryChanged() {
      refreshRef.current?.request();
    }

    window.addEventListener(
      serverDirectoryChangedWindowEvent,
      handleServerDirectoryChanged
    );
    return () => {
      window.removeEventListener(
        serverDirectoryChangedWindowEvent,
        handleServerDirectoryChanged
      );
    };
  }, []);

  const scopeKey = createScopeKey(accessToken, visibility);
  const servers = serversByScope.get(scopeKey) ?? [];

  async function joinServer(serverId: string) {
    setServerMutationPending(serverId, true);

    try {
      const response = await apiJson<ServerJoinResponse>(
        `/api/servers/${serverId}/join`,
        {
          method: 'POST',
          accessToken
        }
      );

      if (response.status === 'pending' && response.joinRequest) {
        updateCachedServer(serverId, (discovery) => ({
          ...discovery,
          joinAction: 'pending',
          currentUserJoinRequest: response.joinRequest
        }));
      } else if (response.status === 'joined' && response.membership) {
        updateCachedServer(serverId, null);
      }

      return response;
    } finally {
      setServerMutationPending(serverId, false);
    }
  }

  async function cancelJoinRequest(serverId: string) {
    setServerMutationPending(serverId, true);

    try {
      await apiNoContent(`/api/servers/${serverId}/join-requests/me`, {
        method: 'DELETE',
        accessToken
      });
      updateCachedServer(serverId, (discovery) => ({
        ...discovery,
        joinAction: 'request',
        currentUserJoinRequest: null
      }));
    } finally {
      setServerMutationPending(serverId, false);
    }
  }

  function setServerMutationPending(serverId: string, isPending: boolean) {
    setMutatingServerIds((current) => {
      const next = new Set(current);

      if (isPending) {
        next.add(serverId);
      } else {
        next.delete(serverId);
      }

      return next;
    });
  }

  function updateCachedServer(
    serverId: string,
    update:
      ((discovery: ServerDiscoveryResponse) => ServerDiscoveryResponse) | null
  ) {
    setServersByScope((current) => {
      const next = new Map(current);

      current.forEach((items, key) => {
        next.set(
          key,
          update
            ? items.map((item) =>
                item.server.id === serverId ? update(item) : item
              )
            : items.filter((item) => item.server.id !== serverId)
        );
      });

      return next;
    });
  }

  return {
    hasError: errorRequestKey === request.key,
    hasLoaded: serversByScope.has(scopeKey),
    isLoading:
      settledRequestKey !== request.key || loadingRequestKey === request.key,
    query,
    servers,
    sort,
    cancelJoinRequest,
    isServerMutationPending: (serverId: string) =>
      mutatingServerIds.has(serverId),
    joinServer,
    refresh: () => refreshRef.current?.request(),
    setQuery,
    setSort
  };
}

function createScopeKey(
  accessToken: string,
  visibility: ServerDirectoryVisibility
) {
  return `${accessToken}\u0000${visibility}`;
}
