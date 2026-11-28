import type { ServerMemberDetailsResponse, SpaceMessageResponse, SpaceResponse } from '../../../../shared/types'
import { serverCopy } from '../../../shared'
import { WorkspaceMessageSearch } from '../../../shared/components/message-search/WorkspaceMessageSearch'
import { useMessageSearch } from '../../../shared/hooks/useMessageSearch'

type Props = {
  accessToken: string
  serverId: string
  spaces: SpaceResponse[]
  members: ServerMemberDetailsResponse[]
  onOpenSearchResult: (message: SpaceMessageResponse) => void
}

export function ServerMessageSearch({ accessToken, serverId, spaces, members, onOpenSearchResult }: Props) {
  const search = useMessageSearch({ accessToken, endpoint: `/api/servers/${serverId}/messages/search` })
  const searchableSpaces = spaces.filter((space) =>
    space.typeCode === 'text_room' || (space.typeCode === 'voice_room' && space.voiceChatSpaceId),
  )
  const findSpace = (id: string) => searchableSpaces.find((space) =>
    space.id === id || space.voiceChatSpaceId === id,
  )
  return (
    <WorkspaceMessageSearch
      control={{
        name: 'memberMessageSearch',
        ariaLabel: serverCopy.labels.searchMessages,
        query: search.query,
        filters: search.filters,
        userOptions: members.map(({ userId, user }) => ({ ...user, id: userId })),
        spaceOptions: searchableSpaces.map((space) => ({
          id: space.voiceChatSpaceId ?? space.id,
          title: space.title,
          icon: space.typeCode === 'voice_room' ? '◈' : '#',
        })),
        onQueryChange: search.setQuery,
        onFiltersChange: search.setFilters,
        onSubmit: search.submitSearch,
        onClear: search.clearSearch,
      }}
      results={search.isActive ? {
        query: search.submittedQuery,
        results: search.results,
        isSearching: search.isSearching,
        error: search.error,
        getSpaceLabel: (message) => findSpace(message.spaceId)?.title ?? serverCopy.labels.spaceFallback,
        getCategoryLabel: (message) => spaces.find((space) =>
          space.id === findSpace(message.spaceId)?.parentSpaceId && space.typeCode === 'category',
        )?.title ?? null,
        onOpenMessage: (message) => {
          onOpenSearchResult(message)
          search.clearSearch()
        },
      } : undefined}
    />
  )
}
