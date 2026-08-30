import { useCallback, useId, useRef, useState } from 'react';

import type {
  FriendRequestResponse,
  FriendUserResponse,
  ProfileTagResponse,
  ServerMemberResponse,
  UserFriendResponse
} from '../../../../shared/types';
import type { VoiceChannelController } from '../../../Server/hooks/voice/useVoiceChannel';
import {
  communityCopy,
  useDismissableLayer,
  useSystemSkeletonPresence
} from '../../../shared';
import {
  CommunityPersonListSkeleton,
  CommunityRequestListSkeleton,
  CommunityStatsSkeleton
} from './CommunitySkeletons';
import {
  CommunityFilterCard,
  CommunityIcon,
  CommunityRequestsDialog,
  CommunityRequestsPanel,
  CommunitySection,
  CommunityUserAvatar,
  CommunityUserName
} from './CommunityViewParts';
import {
  formatCommunityPresence,
  matchesCommunityQuery,
  matchesFriendStatusFilter,
  matchesSelectedTags
} from './communityFilters';
import {
  type CommunityFriendStatusFilter,
  type CommunityRequestsDialogKind,
  communityFriendStatusLabels,
  communityFriendStatusOptions,
  communityRequestPreviewLimit
} from './communityTypes';

import cardStyles from './CommunityCards.module.css';
import controlStyles from './CommunityControls.module.css';
import styles from './CommunityView.module.css';

type FriendsCommunityTabProps = {
  friendSearchQuery: string;
  friends: UserFriendResponse[];
  incomingFriendRequests: FriendRequestResponse[];
  isLoadingFriends: boolean;
  isMutatingFriends: boolean;
  outgoingFriendRequests: FriendRequestResponse[];
  profileTags: ProfileTagResponse[];
  selectedTagIds: string[];
  visibleServerMemberships: ServerMemberResponse[];
  voice: VoiceChannelController;
  onAcceptFriendRequest: (requestId: string) => void;
  onCancelFriendRequest: (requestId: string) => void;
  onDeclineFriendRequest: (requestId: string) => void;
  onFriendSearchQueryChange: (query: string) => void;
  onOpenDirectSpace: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onStartDirectVoice: (user: FriendUserResponse) => void;
  onToggleTag: (tagId: string) => void;
};

