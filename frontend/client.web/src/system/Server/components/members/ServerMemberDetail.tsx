import type { ServerMemberDetailsResponse, ServerRoleResponse } from '../../../../shared/types'
import { commonCopy, PresenceDot, serverCopy } from '../../../shared/index'
import styles from './ServerMemberDetail.module.css'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function formatLastSeen(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function ServerMemberDetail({
  member,
  roles,
  isFriend,
  hasPendingFriendRequest,
  isSelf,
  isMutatingFriends,
  onSendFriendRequest,
}: {
  member: ServerMemberDetailsResponse
  roles: ServerRoleResponse[]
  isFriend: boolean
  hasPendingFriendRequest: boolean
  isSelf: boolean
  isMutatingFriends: boolean
  onSendFriendRequest: (userId: string) => void
}) {
  const avatarUrl = member.user.avatarAssetId
    ? `/api/assets/${member.user.avatarAssetId}/content`
    : null

  return (
    <section className={styles.detail}>
      <header>
        <span className={`${styles.detailAvatar} ui-frame`}>
          {avatarUrl ? (
            <img className="ui-media-fit" src={avatarUrl} alt="" />
          ) : (
            member.user.displayName.slice(0, 1).toUpperCase()
          )}
        </span>
        <div>
          <span>
            {member.isOwner ? serverCopy.labels.owner : serverCopy.labels.member}
          </span>
          <h2 className={styles.detailName}>
            {member.user.displayName}
            <PresenceDot status={member.user.presenceStatus} />
          </h2>
          <p>@{member.user.login}</p>
        </div>
      </header>

      <div className={styles.detailActions}>
        <button type="button">{serverCopy.labels.directMessage}</button>
        <button
          type="button"
          disabled={
            isSelf || isFriend || hasPendingFriendRequest || isMutatingFriends
          }
          onClick={() => onSendFriendRequest(member.userId)}
        >
          {isFriend
            ? serverCopy.labels.alreadyFriends
            : hasPendingFriendRequest
              ? serverCopy.labels.requestSent
              : serverCopy.labels.addFriend}
        </button>
      </div>

      <dl className={styles.detailGrid}>
        <div>
          <dt>{serverCopy.labels.status}</dt>
          <dd>{member.statusCode}</dd>
        </div>
        {member.user.presenceStatus === 'offline' && (
          <div>
            <dt>{serverCopy.labels.presence}</dt>
            <dd>
              {commonCopy.status.offline}
              {member.user.lastSeenAt && (
                <> · {formatLastSeen(member.user.lastSeenAt)}</>
              )}
            </dd>
          </div>
        )}
        <div>
          <dt>{serverCopy.labels.joined}</dt>
          <dd>{formatDate(member.joinedAt)}</dd>
        </div>
        <div>
          <dt>{serverCopy.labels.roles}</dt>
          <dd>
            {roles.length > 0
              ? roles.map((role) => role.title).join(', ')
              : serverCopy.labels.noRoles}
          </dd>
        </div>
        <div>
          <dt>{serverCopy.labels.permissions}</dt>
          <dd>
            {member.permissionCodes.length > 0
              ? member.permissionCodes.join(', ')
              : serverCopy.labels.noExtraPermissions}
          </dd>
        </div>
      </dl>
    </section>
  )
}

