import { useMemo, useState } from 'react';

import type { ServerMemberResponse } from '../../../../shared/types';
import {
  SystemButton,
  SystemSearchInput,
  SystemSelect,
  SystemTabPanel,
  SystemTabs,
  serverCopy,
  useSystemSkeletonPresence
} from '../../../shared';
import { useServerDirectory } from '../../hooks/workspace/useServerDirectory';
import { ServerDirectoryCard } from './ServerDirectoryCard';
import { ServerDirectoryGridSkeleton } from './ServerDirectoryGridSkeleton';
import {
  type ServerDirectorySort,
  type ServerDirectoryTab,
  getServerDirectoryVisibility,
  toggleExpandedServer
} from './serverDirectoryModel';

import styles from './ServersBrowser.module.css';

type ServersBrowserProps = {
  accessToken: string;
  memberships: ServerMemberResponse[];
  onCreateServer: () => void;
  onServerJoined: (membership: ServerMemberResponse) => void;
  onOpenServer: (membership: ServerMemberResponse) => void;
};

export function ServersBrowser({
  accessToken,
  memberships,
  onCreateServer,
  onServerJoined,
  onOpenServer
}: ServersBrowserProps) {
  const [activeTab, setActiveTab] = useState<ServerDirectoryTab>('mine');
  const visibility = getServerDirectoryVisibility(activeTab);
  const {
    hasError,
    hasLoaded,
    isLoading,
    query,
    refresh,
    servers,
    sort,
    setQuery,
    setSort,
    cancelJoinRequest,
    isServerMutationPending,
    joinServer
  } = useServerDirectory(accessToken, visibility);
  const [accessErrors, setAccessErrors] = useState<Record<string, string>>({});
  const [expandedServerIds, setExpandedServerIds] = useState<Set<string>>(
    () => new Set()
  );
  const membershipByServerId = useMemo(
    () =>
      new Map(
        memberships.map((membership) => [membership.serverId, membership])
      ),
    [memberships]
  );

  function toggleServer(serverId: string) {
    setExpandedServerIds((current) => toggleExpandedServer(current, serverId));
  }

  function changeTab(tab: ServerDirectoryTab) {
    if (tab === activeTab) {
      return;
    }

    setActiveTab(tab);
  }

  async function submitJoin(serverId: string, errorMessage: string) {
    setServerAccessError(serverId, null);

    try {
      const response = await joinServer(serverId);

      if (response.status === 'joined' && response.membership) {
        onServerJoined(response.membership);
      }
    } catch {
      setServerAccessError(serverId, errorMessage);
    }
  }

  async function cancelPendingJoinRequest(serverId: string) {
    setServerAccessError(serverId, null);

    try {
      await cancelJoinRequest(serverId);
    } catch {
      setServerAccessError(
        serverId,
        serverCopy.browser.joinRequestCancelFailed
      );
    }
  }

  function setServerAccessError(serverId: string, message: string | null) {
    setAccessErrors((current) => {
      if (message) {
        return {
          ...current,
          [serverId]: message
        };
      }

      if (!current[serverId]) {
        return current;
      }

      const next = { ...current };
      delete next[serverId];
      return next;
    });
  }

  const isInitialLoading = isLoading && !hasLoaded;
  const initialLoadingSkeleton = useSystemSkeletonPresence(isInitialLoading);
  const statusMessage =
    hasError && servers.length > 0
      ? serverCopy.browser.loadFailed
      : isLoading && hasLoaded
        ? serverCopy.browser.loading
        : '';
  const emptyMessage =
    activeTab === 'mine'
      ? serverCopy.browser.myServersEmpty
      : serverCopy.browser.discoverServersEmpty;

  return (
    <section className={styles.serverBrowser}>
      <header className={styles.heading}>
        <h1>{serverCopy.browser.title}</h1>
        <SystemButton onClick={onCreateServer}>
          {serverCopy.browser.createServer}
        </SystemButton>
      </header>

      <SystemTabs
        className={styles.tabs}
        idBase="servers"
        label={serverCopy.browser.tabsLabel}
        onChange={changeTab}
        options={[
          {
            badge: memberships.length,
            label: serverCopy.browser.myServersTab,
            value: 'mine'
          },
          {
            label: serverCopy.browser.discoverServersTab,
            value: 'discover'
          }
        ]}
        value={activeTab}
      />

      <SystemTabPanel
        className={styles.tabPanel}
        idBase="servers"
        value={activeTab}
        aria-busy={isLoading}
      >
        {activeTab === 'discover' ? (
          <div className={styles.controls}>
            <SystemSearchInput
              name="serverDirectorySearch"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={serverCopy.browser.searchPlaceholder}
              aria-label={serverCopy.browser.searchPlaceholder}
            />
            <SystemSelect
              name="serverDirectorySort"
              value={sort}
              aria-label={serverCopy.browser.sortLabel}
              onValueChange={(value) => setSort(value as ServerDirectorySort)}
            >
              <option value="active">{serverCopy.browser.sortActive}</option>
              <option value="members">{serverCopy.browser.sortMembers}</option>
              <option value="name">{serverCopy.browser.sortTitle}</option>
            </SystemSelect>
          </div>
        ) : null}

        <div
          className={styles.status}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {statusMessage}
        </div>

        {initialLoadingSkeleton.isMounted ? (
          <ServerDirectoryGridSkeleton
            label={serverCopy.browser.loading}
            presencePhase={initialLoadingSkeleton.phase}
          />
        ) : hasError && servers.length === 0 ? (
          <div className={styles.emptyState}>
            <p>{serverCopy.browser.loadFailed}</p>
            <SystemButton size="small" variant="ghost" onClick={refresh}>
              {serverCopy.browser.retry}
            </SystemButton>
          </div>
        ) : servers.length === 0 ? (
          <div className={styles.emptyState}>
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div
            className={`${styles.grid} ${isLoading ? styles.gridLoading : ''}`}
          >
            {servers.map((discovery) => {
              const serverId = discovery.server.id;
              const isExpanded = expandedServerIds.has(serverId);

              return (
                <ServerDirectoryCard
                  key={serverId}
                  discovery={discovery}
                  isExpanded={isExpanded}
                  membership={membershipByServerId.get(serverId) ?? null}
                  accessError={accessErrors[serverId] ?? null}
                  isAccessMutationPending={isServerMutationPending(serverId)}
                  onCancelJoinRequest={() =>
                    void cancelPendingJoinRequest(serverId)
                  }
                  onCollapse={() =>
                    setExpandedServerIds((current) => {
                      const next = new Set(current);
                      next.delete(serverId);
                      return next;
                    })
                  }
                  onJoin={() =>
                    void submitJoin(serverId, serverCopy.browser.joinFailed)
                  }
                  onOpen={onOpenServer}
                  onRequestJoin={() =>
                    void submitJoin(
                      serverId,
                      serverCopy.browser.joinRequestFailed
                    )
                  }
                  onToggle={() => toggleServer(serverId)}
                />
              );
            })}
          </div>
        )}
      </SystemTabPanel>
    </section>
  );
}
