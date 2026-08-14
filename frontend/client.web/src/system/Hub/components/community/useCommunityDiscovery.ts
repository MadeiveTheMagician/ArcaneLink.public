import { useEffect, useMemo, useRef, useState } from 'react'
import { apiJson } from '../../../../shared/api/api'
import type {
  FriendUserResponse,
  ProfileTagResponse,
} from '../../../../shared/types'
import { useUserPresenceChanged } from '../../../shared/hooks/useUserPresenceChanged'
import { createRealtimeRefreshCoalescer } from '../../../shared/hooks/realtimeRefreshCoalescer'
import { patchFriendUsersPresence } from '../../../shared/presence/presenceModel'
import {
  captureUserPresenceEventBoundary,
  reconcileFriendUsersWithLatestPresence,
} from '../../../shared/presence/presenceEventStore'
import type {
  CommunityPeopleScope,
  CommunityPeopleSort,
  CommunityTab,
} from './communityTypes'
import { shouldRefreshPeopleDiscoveryForPresence } from './peoplePresenceRefreshModel'

type CommunityDiscoveryOptions = {
  accessToken: string
  activeTab: CommunityTab
  peopleSearchQuery: string
}

type PeopleDiscoveryRequest = {
  key: string
  url: string
  accessToken: string
}

export function useCommunityDiscovery({
  accessToken,
  activeTab,
  peopleSearchQuery,
}: CommunityDiscoveryOptions) {
  const [profileTags, setProfileTags] = useState<ProfileTagResponse[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [peopleScope, setPeopleScope] = useState<CommunityPeopleScope>('all')
  const [peopleSort, setPeopleSort] =
    useState<CommunityPeopleSort>('recommended')
  const [peopleOnlineOnly, setPeopleOnlineOnly] = useState(false)
  const [discoveredPeople, setDiscoveredPeople] = useState<FriendUserResponse[]>(
    [],
  )
  const [isDiscoveringPeople, setIsDiscoveringPeople] = useState(false)
  const peopleRequestRef = useRef<PeopleDiscoveryRequest | null>(null)
  const peopleRefreshRef = useRef<
    ReturnType<typeof createRealtimeRefreshCoalescer> | null
  >(null)

  useEffect(() => {
    const refresh = createRealtimeRefreshCoalescer(async () => {
      const request = peopleRequestRef.current
      if (!request) {
        return
      }

      setIsDiscoveringPeople(true)

      try {
        const presenceBoundary = captureUserPresenceEventBoundary()
        const users = reconcileFriendUsersWithLatestPresence(
          await apiJson<FriendUserResponse[]>(request.url, {
            accessToken: request.accessToken,
          }),
          presenceBoundary,
        )

        if (peopleRequestRef.current?.key === request.key) {
          setDiscoveredPeople(users)
        }
      } catch {
        if (peopleRequestRef.current?.key === request.key) {
          setDiscoveredPeople([])
        }
      } finally {
        if (peopleRequestRef.current?.key === request.key) {
          setIsDiscoveringPeople(false)
        }
      }
    }, 220)
    peopleRefreshRef.current = refresh

    return () => {
      refresh.dispose()

      if (peopleRefreshRef.current === refresh) {
        peopleRefreshRef.current = null
        peopleRequestRef.current = null
      }
    }
  }, [])

  const peopleRequest = useMemo(
    () =>
      activeTab === 'people'
        ? createPeopleDiscoveryRequest({
            accessToken,
            onlineOnly: peopleOnlineOnly,
            query: peopleSearchQuery,
            scope: peopleScope,
            selectedTagIds,
            sort: peopleSort,
          })
        : null,
    [
      accessToken,
      activeTab,
      peopleOnlineOnly,
      peopleScope,
      peopleSearchQuery,
      peopleSort,
      selectedTagIds,
    ],
  )
  const peopleRequestKey = peopleRequest?.key ?? null

  useEffect(() => {
    peopleRequestRef.current = peopleRequest
  }, [peopleRequest])

  useUserPresenceChanged((payload) => {
    setDiscoveredPeople((current) =>
      patchFriendUsersPresence(current, payload),
    )

    if (
      shouldRefreshPeopleDiscoveryForPresence({
        activeTab,
        onlineOnly: peopleOnlineOnly,
        sort: peopleSort,
      })
    ) {
      peopleRefreshRef.current?.request()
    }

  })

  useEffect(() => {
    let isDisposed = false

    apiJson<ProfileTagResponse[]>('/api/users/profile-tags', { accessToken })
      .then((tags) => {
        if (!isDisposed) {
          setProfileTags(tags)
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setProfileTags([])
        }
      })

    return () => {
      isDisposed = true
    }
  }, [accessToken])

  useEffect(() => {
    if (!peopleRequestKey) {
      setIsDiscoveringPeople(false)
      return
    }

    peopleRefreshRef.current?.request()
  }, [peopleRequestKey])

  return {
    discoveredPeople,
    isDiscoveringPeople,
    peopleOnlineOnly,
    peopleScope,
    peopleSort,
    profileTags,
    selectedTagIds,
    setPeopleOnlineOnly,
    setPeopleScope,
    setPeopleSort,
    setSelectedTagIds,
  }
}

function createPeopleDiscoveryRequest({
  accessToken,
  onlineOnly,
  query,
  scope,
  selectedTagIds,
  sort,
}: {
  accessToken: string
  onlineOnly: boolean
  query: string
  scope: CommunityPeopleScope
  selectedTagIds: string[]
  sort: CommunityPeopleSort
}): PeopleDiscoveryRequest {
  const params = new URLSearchParams()
  const normalizedQuery = query.trim()

  if (normalizedQuery) {
    params.set('query', normalizedQuery)
  }

  params.set('scope', scope)
  params.set('sort', sort)

  if (onlineOnly) {
    params.set('online', 'true')
  }

  selectedTagIds.forEach((tagId) => params.append('tagIds', tagId))
  const url = `/api/users/discover?${params.toString()}`

  return {
    accessToken,
    url,
    key: `${accessToken}\u0000${url}`,
  }
}
