import { useEffect, useRef } from 'react';

import type { ServerMemberResponse } from '../../../../shared/types';
import type { MobileHubTab } from '../../../Mobile/components/MobileHubNav';
import type { HubWorkspace } from './useHubWorkspace';

const mobileHistoryMarker = 'arcanelink-mobile-stage';
const mobileHistoryRootMarker = 'arcanelink-mobile-root';

type MobileHistorySnapshot = {
  tab: MobileHubTab;
  workspace: HubWorkspace;
  serverId: string | null;
  privateSpaceId: string | null;
  overlay: 'settings' | 'create-server' | null;
};

type UseMobileBrowserHistoryOptions = MobileHistorySnapshot & {
  serverMemberships: ServerMemberResponse[];
  onOpenServers: () => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  onOpenMenu: () => void;
  onOpenServer: (membership: ServerMemberResponse) => void;
  onOpenPrivateSpace: (spaceId: string) => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onOpenCreateServer: () => void;
  onCloseCreateServer: () => void;
};

function normalizeSnapshot(
  snapshot: MobileHistorySnapshot
): MobileHistorySnapshot {
  const normalized = {
    tab: snapshot.tab,
    workspace: snapshot.workspace,
    serverId: snapshot.serverId,
    privateSpaceId: snapshot.privateSpaceId,
    overlay: snapshot.overlay ?? null
  };

  if (snapshot.workspace === 'server' || snapshot.workspace === 'servers') {
    return { ...normalized, tab: 'servers' };
  }

  if (snapshot.workspace === 'private-space') {
    return { ...normalized, tab: 'messages' };
  }

  return normalized;
}

function snapshotKey(snapshot: MobileHistorySnapshot) {
  return [
    snapshot.tab,
    snapshot.workspace,
    snapshot.serverId ?? '',
    snapshot.privateSpaceId ?? '',
    snapshot.overlay ?? ''
  ].join(':');
}

function stateRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function readSnapshot(value: unknown): MobileHistorySnapshot | null {
  const state = stateRecord(value);
  const snapshot = state[mobileHistoryMarker];
  if (!snapshot || typeof snapshot !== 'object') return null;

  const candidate = snapshot as Partial<MobileHistorySnapshot>;
  if (
    typeof candidate.tab !== 'string' ||
    typeof candidate.workspace !== 'string'
  ) {
    return null;
  }

  return candidate as MobileHistorySnapshot;
}

export function useMobileBrowserHistory(
  options: UseMobileBrowserHistoryOptions
) {
  const normalizedSnapshot = normalizeSnapshot(options);
  const currentSnapshotRef = useRef(normalizedSnapshot);
  const optionsRef = useRef(options);
  const initializedRef = useRef(false);
  const lastSnapshotKeyRef = useRef('');
  const suppressedSnapshotKeyRef = useRef<string | null>(null);

  useEffect(() => {
    currentSnapshotRef.current = normalizedSnapshot;
    optionsRef.current = options;
  }, [normalizedSnapshot, options]);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 760px)').matches) return;

    const currentSnapshot = normalizedSnapshot;
    const currentKey = snapshotKey(currentSnapshot);
    const currentState = stateRecord(window.history.state);

    if (!initializedRef.current) {
      if (readSnapshot(currentState)) {
        window.history.replaceState(
          {
            ...currentState,
            [mobileHistoryMarker]: currentSnapshot
          },
          ''
        );
      } else {
        window.history.replaceState(
          {
            ...currentState,
            [mobileHistoryRootMarker]: true
          },
          ''
        );
        window.history.pushState(
          {
            ...currentState,
            [mobileHistoryRootMarker]: false,
            [mobileHistoryMarker]: currentSnapshot
          },
          ''
        );
      }

      initializedRef.current = true;
      lastSnapshotKeyRef.current = currentKey;
      return;
    }

    if (suppressedSnapshotKeyRef.current === currentKey) {
      suppressedSnapshotKeyRef.current = null;
      lastSnapshotKeyRef.current = currentKey;
      return;
    }

    if (lastSnapshotKeyRef.current === currentKey) return;

    window.history.pushState(
      {
        ...currentState,
        [mobileHistoryRootMarker]: false,
        [mobileHistoryMarker]: currentSnapshot
      },
      ''
    );
    lastSnapshotKeyRef.current = currentKey;
  }, [normalizedSnapshot]);

  useEffect(() => {
    function restoreSnapshot(snapshot: MobileHistorySnapshot) {
      const controller = optionsRef.current;
      const currentOverlay = currentSnapshotRef.current.overlay;

      if (currentOverlay && currentOverlay !== snapshot.overlay) {
        if (currentOverlay === 'settings') controller.onCloseSettings();
        else controller.onCloseCreateServer();
      }

      if (snapshot.workspace === 'server' && snapshot.serverId) {
        const membership = controller.serverMemberships.find(
          (item) => item.serverId === snapshot.serverId
        );
        if (membership) {
          controller.onOpenServer(membership);
        }
      } else if (
        snapshot.workspace === 'private-space' &&
        snapshot.privateSpaceId
      ) {
        controller.onOpenPrivateSpace(snapshot.privateSpaceId);
      } else if (snapshot.tab === 'servers') {
        controller.onOpenServers();
      } else if (snapshot.tab === 'messages') {
        controller.onOpenMessages();
      } else if (snapshot.tab === 'menu') {
        controller.onOpenMenu();
      } else {
        controller.onOpenProfile();
      }

      if (snapshot.overlay && snapshot.overlay !== currentOverlay) {
        if (snapshot.overlay === 'settings') controller.onOpenSettings();
        else controller.onOpenCreateServer();
      }
    }

    function handlePopState(event: PopStateEvent) {
      if (!window.matchMedia('(max-width: 760px)').matches) return;

      const targetSnapshot = readSnapshot(event.state);
      if (!targetSnapshot) {
        const currentSnapshot = currentSnapshotRef.current;
        window.history.pushState(
          {
            ...stateRecord(event.state),
            [mobileHistoryRootMarker]: false,
            [mobileHistoryMarker]: currentSnapshot
          },
          ''
        );
        lastSnapshotKeyRef.current = snapshotKey(currentSnapshot);
        return;
      }

      const normalizedTarget = normalizeSnapshot(targetSnapshot);
      const targetKey = snapshotKey(normalizedTarget);
      suppressedSnapshotKeyRef.current = targetKey;
      lastSnapshotKeyRef.current = targetKey;
      restoreSnapshot(normalizedTarget);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}
