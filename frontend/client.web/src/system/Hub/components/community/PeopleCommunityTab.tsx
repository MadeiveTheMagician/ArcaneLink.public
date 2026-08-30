import { useCallback, useId, useRef, useState } from 'react';

import type {
  FriendRequestResponse,
  FriendUserResponse,
  ProfileTagResponse
} from '../../../../shared/types';
import {
  SystemIcon,
  communityCopy,
  useDismissableLayer,
  useSystemSkeletonPresence
} from '../../../shared';
import {
  CommunityPersonListSkeleton,
  CommunityRequestListSkeleton
} from './CommunitySkeletons';
import {
  CommunityFilterCard,
  CommunityIcon,
  CommunityRequestsPanel,
  CommunitySection,
  CommunityUserAvatar,
  CommunityUserName
} from './CommunityViewParts';
import {
  formatCommunityPresence,
  uniqueCommunityUsers
} from './communityFilters';
import {
  type CommunityPeopleScope,
  type CommunityPeopleSort,
  communityRequestPreviewLimit
} from './communityTypes';

import cardStyles from './CommunityCards.module.css';
import controlStyles from './CommunityControls.module.css';
import styles from './CommunityView.module.css';

type PeopleCommunityTabProps = {
  discoveredPeople: FriendUserResponse[];
  friendSearchQuery: string;
  friendUserIds: Set<string>;
  incomingFriendRequests: FriendRequestResponse[];
  isDiscoveringPeople: boolean;
  isMutatingFriends: boolean;
  isSearchingUsers: boolean;
  outgoingFriendRequests: FriendRequestResponse[];
  pendingOutgoingUserIds: Set<string>;
  peopleOnlineOnly: boolean;
  peopleScope: CommunityPeopleScope;
  peopleSort: CommunityPeopleSort;
  profileTags: ProfileTagResponse[];
  selectedTagIds: string[];
  onAcceptFriendRequest: (requestId: string) => void;
  onFriendSearchQueryChange: (query: string) => void;
  onPeopleOnlineToggle: () => void;
  onPeopleScopeChange: (scope: CommunityPeopleScope) => void;
  onPeopleSortChange: (sort: CommunityPeopleSort) => void;
  onSendFriendRequest: (userId: string) => void;
  onToggleTag: (tagId: string) => void;
};

