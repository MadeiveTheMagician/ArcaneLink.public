import type { UIEvent } from 'react';

import type { ServerMemberDetailsResponse } from '../../../../shared/types';
import { PresenceName, commonCopy, serverCopy } from '../../../shared';
import { shouldLoadMoreServerMembers } from '../../hooks/workspace/serverMemberPaginationModel';
import type { ServerMemberProfileAnchor } from '../member-profile/serverMemberProfileModel';

import styles from './MobileServerMembersPanel.module.css';

type MobileServerMembersPanelProps = {
  members: ServerMemberDetailsResponse[];
  selectedMemberId: string | null;
  isOpen: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onSelectMember: (
    member: ServerMemberDetailsResponse,
    anchor: ServerMemberProfileAnchor,
    focusTarget: HTMLElement
  ) => void;
  onLoadMore: () => Promise<boolean>;
};

export function MobileServerMembersPanel({
  members,
  selectedMemberId,
  isOpen,
  isLoadingMore,
  hasMore,
  onSelectMember,
  onLoadMore
}: MobileServerMembersPanelProps) {
  function handleScroll(event: UIEvent<HTMLDivElement>) {
    if (!hasMore || isLoadingMore) {
      return;
    }

    const list = event.currentTarget;

    if (shouldLoadMoreServerMembers(list)) {
      void onLoadMore();
    }
  }

  return (
    <div
      id="mobile-server-members-panel"
      className={[
        styles.panel,
        isOpen ? styles.open : '',
        'ui-scroll-list ui-scrollbar-none'
      ]
        .filter(Boolean)
        .join(' ')}
      data-state={isOpen ? 'expanded' : 'collapsed'}
      aria-label={serverCopy.labels.members}
      aria-hidden={!isOpen}
      aria-busy={isLoadingMore}
      inert={!isOpen}
      onScroll={handleScroll}
    >
      {members.map((member) => {
        const avatarUrl = member.user.avatarAssetId
          ? `/api/assets/${member.user.avatarAssetId}/content`
          : null;

        return (
          <button
            key={member.id}
            className={selectedMemberId === member.id ? styles.active : ''}
            type="button"
            onClick={(event) =>
              onSelectMember(
                member,
                event.currentTarget.getBoundingClientRect(),
                event.currentTarget
              )
            }
          >
            <span className={`${styles.avatar} ui-frame`}>
              {avatarUrl ? (
                <img
                  className="ui-media-fit"
                  src={avatarUrl}
                  alt=""
                  style={{
                    transform: `translate(${member.user.avatarCropOffsetX * 100}%, ${
                      member.user.avatarCropOffsetY * 100
                    }%) scale(${member.user.avatarCropZoom})`
                  }}
                />
              ) : (
                member.user.displayName.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className={styles.text}>
              <PresenceName status={member.user.presenceStatus}>
                <strong>{member.user.displayName}</strong>
              </PresenceName>
              <small>
                @{member.user.login}
                {member.isOwner ? ` · ${serverCopy.labels.ownerBadge}` : ''}
                {member.user.presenceStatus === 'offline'
                  ? ` · ${commonCopy.status.offline}`
                  : ''}
              </small>
            </span>
          </button>
        );
      })}
      {isLoadingMore && (
        <div
          className={styles.loadingMore}
          aria-label={serverCopy.state.loadingMembers}
        >
          {serverCopy.state.loadingMembers}
        </div>
      )}
    </div>
  );
}
