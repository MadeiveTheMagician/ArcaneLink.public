import type { MouseEvent, UIEvent } from 'react'
import type { ServerMemberDetailsResponse } from '../../../../shared/types'
import { commonCopy, PresenceName, serverCopy } from '../../../shared/index'
import { SystemSkeleton } from '../../../shared/ui/SystemSkeleton'
import { shouldLoadMoreServerMembers } from '../../hooks/workspace/serverMemberPaginationModel'
import styles from './ServerMembersPanel.module.css'
import { getServerMembersPanelDisclosure } from './serverMembersPanelModel'
import type { ServerMemberProfileAnchor } from '../member-profile/serverMemberProfileModel'

const memberSkeletonKeys = Array.from(
  { length: 20 },
  (_, index) => `member-${index + 1}`,
)

export function ServerMembersPanel({
  className = '',
  id,
  isCollapsed = false,
  isCompact,
  isLoading,
  isLoadingMore,
  hasMore,
  members,
  totalCount,
  selectedMemberId,
  onSelectMember,
  onOpenMemberContextMenu,
  onLoadMore,
}: {
  className?: string
  id: string
  isCollapsed?: boolean
  isCompact: boolean
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  members: ServerMemberDetailsResponse[]
  totalCount: number
  selectedMemberId: string | null
  onSelectMember: (
    member: ServerMemberDetailsResponse,
    anchor: ServerMemberProfileAnchor,
    focusTarget: HTMLElement,
  ) => void
  onOpenMemberContextMenu: (
    member: ServerMemberDetailsResponse,
    event: MouseEvent<HTMLElement>,
  ) => void
  onLoadMore: () => Promise<boolean>
}) {
  const disclosure = getServerMembersPanelDisclosure(isCollapsed)
  function handleMemberListScroll(event: UIEvent<HTMLDivElement>) {
    if (!hasMore || isLoadingMore) {
      return
    }

    const list = event.currentTarget

    if (shouldLoadMoreServerMembers(list)) {
      void onLoadMore()
    }
  }

  return (
    <aside
      id={id}
      className={`${styles.memberPanel} ui-panel ${className} ${
        isCompact ? styles.compact : ''
      } ${isCollapsed ? styles.collapsed : ''}`}
      data-state={disclosure.state}
      aria-label={serverCopy.labels.members}
      aria-hidden={disclosure.ariaHidden}
      aria-busy={isLoading || isLoadingMore}
      inert={disclosure.inert}
    >
      <header>
        <div className={styles.memberPanelHeading}>
          <div>
            <span>{serverCopy.labels.members}</span>
            <strong>{totalCount}</strong>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className={`${styles.memberList} ${styles.memberSkeletonList}`}>
          {memberSkeletonKeys.map((key, index) => (
            <div className={styles.memberSkeletonRow} key={key}>
              <SystemSkeleton
                className={styles.memberSkeletonAvatar}
                size={30}
                variant="circle"
              />
              <span className={styles.memberSkeletonText}>
                <SystemSkeleton
                  height={10}
                  variant="text"
                  width={index % 2 === 0 ? '72%' : '58%'}
                />
                <SystemSkeleton
                  height={8}
                  variant="text"
                  width={index % 2 === 0 ? '48%' : '64%'}
                />
              </span>
            </div>
          ))}
        </div>
      ) : members.length > 0 ? (
        <div
          className={`${styles.memberList} ui-scroll-list ui-scrollbar-none`}
          onScroll={handleMemberListScroll}
        >
          {members.map((member) => {
            const avatarUrl = member.user.avatarAssetId
              ? `/api/assets/${member.user.avatarAssetId}/content`
              : null

            return (
              <article
                key={member.id}
                className={`${styles.memberCard} ui-list-row ${
                  selectedMemberId === member.id ? styles.activeMember : ''
                }`}
                role="button"
                tabIndex={0}
                onClick={(event) =>
                  onSelectMember(
                    member,
                    event.currentTarget.getBoundingClientRect(),
                    event.currentTarget,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onSelectMember(
                    member,
                    event.currentTarget.getBoundingClientRect(),
                    event.currentTarget,
                  )
                }}
                onContextMenu={(event) =>
                  onOpenMemberContextMenu(member, event)
                }
              >
                <span className={`${styles.memberAvatar} ui-frame`}>
                  {avatarUrl ? (
                    <img className="ui-media-fit" src={avatarUrl} alt="" />
                  ) : (
                    member.user.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <div>
                  <PresenceName status={member.user.presenceStatus}>
                    <strong className="ui-ellipsis">
                      {member.user.displayName}
                    </strong>
                  </PresenceName>
                  <small className="ui-ellipsis">
                    @{member.user.login}
                    {member.isOwner ? ` · ${serverCopy.labels.ownerBadge}` : ''}
                    {member.user.presenceStatus === 'offline'
                      ? ` · ${commonCopy.status.offline}`
                      : ''}
                  </small>
                </div>
              </article>
            )
          })}
          {isLoadingMore && (
            <div
              className={styles.memberLoadMore}
              aria-label={serverCopy.state.loadingMembers}
            >
              <SystemSkeleton height={8} variant="text" width="64%" />
            </div>
          )}
        </div>
      ) : (
        <p className="ui-empty-state">{serverCopy.labels.noMembers}</p>
      )}
    </aside>
  )
}