export function PeopleCommunityTab({
  discoveredPeople,
  friendSearchQuery,
  friendUserIds,
  incomingFriendRequests,
  isDiscoveringPeople,
  isMutatingFriends,
  isSearchingUsers,
  outgoingFriendRequests,
  pendingOutgoingUserIds,
  peopleOnlineOnly,
  peopleScope,
  peopleSort,
  profileTags,
  selectedTagIds,
  onAcceptFriendRequest,
  onFriendSearchQueryChange,
  onPeopleOnlineToggle,
  onPeopleScopeChange,
  onPeopleSortChange,
  onSendFriendRequest,
  onToggleTag
}: PeopleCommunityTabProps) {
  const [isPeopleFilterPanelOpen, setIsPeopleFilterPanelOpen] = useState(false);
  const peopleFilterPanelId = useId();
  const peopleFilterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const peopleFilterPanelRef = useRef<HTMLElement | null>(null);
  const closePeopleFilterPanel = useCallback(
    () => setIsPeopleFilterPanelOpen(false),
    []
  );

  useDismissableLayer({
    isOpen: isPeopleFilterPanelOpen,
    layerRef: peopleFilterPanelRef,
    triggerRef: peopleFilterTriggerRef,
    onDismiss: closePeopleFilterPanel
  });
  const visiblePeopleResults = friendSearchQuery.trim().length >= 2;
  const incomingRequestByUserId = new Map(
    incomingFriendRequests.map((request) => [request.fromUserId, request])
  );
  const outgoingRequestByUserId = new Map(
    outgoingFriendRequests.map((request) => [request.toUserId, request])
  );
  const visiblePeople = discoveredPeople.filter(
    (user) => !friendUserIds.has(user.id)
  );
  const recommendedPeople = uniqueCommunityUsers(discoveredPeople)
    .filter((user) => !friendUserIds.has(user.id))
    .filter((user) => !pendingOutgoingUserIds.has(user.id))
    .slice(0, 6);
  const isLoadingPeople = isSearchingUsers || isDiscoveringPeople;
  const showPeopleSkeleton = isLoadingPeople && visiblePeople.length === 0;
  const showRecommendationsSkeleton =
    isLoadingPeople && recommendedPeople.length === 0;
  const peopleSkeleton = useSystemSkeletonPresence(showPeopleSkeleton);
  const recommendationsSkeleton = useSystemSkeletonPresence(
    showRecommendationsSkeleton
  );

  return (
    <div className={styles.communityLayout}>
      <main className={styles.communityMain}>
        <label className={controlStyles.communitySearch}>
          <CommunityIcon name="search" />
          <input
            name="communityPeopleSearch"
            value={friendSearchQuery}
            onChange={(event) => onFriendSearchQueryChange(event.target.value)}
            placeholder={communityCopy.people.searchPlaceholder}
          />
        </label>

        <div
          className={controlStyles.communityFilters}
          aria-label={communityCopy.search.searchFilters}
        >
          <button
            className={
              peopleScope === 'all' ? controlStyles.activeCommunityFilter : ''
            }
            type="button"
            onClick={() => onPeopleScopeChange('all')}
          >
            {communityCopy.filters.all}
          </button>
          <button
            className={
              peopleScope === 'shared-servers'
                ? controlStyles.activeCommunityFilter
                : ''
            }
            type="button"
            onClick={() => onPeopleScopeChange('shared-servers')}
          >
            {communityCopy.filters.sharedServers}
          </button>
          <button
            className={
              peopleOnlineOnly ? controlStyles.activeCommunityFilter : ''
            }
            type="button"
            onClick={onPeopleOnlineToggle}
          >
            {communityCopy.filters.online}
          </button>
          <button
            className={
              peopleSort === 'recommended'
                ? controlStyles.activeCommunityFilter
                : ''
            }
            type="button"
            onClick={() => onPeopleSortChange('recommended')}
          >
            {communityCopy.filters.firstRecommended}
          </button>
          <button
            className={
              peopleSort === 'recent' ? controlStyles.activeCommunityFilter : ''
            }
            type="button"
            onClick={() => onPeopleSortChange('recent')}
          >
            {communityCopy.filters.firstRecent}
          </button>
          <button
            ref={peopleFilterTriggerRef}
            className={controlStyles.communityFilterAssetButton}
            type="button"
            aria-label={communityCopy.search.peopleFilters}
            aria-controls={peopleFilterPanelId}
            aria-expanded={isPeopleFilterPanelOpen}
            aria-haspopup="dialog"
            onClick={() => setIsPeopleFilterPanelOpen((isOpen) => !isOpen)}
          >
            <CommunityIcon name="sliders" />
          </button>
          {isPeopleFilterPanelOpen && (
            <CommunityFilterCard
              id={peopleFilterPanelId}
              rootRef={peopleFilterPanelRef}
              selectedTagIds={selectedTagIds}
              tags={profileTags}
              onClose={closePeopleFilterPanel}
              onToggleTag={onToggleTag}
            />
          )}
        </div>

        <CommunitySection
          title={
            visiblePeopleResults
              ? `${communityCopy.people.foundPrefix}: ${visiblePeople.length}`
              : communityCopy.labels.sharedPeople
          }
        >
          {peopleSkeleton.isMounted && (
            <CommunityPersonListSkeleton
              label={communityCopy.people.loading}
              presencePhase={peopleSkeleton.phase}
              withPrimaryAction
            />
          )}
          {!peopleSkeleton.isMounted &&
            !isSearchingUsers &&
            !isDiscoveringPeople &&
            visiblePeopleResults &&
            visiblePeople.length === 0 && <p>{communityCopy.people.empty}</p>}
          {!peopleSkeleton.isMounted &&
            !isSearchingUsers &&
            !isDiscoveringPeople &&
            !visiblePeopleResults &&
            visiblePeople.length === 0 && (
              <p>{communityCopy.people.defaultEmpty}</p>
            )}
          {!peopleSkeleton.isMounted &&
            visiblePeople.map((user) => {
              const isFriend = friendUserIds.has(user.id);
              const incomingRequest = incomingRequestByUserId.get(user.id);
              const outgoingRequest = outgoingRequestByUserId.get(user.id);
              const isPending = pendingOutgoingUserIds.has(user.id);

              return (
                <article
                  className={`${cardStyles.communityPersonCard} ${cardStyles.communitySearchPersonCard}`}
                  key={user.id}
                >
                  <CommunityUserAvatar user={user} />
                  <div className={cardStyles.communityPersonBody}>
                    <CommunityUserName user={user} />
                    <small className="ui-ellipsis">@{user.login}</small>
                  </div>
                  <span className={cardStyles.communityStatus}>
                    {user.presenceStatus === 'online'
                      ? null
                      : formatCommunityPresence(user)}
                  </span>
                  <button
                    className="ui-action-button"
                    type="button"
                    disabled={
                      isMutatingFriends ||
                      isFriend ||
                      isPending ||
                      outgoingRequest != null
                    }
                    onClick={() => {
                      if (incomingRequest) {
                        onAcceptFriendRequest(incomingRequest.id);
                        return;
                      }

                      onSendFriendRequest(user.id);
                    }}
                  >
                    {isFriend
                      ? communityCopy.states.friendState
                      : incomingRequest
                        ? communityCopy.actions.accept
                        : isPending || outgoingRequest
                          ? communityCopy.states.friendRequestSent
                          : communityCopy.actions.add}
                  </button>
                </article>
              );
            })}
        </CommunitySection>
      </main>

      <aside className={styles.communityAside}>
        <CommunityRequestsPanel
          count={recommendedPeople.length}
          isLoading={recommendationsSkeleton.isMounted}
          title={communityCopy.labels.recommendations}
        >
          {recommendationsSkeleton.isMounted && (
            <CommunityRequestListSkeleton
              count={5}
              label={communityCopy.people.loading}
              presencePhase={recommendationsSkeleton.phase}
              singleAction
            />
          )}
          {!recommendationsSkeleton.isMounted &&
            recommendedPeople.length === 0 && (
              <p>{communityCopy.labels.recommendationsEmpty}</p>
            )}
          {!recommendationsSkeleton.isMounted &&
            recommendedPeople
              .slice(0, communityRequestPreviewLimit)
              .map((user) => (
                <article
                  className={cardStyles.communityRequestCard}
                  key={user.id}
                >
                  <CommunityUserAvatar user={user} />
                  <div>
                    <CommunityUserName user={user} />
                    <small className="ui-ellipsis">@{user.login}</small>
                  </div>
                  <button
                    className="ui-action-button"
                    type="button"
                    disabled={
                      isMutatingFriends || pendingOutgoingUserIds.has(user.id)
                    }
                    onClick={() => onSendFriendRequest(user.id)}
                  >
                    <SystemIcon name="plus" size={18} />
                  </button>
                </article>
              ))}
        </CommunityRequestsPanel>

        <article className={styles.communityHintCard}>
          <h2>{communityCopy.people.searchTips}</h2>
          <p>{communityCopy.people.searchTipsText}</p>
        </article>
      </aside>
    </div>
  );
}
