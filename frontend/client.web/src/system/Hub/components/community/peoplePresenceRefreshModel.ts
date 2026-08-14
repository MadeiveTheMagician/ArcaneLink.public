import type {
  CommunityPeopleSort,
  CommunityTab,
} from './communityTypes'

export function shouldRefreshPeopleDiscoveryForPresence({
  activeTab,
  onlineOnly,
  sort,
}: {
  activeTab: CommunityTab
  onlineOnly: boolean
  sort: CommunityPeopleSort
}) {
  return (
    activeTab === 'people' &&
    (onlineOnly ||
      sort === 'online' ||
      sort === 'recommended' ||
      sort === 'recent')
  )
}
