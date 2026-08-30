import { useEffect, useState } from 'react';

import {
  type LayoutCacheMobileTab,
  type LayoutCacheSnapshot,
  type LayoutCacheWorkspace,
  readLayoutCache,
  writeLayoutCache
} from '../../../../shared/cache/clientCache';

type UseHubLayoutPersistenceOptions = {
  userId: string;
  activeWorkspace: LayoutCacheWorkspace;
  activeServerId: string | null;
  selectedServerId: string | null;
  activePrivateSpaceId: string | null;
  isServerPanelOpen: boolean;
  mobileTab: LayoutCacheMobileTab;
  sidePanelWidth: number;
  memberPanelWidth: number;
  profileSettings: LayoutCacheSnapshot['profileSettings'];
};

export function useHubInitialLayout(userId: string) {
  const [layoutCache] = useState(() => readLayoutCache(userId));
  return layoutCache;
}

export function useHubLayoutPersistence({
  userId,
  activeWorkspace,
  activeServerId,
  selectedServerId,
  activePrivateSpaceId,
  isServerPanelOpen,
  mobileTab,
  sidePanelWidth,
  memberPanelWidth,
  profileSettings
}: UseHubLayoutPersistenceOptions) {
  useEffect(() => {
    writeLayoutCache(userId, {
      activeWorkspace,
      activeServerId:
        activeWorkspace === 'server'
          ? (selectedServerId ?? activeServerId)
          : null,
      activePrivateSpaceId:
        activeWorkspace === 'private-space' ? activePrivateSpaceId : null,
      isServerPanelOpen,
      mobileTab,
      panelWidths: {
        sidePanelWidth,
        memberPanelWidth
      },
      profileSettings
    });
  }, [
    activePrivateSpaceId,
    activeServerId,
    activeWorkspace,
    isServerPanelOpen,
    memberPanelWidth,
    mobileTab,
    profileSettings,
    selectedServerId,
    sidePanelWidth,
    userId
  ]);
}
