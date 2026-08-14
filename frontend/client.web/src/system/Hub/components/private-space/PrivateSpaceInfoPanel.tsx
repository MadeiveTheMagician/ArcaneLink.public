import type {
  PrivateSpaceMemberResponse,
  PrivateSpaceResponse,
} from '../../../../shared/types'
import { commonCopy, communityCopy, PresenceName } from '../../../shared'
import { PrivateMemberAvatar } from './PrivateSpaceVoiceParts'
import styles from './PrivateSpaceInfoPanel.module.css'

type PrivateSpaceInfoPanelProps = {
  spaceKind: PrivateSpaceResponse['kind'] | null
  activeMembers: PrivateSpaceMemberResponse[]
  isCompact: boolean
  otherMember: PrivateSpaceMemberResponse | null
  searchQuery: string
  onSearchQueryChange: (query: string) => void
}

export function PrivateSpaceInfoPanel({
  spaceKind,
  activeMembers,
  isCompact,
  otherMember,
  searchQuery,
  onSearchQueryChange,
}: PrivateSpaceInfoPanelProps) {
  const otherMemberLastSeenLabel = otherMember
    ? getLastSeenLabel(otherMember)
    : null

  return (
    <aside
      className={`${styles.privateInfoPanel} ${
        isCompact ? styles.compactPrivateInfo : ''
      }`}
    >
      <label className={styles.privateSearch}>
        <span>{communityCopy.direct.search}</span>
        <input
          name="privateMessageSearch"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={communityCopy.direct.searchPlaceholder}
        />
      </label>

      {isCompact && spaceKind === 'group' ? (
        <section
          className={`${styles.privateMembers} ${styles.compactMembers}`}
          aria-label={communityCopy.direct.serverMembers}
        >
          {activeMembers.map((member) => (
            <PrivateSpaceMemberCard
              key={member.id}
              member={member}
              isCompact
            />
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
  )
}

function PrivateSpaceMemberCard({
  member,
  isCompact = false,
}: {
  member: PrivateSpaceMemberResponse
  isCompact?: boolean
}) {
  const presenceLabel =
    member.user.presenceStatus === 'online'
      ? commonCopy.status.online
      : commonCopy.status.offline
  const tooltip = `${member.user.displayName} (@${member.user.login}) · ${presenceLabel}`

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
  )
}

function getLastSeenLabel(member: PrivateSpaceMemberResponse) {
  if (member.user.presenceStatus === 'online') {
    return null
  }

  if (!member.user.lastSeenAt) {
    return communityCopy.states.offline
  }

  const lastSeenAt = new Date(member.user.lastSeenAt)

  if (Number.isNaN(lastSeenAt.getTime())) {
    return communityCopy.states.offline
  }

  const formattedDate = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(lastSeenAt)

  return `${communityCopy.direct.invitedWasOnline} ${formattedDate}`
}
