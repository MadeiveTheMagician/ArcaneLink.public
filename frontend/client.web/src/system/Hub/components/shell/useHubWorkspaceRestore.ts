import { useEffect } from 'react';

import type { ServerMemberResponse } from '../../../../shared/types';
import type { HubWorkspace } from './useHubWorkspace';

type UseHubWorkspaceRestoreOptions = {
  activeWorkspace: HubWorkspace;
  activeServerId: string | null;
  selectedServerMembership: ServerMemberResponse | null;
  serverMemberships: ServerMemberResponse[];
  hasLoadedServers: boolean;
  loadServerMembers: (
    membership: ServerMemberResponse,
    silent?: boolean
  ) => Promise<void>;
  showProfileWorkspace: () => void;
};

export function useHubWorkspaceRestore({
  activeWorkspace,
  activeServerId,
  selectedServerMembership,
  serverMemberships,
  hasLoadedServers,
  loadServerMembers,
  showProfileWorkspace
}: UseHubWorkspaceRestoreOptions) {
  useEffect(() => {
    const action = resolveHubWorkspaceRestore({
      activeWorkspace,
      activeServerId,
      hasSelectedServerMembership: Boolean(selectedServerMembership),
      serverIds: serverMemberships.map((membership) => membership.serverId),
      hasLoadedServers
    });

    if (action === 'none') {
      return;
    }

    if (action === 'load-server-members') {
      const membership = serverMemberships.find(
        (item) => item.serverId === activeServerId
      );
      if (!membership) {
        return;
      }
      void loadServerMembers(membership, true);
      return;
    }

    showProfileWorkspace();
  }, [
    activeServerId,
    activeWorkspace,
    loadServerMembers,
    selectedServerMembership,
    serverMemberships,
    hasLoadedServers,
    showProfileWorkspace
  ]);
}

export function resolveHubWorkspaceRestore({
  activeWorkspace,
  activeServerId,
  hasSelectedServerMembership,
  serverIds,
  hasLoadedServers
}: {
  activeWorkspace: HubWorkspace;
  activeServerId: string | null;
  hasSelectedServerMembership: boolean;
  serverIds: string[];
  hasLoadedServers: boolean;
}): 'none' | 'load-server-members' | 'show-profile' {
  if (
    activeWorkspace !== 'server' ||
    hasSelectedServerMembership ||
    !activeServerId
  ) {
    return 'none';
  }

  if (serverIds.includes(activeServerId)) {
    return 'load-server-members';
  }

  return hasLoadedServers ? 'show-profile' : 'none';
}
