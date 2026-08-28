import { type ReactNode, type Ref, useState } from 'react';

import type {
  FriendRequestResponse,
  FriendUserResponse,
  ProfileTagResponse
} from '../../../../shared/types';
import {
  PresenceName,
  SystemIcon,
  SystemSkeleton,
  communityCopy
} from '../../../shared';
import type { SystemIconName } from '../../../shared';
import type {
  CommunityRequestFilter,
  CommunityRequestSort,
  CommunityRequestsDialogKind
} from './communityTypes';

import cardStyles from './CommunityCards.module.css';
import controlStyles from './CommunityControls.module.css';
import primitiveStyles from './CommunityPrimitives.module.css';
import dialogStyles from './CommunityRequestsDialog.module.css';
import styles from './CommunityView.module.css';

export function CommunitySection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className={primitiveStyles.communitySection}>
      <h2>{title}</h2>
      <div className={primitiveStyles.communityList}>{children}</div>
    </section>
  );
}

export function CommunityRequestsPanel({
  action,
  children,
  count,
  isLoading = false,
  title
}: {
  action?: ReactNode;
  children: ReactNode;
  count: number;
  isLoading?: boolean;
  title: string;
}) {
  return (
    <section className={primitiveStyles.communityPanel}>
      <header className={primitiveStyles.communityPanelHeader}>
        <h2>{title}</h2>
        <span>
          {isLoading ? (
            <SystemSkeleton delayMs={120} height={16} width={20} />
          ) : (
            count
          )}
        </span>
      </header>
      <div className={primitiveStyles.communityList}>{children}</div>
      {action}
    </section>
  );
}

