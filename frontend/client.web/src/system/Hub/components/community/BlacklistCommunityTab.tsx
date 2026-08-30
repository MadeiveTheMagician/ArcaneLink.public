import { type UIEvent, useMemo, useState } from 'react';

import type {
  DirectMessageBlockedUserResponse,
  FriendUserResponse
} from '../../../../shared/types';
import {
  SystemSkeleton,
  type SystemSkeletonPresencePhase,
  SystemSkeletonRegion,
  UserBlockDialog,
  type UserBlockDialogTarget,
  useSystemSkeletonPresence
} from '../../../shared';
import { settingsCopy } from '../../../shared/copy';
import { useDirectMessageBlocklist } from './useDirectMessageBlocklist';

import styles from './BlacklistCommunityTab.module.css';

type BlacklistCommunityTabProps = {
  accessToken: string;
};

export function BlacklistCommunityTab({
  accessToken
}: BlacklistCommunityTabProps) {
  const blocklist = useDirectMessageBlocklist(accessToken);
  const [dialogTarget, setDialogTarget] =
    useState<UserBlockDialogTarget | null>(null);
  const normalizedQuery = blocklist.searchQuery.trim().toLowerCase();
  const visibleBlockedUsers = useMemo(
    () =>
      normalizedQuery.length < 2
        ? blocklist.blockedUsers
        : blocklist.blockedUsers.filter((user) =>
            matchesUserQuery(user, normalizedQuery)
          ),
    [blocklist.blockedUsers, normalizedQuery]
  );
  const visibleSearchResults = useMemo(
    () =>
      blocklist.searchResults.filter(
        (user) => !blocklist.blockedUserIds.has(user.id)
      ),
    [blocklist.blockedUserIds, blocklist.searchResults]
  );
  const showBlocklistSkeleton =
    blocklist.isLoading && blocklist.blockedUsers.length === 0;
  const blocklistSkeleton = useSystemSkeletonPresence(showBlocklistSkeleton);

  function loadMoreNearListEnd(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight * 0.85) {
      void blocklist.loadMoreBlockedUsers();
    }
  }

  return (
    <div className={styles.layout}>
      <section className={styles.surface}>
        <header className={styles.heading}>
          <div>
            <h2>{settingsCopy.privacy.blocklistTitle}</h2>
            <p>{settingsCopy.privacy.blocklistDescription}</p>
          </div>
          <span className={styles.totalCount}>{blocklist.totalCount}</span>
        </header>

        <label className={styles.search}>
          <span>{settingsCopy.privacy.blocklistSearchLabel}</span>
          <input
            name="communityBlocklistSearch"
            type="search"
            value={blocklist.searchQuery}
            placeholder={settingsCopy.privacy.blocklistSearchPlaceholder}
            onChange={(event) => blocklist.setSearchQuery(event.target.value)}
          />
        </label>

        <div className={styles.searchResults}>
          {normalizedQuery.length === 1 && (
            <p className={styles.statusText}>
              {settingsCopy.privacy.blocklistSearchHint}
            </p>
          )}
          {blocklist.isSearching && (
            <p className={styles.statusText}>
              {settingsCopy.privacy.blocklistSearching}
            </p>
          )}
          {blocklist.searchError && (
            <p className={styles.error} role="alert">
              {settingsCopy.privacy.blocklistSearchError}
            </p>
          )}
          {!blocklist.isSearching &&
            !blocklist.searchError &&
            normalizedQuery.length >= 2 &&
            visibleSearchResults.length === 0 && (
              <p className={styles.statusText}>
                {settingsCopy.privacy.blocklistSearchEmpty}
              </p>
            )}
          {visibleSearchResults.length > 0 && (
            <div
              className={styles.candidateList}
              aria-label={settingsCopy.privacy.blocklistSearchResults}
            >
              {visibleSearchResults.map((user) => (
                <BlocklistUserRow
                  key={user.id}
                  user={user}
                  actionLabel={settingsCopy.privacy.blockUser}
                  isDanger
                  disabled={blocklist.mutatingUserId != null}
                  onAction={() =>
                    setDialogTarget({
                      userId: user.id,
                      displayName: user.displayName,
                      login: user.login
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={`${styles.surface} ${styles.blockedSurface}`}>
        <header className={styles.listHeading}>
          <div>
            <h2>{settingsCopy.privacy.blocklistUsers}</h2>
            <p>{settingsCopy.privacy.blocklistCommentsDescription}</p>
          </div>
        </header>

        {blocklistSkeleton.isMounted && (
          <BlocklistSkeleton presencePhase={blocklistSkeleton.phase} />
        )}
        {!blocklistSkeleton.isMounted && blocklist.loadError && (
          <div className={styles.loadError} role="alert">
            <span>{settingsCopy.privacy.blocklistLoadError}</span>
            <button
              type="button"
              onClick={() => void blocklist.loadBlockedUsers()}
            >
              {settingsCopy.privacy.blocklistRetry}
            </button>
          </div>
        )}
        {!blocklistSkeleton.isMounted &&
          !blocklist.loadError &&
          blocklist.blockedUsers.length === 0 && (
            <p className={styles.empty}>
              {settingsCopy.privacy.blocklistEmpty}
            </p>
          )}
        {!blocklistSkeleton.isMounted &&
          blocklist.blockedUsers.length > 0 &&
          visibleBlockedUsers.length === 0 && (
            <p className={styles.empty}>
              {settingsCopy.privacy.blocklistFilteredEmpty}
            </p>
          )}
        {!blocklistSkeleton.isMounted && visibleBlockedUsers.length > 0 && (
          <div
            className={styles.blockedList}
            aria-label={settingsCopy.privacy.blocklistUsers}
            onScroll={loadMoreNearListEnd}
          >
            {visibleBlockedUsers.map((user) => (
              <BlocklistUserRow
                key={user.userId}
                user={user}
                comment={user.comment}
                actionLabel={settingsCopy.privacy.unblockUser}
                disabled={blocklist.mutatingUserId != null}
                onAction={() => void blocklist.unblockUser(user.userId)}
              />
            ))}
            {blocklist.isLoadingMore && (
              <span className={styles.loadingMore}>
                {settingsCopy.privacy.blocklistLoadingMore}
              </span>
            )}
          </div>
        )}
        {blocklist.mutationError && (
          <p className={styles.error} role="alert">
            {settingsCopy.privacy.blocklistMutationError}
          </p>
        )}
      </section>

      {dialogTarget && (
        <UserBlockDialog
          target={dialogTarget}
          isSubmitting={blocklist.mutatingUserId === dialogTarget.userId}
          onClose={() => setDialogTarget(null)}
          onConfirm={async (comment) => {
            await blocklist.blockUser(dialogTarget.userId, comment);
            setDialogTarget(null);
          }}
        />
      )}
    </div>
  );
}

type BlocklistUser = Pick<
  FriendUserResponse,
  | 'login'
  | 'displayName'
  | 'avatarAssetId'
  | 'avatarCropOffsetX'
  | 'avatarCropOffsetY'
  | 'avatarCropZoom'
>;

function BlocklistUserRow({
  user,
  comment = null,
  actionLabel,
  disabled,
  isDanger = false,
  onAction
}: {
  user: BlocklistUser;
  comment?: string | null;
  actionLabel: string;
  disabled: boolean;
  isDanger?: boolean;
  onAction: () => void;
}) {
  return (
    <article className={styles.userRow}>
      <span className={`${styles.avatar} ui-frame`} aria-hidden="true">
        {user.avatarAssetId ? (
          <img
            className="ui-media-fit"
            src={`/api/assets/${user.avatarAssetId}/content`}
            alt=""
            style={{
              transform: `translate(${user.avatarCropOffsetX * 100}%, ${
                user.avatarCropOffsetY * 100
              }%) scale(${user.avatarCropZoom})`
            }}
          />
        ) : (
          user.displayName.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className={styles.userIdentity}>
        <strong>{user.displayName}</strong>
        <small>@{user.login}</small>
        {comment && (
          <span className={styles.comment} title={comment}>
            {comment}
          </span>
        )}
      </span>
      <button
        className={isDanger ? styles.blockAction : styles.unblockAction}
        type="button"
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </article>
  );
}

function BlocklistSkeleton({
  presencePhase
}: {
  presencePhase: SystemSkeletonPresencePhase;
}) {
  return (
    <SystemSkeletonRegion
      className={styles.skeletonList}
      label={settingsCopy.privacy.blocklistLoading}
      presencePhase={presencePhase}
    >
      {[0, 1, 2].map((index) => (
        <div className={styles.skeletonRow} key={index}>
          <SystemSkeleton variant="circle" size={44} />
          <div>
            <SystemSkeleton width="44%" />
            <SystemSkeleton width="28%" />
          </div>
          <SystemSkeleton variant="button" width={112} />
        </div>
      ))}
    </SystemSkeletonRegion>
  );
}

function matchesUserQuery(
  user: DirectMessageBlockedUserResponse,
  normalizedQuery: string
) {
  return (
    user.displayName.toLowerCase().includes(normalizedQuery) ||
    user.login.toLowerCase().includes(normalizedQuery) ||
    user.comment?.toLowerCase().includes(normalizedQuery) === true
  );
}
