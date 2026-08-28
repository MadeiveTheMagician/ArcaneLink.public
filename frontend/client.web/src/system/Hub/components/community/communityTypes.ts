import { communityCopy } from '../../../shared'

export type CommunityTab = 'friends' | 'people' | 'blocklist'
export type CommunityNavigationRequest = {
  id: number
  tab: CommunityTab
}
export type CommunityFriendStatusFilter = 'all' | 'online' | 'offline'
export type CommunityRequestsDialogKind = 'incoming' | 'outgoing'
export type CommunityPeopleScope = 'all' | 'shared-servers'
export type CommunityPeopleSort = 'recommended' | 'online' | 'recent'
export type CommunityRequestFilter = 'all' | 'new'
export type CommunityRequestSort = 'recent' | 'old'

export const communityRequestPreviewLimit = 5

export const communityFriendStatusOptions: CommunityFriendStatusFilter[] = [
  'all',
  'online',
  'offline',
]

export const communityFriendStatusLabels: Record<
  CommunityFriendStatusFilter,
  string
> = {
  all: communityCopy.filters.all,
  online: communityCopy.filters.online,
  offline: communityCopy.filters.offline,
}