export function FriendsCommunityTab({
  friendSearchQuery,
  friends,
  incomingFriendRequests,
  isLoadingFriends,
  isMutatingFriends,
  outgoingFriendRequests,
  profileTags,
  selectedTagIds,
  visibleServerMemberships,
  voice,
  onAcceptFriendRequest,
  onCancelFriendRequest,
  onDeclineFriendRequest,
  onFriendSearchQueryChange,
  onOpenDirectSpace,
  onRemoveFriend,
  onStartDirectVoice,
  onToggleTag
}: FriendsCommunityTabProps) {
  const [friendStatusFilter, setFriendStatusFilter] =
    useState<CommunityFriendStatusFilter>('all');
  const [isFriendStatusMenuOpen, setIsFriendStatusMenuOpen] = useState(false);
  const [isFriendFilterPanelOpen, setIsFriendFilterPanelOpen] = useState(false);
  const [requestsDialog, setRequestsDialog] =
    useState<CommunityRequestsDialogKind | null>(null);
  const [activeFriendMenuUserId, setActiveFriendMenuUserId] = useState<
    string | null
  >(null);
  const friendStatusMenuId = useId();
  const friendFilterPanelId = useId();
  const friendStatusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const friendStatusMenuRef = useRef<HTMLDivElement | null>(null);
  const friendFilterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const friendFilterPanelRef = useRef<HTMLElement | null>(null);
  const closeFriendStatusMenu = useCallback(
    () => setIsFriendStatusMenuOpen(false),
    []
  );
  const closeFriendFilterPanel = useCallback(
    () => setIsFriendFilterPanelOpen(false),
    []
  );

  useDismissableLayer({
    isOpen: isFriendStatusMenuOpen,
    layerRef: friendStatusMenuRef,
    triggerRef: friendStatusTriggerRef,
    onDismiss: closeFriendStatusMenu
  });
  useDismissableLayer({
    isOpen: isFriendFilterPanelOpen,
    layerRef: friendFilterPanelRef,
    triggerRef: friendFilterTriggerRef,
    onDismiss: closeFriendFilterPanel
  });
  const onlineFriends = friends.filter(
    (friend) => friend.friend.presenceStatus === 'online'
  );
  const filteredFriends = friends.filter(
    (friend) =>
      matchesCommunityQuery(friend.friend, friendSearchQuery) &&
      matchesFriendStatusFilter(friend.friend, friendStatusFilter) &&
      matchesSelectedTags(friend.friend, selectedTagIds)
  );
  const visibleIncomingRequests = incomingFriendRequests.slice(
    0,
    communityRequestPreviewLimit
  );
  const visibleOutgoingRequests = outgoingFriendRequests.slice(
    0,
    communityRequestPreviewLimit
  );
  const sharedServerCount = visibleServerMemberships.length;
  const sharedServerTitle =
    visibleServerMemberships[0]?.server.title ?? 'Arcane Link';
  const voiceParticipantCount = Object.values(
    voice.participantsBySpaceId
  ).reduce((total, participants) => total + participants.length, 0);
  const showFriendsSkeleton = isLoadingFriends && friends.length === 0;
  const showIncomingRequestsSkeleton =
    isLoadingFriends && incomingFriendRequests.length === 0;
  const showOutgoingRequestsSkeleton =
    isLoadingFriends && outgoingFriendRequests.length === 0;
  const friendsSkeleton = useSystemSkeletonPresence(showFriendsSkeleton);
  const incomingRequestsSkeleton = useSystemSkeletonPresence(
    showIncomingRequestsSkeleton
  );
  const outgoingRequestsSkeleton = useSystemSkeletonPresence(
    showOutgoingRequestsSkeleton
  );

  return (
    <>
      <div className={styles.communityLayout}>
        <main className={styles.communityMain}>
          {friendsSkeleton.isMounted ? (
            <CommunityStatsSkeleton
              label={communityCopy.states.friendsLoading}
              presencePhase={friendsSkeleton.phase}
            />
          ) : (
            <div className={styles.communityStats}>
              <article>
                <span className={styles.communityStatIcon} aria-hidden="true">
                  <CommunityIcon name="friends" />
                </span>
                <div>
                  <strong>{friends.length}</strong>
                  <span>{communityCopy.labels.friends}</span>
                </div>
              </article>
              <article>
                <span
                  className={`${styles.communityStatIcon} ${styles.communityStatOnline}`}
                  aria-hidden="true"
                >
                  <CommunityIcon name="online" />
                </span>
                <div>
                  <strong>{onlineFriends.length}</strong>
                  <span>{communityCopy.labels.online}</span>
                </div>
              </article>
              <article>
                <span
                  className={`${styles.communityStatIcon} ${styles.communityStatVoice}`}
                  aria-hidden="true"
                >
                  <CommunityIcon name="voice" />
                </span>
                <div>
                  <strong>{voiceParticipantCount}</strong>
                  <span>{communityCopy.labels.inVoice}</span>
                </div>
              </article>
              <article>
                <span
                  className={`${styles.communityStatIcon} ${styles.communityStatServer}`}
                  aria-hidden="true"
                >
                  <CommunityIcon name="server" />
                </span>
                <div>
                  <strong>{sharedServerCount}</strong>
                  <span>{communityCopy.labels.commonServer}</span>
                </div>
              </article>
            </div>
          )}

          <div className={controlStyles.communityFriendToolbar}>
            <label className={controlStyles.communitySearch}>
              <CommunityIcon name="search" />
              <input
                name="communityFriendSearch"
                value={friendSearchQuery}
                onChange={(event) =>
                  onFriendSearchQueryChange(event.target.value)
                }
                placeholder={communityCopy.search.friendPlaceholder}
              />
            </label>
            <button
              ref={friendStatusTriggerRef}
              className={controlStyles.communitySelectLike}
              type="button"
              aria-controls={friendStatusMenuId}
              aria-expanded={isFriendStatusMenuOpen}
              aria-haspopup="menu"
              onClick={() => setIsFriendStatusMenuOpen((isOpen) => !isOpen)}
            >
              {communityFriendStatusLabels[friendStatusFilter]}
              <CommunityIcon name="chevronDown" />
            </button>
            {isFriendStatusMenuOpen && (
              <div
                ref={friendStatusMenuRef}
                id={friendStatusMenuId}
                className={controlStyles.communityStatusMenu}
                role="menu"
              >
                {communityFriendStatusOptions.map((option) => (
                  <button
                    className={
                      friendStatusFilter === option
                        ? controlStyles.activeCommunityMenuItem
                        : ''
                    }
                    key={option}
                    type="button"
                    aria-checked={friendStatusFilter === option}
                    role="menuitemradio"
                    onClick={() => {
                      setFriendStatusFilter(option);
                      closeFriendStatusMenu();
                    }}
                  >
                    {communityFriendStatusLabels[option]}
                  </button>
                ))}
              </div>
            )}
            <button
              ref={friendFilterTriggerRef}
              className={controlStyles.communityIconButton}
              type="button"
              aria-label={communityCopy.actions.filters}
              aria-controls={friendFilterPanelId}
              aria-expanded={isFriendFilterPanelOpen}
              aria-haspopup="dialog"
              onClick={() => setIsFriendFilterPanelOpen((isOpen) => !isOpen)}
            >
              <CommunityIcon name="sliders" />
            </button>
            {isFriendFilterPanelOpen && (
              <CommunityFilterCard
                id={friendFilterPanelId}
                rootRef={friendFilterPanelRef}
                selectedTagIds={selectedTagIds}
                tags={profileTags}
                onClose={closeFriendFilterPanel}
                onToggleTag={onToggleTag}
              />
            )}
          </div>

          <CommunitySection title={communityCopy.labels.friendsList}>
            {friendsSkeleton.isMounted && (
              <CommunityPersonListSkeleton
                label={communityCopy.states.friendsLoading}
                presencePhase={friendsSkeleton.phase}
              />
            )}
            {!friendsSkeleton.isMounted &&
              !isLoadingFriends &&
              filteredFriends.length === 0 && (
                <p>{communityCopy.states.friendsEmpty}</p>
              )}
            {!friendsSkeleton.isMounted &&
              filteredFriends.map((friend) => (
                <article
                  className={cardStyles.communityPersonCard}
                  key={friend.friendUserId}
                >
                  <CommunityUserAvatar user={friend.friend} />
                  <div className={cardStyles.communityPersonBody}>
                    <CommunityUserName user={friend.friend} />
                    <small className="ui-ellipsis">
                      @{friend.friend.login}
                    </small>
                  </div>
                  <span className={cardStyles.communityStatus}>
                    {friend.friend.presenceStatus === 'online'
                      ? null
                      : formatCommunityPresence(friend.friend)}
                  </span>
                  <span className={cardStyles.communitySharedServer}>
                    {communityCopy.labels.commonServer}: {sharedServerTitle}
                  </span>
                  <div className={cardStyles.communityFriendActions}>
                    <button
                      type="button"
                      aria-label={communityCopy.actions.message}
                      onClick={() => onOpenDirectSpace(friend.friendUserId)}
                    >
                      <CommunityIcon name="message" />
                    </button>
                    <button
                      type="button"
                      aria-label={communityCopy.actions.call}
                      onClick={() => onStartDirectVoice(friend.friend)}
                    >
                      <CommunityIcon name="phone" />
                    </button>
                    <button
                      type="button"
                      disabled={isMutatingFriends}
                      aria-expanded={
                        activeFriendMenuUserId === friend.friendUserId
                      }
                      aria-label={communityCopy.actions.moreFriendActions}
                      onClick={() =>
                        setActiveFriendMenuUserId((current) =>
                          current === friend.friendUserId
                            ? null
                            : friend.friendUserId
                        )
                      }
                    >
                      <CommunityIcon name="more" />
                    </button>
                    {activeFriendMenuUserId === friend.friendUserId && (
                      <div className={controlStyles.communityFriendMenu}>
                        <button
                          type="button"
                          onClick={() => {
                            const isConfirmed = window.confirm(
                              communityCopy.states.friendConfirmRemove(
                                friend.friend.displayName
                              )
                            );

                            if (!isConfirmed) {
                              return;
                            }

                            setActiveFriendMenuUserId(null);
                            onRemoveFriend(friend.friendUserId);
                          }}
                        >
                          {communityCopy.actions.deleteFriend}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
          </CommunitySection>
        </main>

        <aside className={styles.communityAside}>
          <CommunityRequestsPanel
            count={incomingFriendRequests.length}
            isLoading={incomingRequestsSkeleton.isMounted}
            title={communityCopy.requests.incoming}
            action={
              incomingFriendRequests.length > communityRequestPreviewLimit ? (
                <button
                  className={styles.communityPanelAction}
                  type="button"
                  onClick={() => setRequestsDialog('incoming')}
                >
                  {communityCopy.actions.showAll}
                </button>
              ) : null
            }
          >
            {incomingRequestsSkeleton.isMounted && (
              <CommunityRequestListSkeleton
                count={5}
                label={communityCopy.states.friendsLoading}
                presencePhase={incomingRequestsSkeleton.phase}
              />
            )}
            {!incomingRequestsSkeleton.isMounted &&
              incomingFriendRequests.length === 0 && (
                <p>{communityCopy.requests.noIncoming}</p>
              )}
            {!incomingRequestsSkeleton.isMounted &&
              visibleIncomingRequests.map((request) => (
                <article
                  className={cardStyles.communityRequestCard}
                  key={request.id}
                >
                  <CommunityUserAvatar user={request.fromUser} />
                  <div>
                    <CommunityUserName user={request.fromUser} />
                    <small className="ui-ellipsis">
                      @{request.fromUser.login}
                    </small>
                  </div>
                  <div className={cardStyles.communityRequestActions}>
                    <button
                      type="button"
                      disabled={isMutatingFriends}
                      aria-label={communityCopy.search.requestAccept}
                      onClick={() => onAcceptFriendRequest(request.id)}
                    >
                      <CommunityIcon name="check" />
                    </button>
                    <button
                      type="button"
                      disabled={isMutatingFriends}
                      aria-label={communityCopy.search.requestDecline}
                      onClick={() => onDeclineFriendRequest(request.id)}
                    >
                      <CommunityIcon name="close" />
                    </button>
                  </div>
                </article>
              ))}
          </CommunityRequestsPanel>

          <CommunityRequestsPanel
            count={outgoingFriendRequests.length}
            isLoading={outgoingRequestsSkeleton.isMounted}
            title={communityCopy.requests.outgoing}
            action={
              outgoingFriendRequests.length > communityRequestPreviewLimit ? (
                <button
                  className={styles.communityPanelAction}
                  type="button"
                  onClick={() => setRequestsDialog('outgoing')}
                >
                  {communityCopy.actions.showAll}
                </button>
              ) : null
            }
          >
            {outgoingRequestsSkeleton.isMounted && (
              <CommunityRequestListSkeleton
                count={5}
                label={communityCopy.states.friendsLoading}
                presencePhase={outgoingRequestsSkeleton.phase}
                singleAction
              />
            )}
            {!outgoingRequestsSkeleton.isMounted &&
              outgoingFriendRequests.length === 0 && (
                <p>{communityCopy.requests.noOutgoing}</p>
              )}
            {!outgoingRequestsSkeleton.isMounted &&
              visibleOutgoingRequests.map((request) => (
                <article
                  className={cardStyles.communityRequestCard}
                  key={request.id}
                >
                  <CommunityUserAvatar user={request.toUser} />
                  <div>
                    <CommunityUserName user={request.toUser} />
                    <small className="ui-ellipsis">
                      @{request.toUser.login}
                    </small>
                  </div>
                  <div className={cardStyles.communityRequestActions}>
                    <button
                      className={cardStyles.communityCancelButton}
                      type="button"
                      disabled={isMutatingFriends}
                      onClick={() => onCancelFriendRequest(request.id)}
                    >
                      {communityCopy.actions.cancel}
                    </button>
                  </div>
                </article>
              ))}
          </CommunityRequestsPanel>
        </aside>
      </div>
      {requestsDialog && (
        <CommunityRequestsDialog
          kind={requestsDialog}
          incomingRequests={incomingFriendRequests}
          outgoingRequests={outgoingFriendRequests}
          isMutatingFriends={isMutatingFriends}
          onAcceptFriendRequest={onAcceptFriendRequest}
          onCancelFriendRequest={onCancelFriendRequest}
          onClose={() => setRequestsDialog(null)}
          onDeclineFriendRequest={onDeclineFriendRequest}
        />
      )}
    </>
  );
}
