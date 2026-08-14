import type { MouseEvent, UIEvent } from 'react'
import type { ServerMemberDetailsResponse, SpaceMessageResponse, SpaceResponse } from '../../../../shared/types'
import { commonCopy, PresenceName, serverCopy } from '../../../shared/index'
import { MessageSearchControl } from '../../../shared/components/message-search/MessageSearchControl'
import { MessageSearchResults } from '../../../shared/components/message-search/MessageSearchResults'
import { useMessageSearch } from '../../../shared/hooks/useMessageSearch'
import { SystemSkeleton } from '../../../shared/ui/SystemSkeleton'
import { shouldLoadMoreServerMembers } from '../../hooks/workspace/serverMemberPaginationModel'
import styles from './ServerMembersPanel.module.css'

const memberSkeletonKeys = Array.from(
  { length: 20 },
  (_, index) => `member-${index + 1}`,
)

export function ServerMembersPanel({
  accessToken,
  className = '',
  hidden = false,
  isCompact,
  isLoading,
  isLoadingMore,
  hasMore,
  members,
  totalCount,
  serverId,
  spaces,
  selectedMemberId,
  onSelectMember,
  onOpenMemberContextMenu,
  onOpenSearchResult,
  onLoadMore,
}: {
  accessToken: string
  className?: string
  hidden?: boolean
  isCompact: boolean
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  members: ServerMemberDetailsResponse[]
  totalCount: number
  serverId: string
  spaces: SpaceResponse[]
  selectedMemberId: string | null
  onSelectMember: (member: ServerMemberDetailsResponse) => void
  onOpenMemberContextMenu: (
    member: ServerMemberDetailsResponse,
    event: MouseEvent<HTMLElement>,
  ) => void
  onOpenSearchResult: (message: SpaceMessageResponse) => void
  onLoadMore: () => Promise<boolean>
}) {
  const messageSearch = useMessageSearch({
    accessToken,
    endpoint: `/api/servers/${serverId}/messages/search`,
  })
  const messageSpaces = spaces.filter(
    (space) =>
      space.typeCode === 'text_room' ||
      (space.typeCode === 'voice_room' && Boolean(space.voiceChatSpaceId)),
  )
  const spaceById = new Map(
    messageSpaces.flatMap((space) => [
      [space.id, space] as const,
      ...(space.voiceChatSpaceId
        ? [[space.voiceChatSpaceId, space] as const]
        : []),
    ]),
  )
  function getSearchSpaceLabel(message: SpaceMessageResponse) {
    return spaceById.get(message.spaceId)?.title ?? serverCopy.labels.spaceFallback
  }

  function getSearchCategoryLabel(message: SpaceMessageResponse) {
    const space = spaceById.get(message.spaceId)
    if (!space?.parentSpaceId) {
      return null
    }

    const category = spaceById.get(space.parentSpaceId)
    return category?.typeCode === 'category' ? category.title : null
  }

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
      hidden={hidden}
      className={`${styles.memberPanel} ui-panel ${className} ${isCompact ? styles.compact : ''}`}
      aria-label={serverCopy.labels.members}
      aria-busy={!messageSearch.isActive && (isLoading || isLoadingMore)}
    >
      <header>
        <div className={styles.memberSearchSlot}>
          <MessageSearchControl
            name="memberMessageSearch"
            ariaLabel={serverCopy.labels.searchMessages}
            query={messageSearch.query}
            filters={messageSearch.filters}
            userOptions={members.map((member) => ({
              id: member.userId,
              displayName: member.user.displayName,
              login: member.user.login,
              avatarAssetId: member.user.avatarAssetId,
              avatarCropOffsetX: member.user.avatarCropOffsetX,
              avatarCropOffsetY: member.user.avatarCropOffsetY,
              avatarCropZoom: member.user.avatarCropZoom,
            }))}
            spaceOptions={messageSpaces.map((space) => ({
              id: space.voiceChatSpaceId ?? space.id,
              title: space.title,
              icon: space.typeCode === 'voice_room' ? '◈' : '#',
            }))}
            onQueryChange={messageSearch.setQuery}
            onFiltersChange={messageSearch.setFilters}
            onSubmit={messageSearch.submitSearch}
            onClear={messageSearch.clearSearch}
          />
        </div>
        <div className={styles.memberPanelHeading}>
          <div>
            <span>
              {messageSearch.isActive
                ? serverCopy.labels.search
                : serverCopy.labels.members}
            </span>
            <strong>
              {messageSearch.isActive ? messageSearch.results.length : totalCount}
            </strong>
          </div>
        </div>
      </header>

      {messageSearch.isActive ? (
        <MessageSearchResults
          query={messageSearch.submittedQuery}
          results={messageSearch.results}
          isSearching={messageSearch.isSearching}
          error={messageSearch.error}
          getSpaceLabel={getSearchSpaceLabel}
          getCategoryLabel={getSearchCategoryLabel}
          onOpenMessage={onOpenSearchResult}
        />
      ) : isLoading ? (
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
                onClick={() => onSelectMember(member)}
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