export function CommunityFilterCard({
  id,
  onClose,
  onToggleTag,
  rootRef,
  selectedTagIds,
  tags
}: {
  id?: string;
  onClose: () => void;
  onToggleTag: (tagId: string) => void;
  rootRef?: Ref<HTMLElement>;
  selectedTagIds: string[];
  tags: ProfileTagResponse[];
}) {
  return (
    <section
      ref={rootRef}
      id={id}
      className={controlStyles.communityFilterCard}
      aria-label={communityCopy.actions.filters}
      role="dialog"
    >
      <header>
        <h2>{communityCopy.filters.tags}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={communityCopy.actions.closeFilters}
        >
          <CommunityIcon name="close" />
        </button>
      </header>
      <div className={controlStyles.communityTagGrid}>
        {tags.length === 0 && <span>{communityCopy.states.tagsEmpty}</span>}
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);

          return (
            <button
              className={isSelected ? controlStyles.activeCommunityFilter : ''}
              key={tag.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggleTag(tag.id)}
            >
              {tag.title}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function CommunityRequestsDialog({
  incomingRequests,
  isMutatingFriends,
  kind,
  outgoingRequests,
  onAcceptFriendRequest,
  onCancelFriendRequest,
  onClose,
  onDeclineFriendRequest
}: {
  incomingRequests: FriendRequestResponse[];
  isMutatingFriends: boolean;
  kind: CommunityRequestsDialogKind;
  outgoingRequests: FriendRequestResponse[];
  onAcceptFriendRequest: (requestId: string) => void;
  onCancelFriendRequest: (requestId: string) => void;
  onClose: () => void;
  onDeclineFriendRequest: (requestId: string) => void;
}) {
  const [requestFilter, setRequestFilter] =
    useState<CommunityRequestFilter>('all');
  const [requestSort, setRequestSort] =
    useState<CommunityRequestSort>('recent');
  const [newRequestThreshold] = useState(
    () => Date.now() - 24 * 60 * 60 * 1000
  );
  const requests = kind === 'incoming' ? incomingRequests : outgoingRequests;
  const title =
    kind === 'incoming'
      ? communityCopy.requests.incoming
      : communityCopy.requests.outgoing;
  const filteredRequests = requests
    .filter((request) => {
      if (requestFilter === 'all') {
        return true;
      }

      return new Date(request.createdAt).getTime() >= newRequestThreshold;
    })
    .sort((firstRequest, secondRequest) => {
      const firstTime = new Date(firstRequest.createdAt).getTime();
      const secondTime = new Date(secondRequest.createdAt).getTime();

      return requestSort === 'recent'
        ? secondTime - firstTime
        : firstTime - secondTime;
    });

  return (
    <div className={dialogStyles.communityDialogLayer} role="presentation">
      <section
        className={dialogStyles.communityRequestsDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-requests-title"
      >
        <header>
          <div>
            <span>Community</span>
            <h2 id="community-requests-title">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={communityCopy.actions.close}
          >
            <CommunityIcon name="close" />
          </button>
        </header>
        <div className={dialogStyles.communityDialogFilters}>
          <button
            className={
              requestFilter === 'all' ? dialogStyles.activeCommunityFilter : ''
            }
            type="button"
            onClick={() => setRequestFilter('all')}
          >
            {communityCopy.filters.all}
          </button>
          <button
            className={
              requestFilter === 'new' ? dialogStyles.activeCommunityFilter : ''
            }
            type="button"
            onClick={() => setRequestFilter('new')}
          >
            {communityCopy.requests.new}
          </button>
          <button
            className={
              requestSort === 'recent' ? dialogStyles.activeCommunityFilter : ''
            }
            type="button"
            onClick={() =>
              setRequestSort((current) =>
                current === 'recent' ? 'old' : 'recent'
              )
            }
          >
            {requestSort === 'recent'
              ? communityCopy.requests.sortRecent
              : communityCopy.requests.sortOld}
          </button>
        </div>
        <div className={dialogStyles.communityDialogList}>
          {filteredRequests.length === 0 && (
            <p>{communityCopy.requests.empty}</p>
          )}
          {filteredRequests.map((request) => {
            const user =
              kind === 'incoming' ? request.fromUser : request.toUser;

            return (
              <article
                className={cardStyles.communityRequestCard}
                key={request.id}
              >
                <CommunityUserAvatar user={user} />
                <div>
                  <CommunityUserName user={user} />
                  <small className="ui-ellipsis">@{user.login}</small>
                </div>
                <div className={cardStyles.communityRequestActions}>
                  {kind === 'incoming' ? (
                    <>
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
                    </>
                  ) : (
                    <button
                      className={cardStyles.communityCancelButton}
                      type="button"
                      disabled={isMutatingFriends}
                      onClick={() => onCancelFriendRequest(request.id)}
                    >
                      {communityCopy.actions.cancel}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function CommunityUserAvatar({ user }: { user: FriendUserResponse }) {
  return (
    <span className={cardStyles.communityAvatar} aria-hidden="true">
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
  );
}

export function CommunityUserName({ user }: { user: FriendUserResponse }) {
  return (
    <PresenceName status={user.presenceStatus}>
      <strong className="ui-ellipsis">{user.displayName}</strong>
    </PresenceName>
  );
}

export type CommunityIconName =
  | 'addUser'
  | 'check'
  | 'chevronDown'
  | 'close'
  | 'friends'
  | 'invite'
  | 'message'
  | 'more'
  | 'online'
  | 'phone'
  | 'search'
  | 'server'
  | 'sliders'
  | 'voice';

const systemIconByCommunityIcon: Record<CommunityIconName, SystemIconName> = {
  addUser: 'user-plus',
  check: 'check',
  chevronDown: 'chevron-down',
  close: 'close',
  friends: 'friends',
  invite: 'user-plus',
  message: 'message',
  more: 'more',
  online: 'user',
  phone: 'phone',
  search: 'search',
  server: 'server',
  sliders: 'sliders',
  voice: 'speaker'
};

export function CommunityIcon({ name }: { name: CommunityIconName }) {
  return (
    <SystemIcon
      className={styles.communitySvgIcon}
      name={systemIconByCommunityIcon[name]}
    />
  );
}
