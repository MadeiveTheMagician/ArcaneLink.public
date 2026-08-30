import type {
  PrivateSpaceMemberResponse,
  PrivateSpaceResponse
} from '../../../../shared/types';
import { PresenceName, commonCopy, communityCopy } from '../../../shared';
import { MessageSearchControl } from '../../../shared/components/message-search/MessageSearchControl';
import { MessageSearchResults } from '../../../shared/components/message-search/MessageSearchResults';
import type { useMessageSearch } from '../../../shared/hooks/useMessageSearch';
import { PrivateMemberAvatar } from './PrivateSpaceVoiceParts';

import styles from './PrivateSpaceInfoPanel.module.css';

type PrivateSpaceInfoPanelProps = {
  spaceKind: PrivateSpaceResponse['kind'] | null;
  activeMembers: PrivateSpaceMemberResponse[];
  isCompact: boolean;
  otherMember: PrivateSpaceMemberResponse | null;
  messageSearch: ReturnType<typeof useMessageSearch>;
  onOpenSearchResult: (
    message: import('../../../../shared/types').SpaceMessageResponse
  ) => void;
};

export function PrivateSpaceInfoPanel({
  spaceKind,
  activeMembers,
  isCompact,
  otherMember,
  messageSearch,
  onOpenSearchResult
}: PrivateSpaceInfoPanelProps) {
  const otherMemberLastSeenLabel = otherMember
    ? getLastSeenLabel(otherMember)
    : null;

  return (
    <aside
      className={`${styles.privateInfoPanel} ${
        isCompact ? styles.compactPrivateInfo : ''
      }`}
    >
      <div className={styles.privateSearch}>
        <MessageSearchControl
          name="privateMessageSearch"
          ariaLabel={communityCopy.direct.search}
          query={messageSearch.query}
          filters={messageSearch.filters}
          userOptions={activeMembers.map((member) => ({
            id: member.userId,
            displayName: member.user.displayName,
            login: member.user.login,
            avatarAssetId: member.user.avatarAssetId,
            avatarCropOffsetX: member.user.avatarCropOffsetX,
            avatarCropOffsetY: member.user.avatarCropOffsetY,
            avatarCropZoom: member.user.avatarCropZoom
          }))}
          placeholder={communityCopy.direct.searchPlaceholder}
          onQueryChange={messageSearch.setQuery}
          onFiltersChange={messageSearch.setFilters}
          onSubmit={messageSearch.submitSearch}
          onClear={messageSearch.clearSearch}
        />
      </div>

      {messageSearch.isActive ? (
        <MessageSearchResults
          query={messageSearch.submittedQuery}
          results={messageSearch.results}
          isSearching={messageSearch.isSearching}
          error={messageSearch.error}
          onOpenMessage={onOpenSearchResult}
        />
      ) : isCompact && spaceKind === 'group' ? (
        <section
          className={`${styles.privateMembers} ${styles.compactMembers}`}
          aria-label={communityCopy.direct.serverMembers}
        >
          {activeMembers.map((member) => (
            <PrivateSpaceMemberCard key={member.id} member={member} isCompact />
          ))}
        </section>
      ) : spaceKind === 'direct' && otherMember ? (
        <section className={styles.privateProfileCard}>
          <PrivateMemberAvatar user={otherMember.user} large={!isCompact} />
          <PresenceName
            className={styles.privateName}
            status={otherMember.user.presenceStatus}
          >
            <strong>{otherMember.user.displayName}</strong>
          </PresenceName>
          <small>@{otherMember.user.login}</small>
          {otherMemberLastSeenLabel && <p>{otherMemberLastSeenLabel}</p>}
        </section>
      ) : (
        <section className={styles.privateMembers}>
          <h2>{communityCopy.direct.serverMembers}</h2>
          {activeMembers.map((member) => (
            <PrivateSpaceMemberCard key={member.id} member={member} />
          ))}
        </section>
      )}
    </aside>
  );
}

function PrivateSpaceMemberCard({
  member,
  isCompact = false
}: {
  member: PrivateSpaceMemberResponse;
  isCompact?: boolean;
}) {
  const presenceLabel =
    member.user.presenceStatus === 'online'
      ? commonCopy.status.online
      : commonCopy.status.offline;
  const tooltip = `${member.user.displayName} (@${member.user.login}) · ${presenceLabel}`;

  return (
    <article
      className={`${styles.memberCard} ui-list-row ${
        isCompact ? styles.compactMember : ''
      }`}
      title={isCompact ? tooltip : undefined}
    >
      <PrivateMemberAvatar user={member.user} />
      <span className={styles.memberIdentity}>
        <PresenceName status={member.user.presenceStatus}>
          <strong>{member.user.displayName}</strong>
        </PresenceName>
        <small>
          @{member.user.login} · {presenceLabel}
        </small>
      </span>
    </article>
  );
}

function getLastSeenLabel(member: PrivateSpaceMemberResponse) {
  if (member.user.presenceStatus === 'online') {
    return null;
  }

  if (!member.user.lastSeenAt) {
    return communityCopy.states.offline;
  }

  const lastSeenAt = new Date(member.user.lastSeenAt);

  if (Number.isNaN(lastSeenAt.getTime())) {
    return communityCopy.states.offline;
  }

  const formattedDate = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(lastSeenAt);

  return `${communityCopy.direct.invitedWasOnline} ${formattedDate}`;
}
