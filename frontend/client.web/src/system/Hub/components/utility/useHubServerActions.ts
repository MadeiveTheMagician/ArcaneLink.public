import { useState } from 'react';

import { apiJson } from '../../../../shared/api/api';
import type {
  ServerMemberResponse,
  ServerResponse,
  UpdateServerRequest
} from '../../../../shared/types';
import type { ServerCoreTab } from '../../../Server/utils/serverWorkspaceModel';

type UseHubServerActionsOptions = {
  accessToken: string;
  selectedServerMembership: ServerMemberResponse | null;
  serverCoreTab: ServerCoreTab;
  loadServerGovernance: (
    tab?: ServerCoreTab,
    silent?: boolean
  ) => Promise<void>;
  updateServerMembership: (server: ServerResponse) => void;
};

export function useHubServerActions({
  accessToken,
  selectedServerMembership,
  serverCoreTab,
  loadServerGovernance,
  updateServerMembership
}: UseHubServerActionsOptions) {
  const [isServerSettingsMenuOpen, setIsServerSettingsMenuOpen] =
    useState(false);

  function openServerSettingsMenu() {
    setIsServerSettingsMenuOpen(true);
    void loadServerGovernance(serverCoreTab);
  }

  function openServerSettingsMenuWithoutReload() {
    setIsServerSettingsMenuOpen(true);
  }

  function closeServerSettingsMenu() {
    setIsServerSettingsMenuOpen(false);
  }

  async function updateServerSettings(request: UpdateServerRequest) {
    if (!selectedServerMembership) {
      return null;
    }

    const updatedServer = await apiJson<ServerResponse>(
      `/api/servers/${selectedServerMembership.serverId}`,
      {
        method: 'PATCH',
        accessToken,
        body: request
      }
    );

    updateServerMembership(updatedServer);
    return updatedServer;
  }

  return {
    isServerSettingsMenuOpen,
    openServerSettingsMenu,
    openServerSettingsMenuWithoutReload,
    closeServerSettingsMenu,
    updateServerSettings
  };
}
