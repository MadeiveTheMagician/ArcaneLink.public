export type ServerDirectoryVisibility =
  | 'member'
  | 'all'
  | 'available'
  | 'public'

export type ServerDirectorySort = 'active' | 'members' | 'name'

export type ServerDirectoryTab = 'mine' | 'discover'
export type ServerDirectoryAccessAction =
  | 'open'
  | 'join'
  | 'request'
  | 'pending'
  | 'none'

export type ServerDirectoryRequest = {
  accessToken: string
  key: string
  url: string
  visibility: ServerDirectoryVisibility
}

export function createServerDirectoryRequest({
  accessToken,
  query,
  sort,
  visibility,
}: {
  accessToken: string
  query: string
  sort: ServerDirectorySort
  visibility: ServerDirectoryVisibility
}): ServerDirectoryRequest {
  const params = new URLSearchParams()
  const normalizedQuery = query.trim()

  if (normalizedQuery) {
    params.set('query', normalizedQuery)
  }

  params.set('visibility', visibility)
  params.set('sort', sort)
  const url = `/api/servers/discover?${params.toString()}`

  return {
    accessToken,
    key: `${accessToken}\u0000${url}`,
    url,
    visibility,
  }
}

export function getServerDirectoryVisibility(
  tab: ServerDirectoryTab,
): ServerDirectoryVisibility {
  return tab === 'mine' ? 'member' : 'available'
}

export function resolveServerDirectoryAccessAction(
  discovery: Pick<ServerDiscoveryResponse, 'isMember' | 'joinAction'>,
): ServerDirectoryAccessAction {
  return discovery.isMember ? 'open' : discovery.joinAction
}

export function toggleExpandedServer(
  expandedServerIds: ReadonlySet<string>,
  serverId: string,
) {
  const nextExpandedServerIds = new Set(expandedServerIds)

  if (nextExpandedServerIds.has(serverId)) {
    nextExpandedServerIds.delete(serverId)
  } else {
    nextExpandedServerIds.add(serverId)
  }

  return nextExpandedServerIds
}
import type { ServerDiscoveryResponse } from '../../../../shared/types'
