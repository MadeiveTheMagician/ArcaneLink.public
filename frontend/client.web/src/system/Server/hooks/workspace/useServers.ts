import { useEffect, useRef, useState } from 'react'
import { apiJson, apiNoContent } from '../../../../shared/api/api'
import {
  readUserDataCache,
  writeUserDataCache,
} from '../../../../shared/cache/clientCache'
import type {
  ServerMemberDetailsResponse,
  ServerMemberCursorResponse,
  ServerMemberPageResponse,
  ServerMemberResponse,
  ServerResponse,
} from '../../../../shared/types'
import { useUserPresenceChanged } from '../../../shared/hooks/useUserPresenceChanged'
import { patchServerMembersPresence } from '../../../shared/presence/presenceModel'
import {
  captureUserPresenceEventBoundary,
  reconcileServerMembersWithLatestPresence,
} from '../../../shared/presence/presenceEventStore'
import {
  mergeServerMemberPages,
  serverMemberPageSize,
} from './serverMemberPaginationModel'

const serverOrderCacheVersion = 1

function getServerOrderCacheKey(userId: string) {
  return `arcanelink.serverOrder.v${serverOrderCacheVersion}.${userId}`
}

function readServerOrder(userId: string) {
  try {
    const raw = window.localStorage.getItem(getServerOrderCacheKey(userId))

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown

    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

function writeServerOrder(userId: string, memberships: ServerMemberResponse[]) {
  try {
    window.localStorage.setItem(
      getServerOrderCacheKey(userId),
      JSON.stringify(memberships.map((membership) => membership.serverId)),
    )
  } catch {
    // Optional local preference; storage errors must not block server loading.
  }
}

function applyServerOrder(
  memberships: ServerMemberResponse[],
  serverOrder: string[],
) {
  if (serverOrder.length === 0) {
    return memberships
  }

  const membershipByServerId = new Map(
    memberships.map((membership) => [membership.serverId, membership]),
  )
  const orderedMemberships = serverOrder
    .map((serverId) => membershipByServerId.get(serverId))
    .filter((membership): membership is ServerMemberResponse =>
      Boolean(membership),
    )
  const orderedServerIds = new Set(serverOrder)
  const newMemberships = memberships.filter(
    (membership) => !orderedServerIds.has(membership.serverId),
  )

  return [...orderedMemberships, ...newMemberships]
}

function moveServerMembership(
  memberships: ServerMemberResponse[],
  activeServerId: string,
  overServerId: string,
) {
  const activeIndex = memberships.findIndex(
    (membership) => membership.serverId === activeServerId,
  )
  const overIndex = memberships.findIndex(
    (membership) => membership.serverId === overServerId,
  )

  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return memberships
  }

  const nextMemberships = [...memberships]
  const [movedMembership] = nextMemberships.splice(activeIndex, 1)

  nextMemberships.splice(overIndex, 0, movedMembership)

  return nextMemberships
}

export function useServers(accessToken: string, userId: string) {
  const [serverMemberships, setServerMemberships] = useState<
    ServerMemberResponse[]
  >([])
  const [isLoadingServers, setIsLoadingServers] = useState(true)
  const [loadedServersUserId, setLoadedServersUserId] =
    useState<string | null>(null)
  const [selectedServerMembership, setSelectedServerMembership] =
    useState<ServerMemberResponse | null>(null)
  const [serverMembers, setServerMembers] = useState<
    ServerMemberDetailsResponse[]
  >([])
  const [isLoadingServerMembers, setIsLoadingServerMembers] = useState(false)
  const [isLoadingMoreServerMembers, setIsLoadingMoreServerMembers] =
    useState(false)
  const [hasMoreServerMembers, setHasMoreServerMembers] = useState(false)
  const [serverMemberCount, setServerMemberCount] = useState(0)
  const [isMutatingServerMember, setIsMutatingServerMember] = useState(false)
  const serverMemberCursorRef = useRef<ServerMemberCursorResponse | null>(null)
  const serverMembersServerIdRef = useRef<string | null>(null)
  const serverMemberRequestVersionRef = useRef(0)
  const isLoadingMoreServerMembersRef = useRef(false)

  useUserPresenceChanged((payload) => {
    setServerMembers((current) =>
      patchServerMembersPresence(current, payload),
    )
  })

  async function loadServers(silent = false) {
    if (!silent) {
      setIsLoadingServers(true)
    }

    try {
      const memberships = await apiJson<ServerMemberResponse[]>(
        '/api/servers/me',
        { accessToken },
      )
      const orderedMemberships = applyServerOrder(
        memberships,
        readServerOrder(userId),
      )

      setServerMemberships(orderedMemberships)
      setLoadedServersUserId(userId)
      void writeUserDataCache(userId, 'serverMemberships', orderedMemberships)
      setSelectedServerMembership((current) =>
        current
          ? orderedMemberships.find((membership) => membership.id === current.id) ??
            null
          : current,
      )

      return orderedMemberships
    } finally {
      if (!silent) {
        setIsLoadingServers(false)
      }
    }
  }

  useEffect(() => {
    let isDisposed = false

    void readUserDataCache(userId, 'serverMemberships').then((memberships) => {
      if (!isDisposed && memberships && memberships.length > 0) {
        setServerMemberships(applyServerOrder(memberships, readServerOrder(userId)))
      }
    })

    void loadServers()
    return () => {
      isDisposed = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, userId])

  async function loadServerMembers(
    membership: ServerMemberResponse,
    silent = false,
  ) {
    const requestVersion = serverMemberRequestVersionRef.current + 1

    serverMemberRequestVersionRef.current = requestVersion
    serverMembersServerIdRef.current = membership.serverId
    serverMemberCursorRef.current = null
    isLoadingMoreServerMembersRef.current = false
    setIsLoadingMoreServerMembers(false)
    setHasMoreServerMembers(false)
    setSelectedServerMembership(membership)
    if (!silent) {
      setIsLoadingServerMembers(true)
    }

    try {
      const presenceBoundary = captureUserPresenceEventBoundary()
      const page = await apiJson<ServerMemberPageResponse>(
        `/api/servers/${membership.serverId}/members?limit=${serverMemberPageSize}`,
        { accessToken },
      )

      if (
        requestVersion !== serverMemberRequestVersionRef.current ||
        serverMembersServerIdRef.current !== membership.serverId
      ) {
        return
      }

      const members = reconcileServerMembersWithLatestPresence(
        page.items,
        presenceBoundary,
      )

      setServerMembers((current) =>
        silent &&
        current.some((member) => member.serverId === membership.serverId)
          ? mergeServerMemberPages(members, current)
          : members,
      )
      serverMemberCursorRef.current = page.nextCursor
      setHasMoreServerMembers(page.nextCursor !== null)
      setServerMemberCount(page.totalCount)
    } finally {
      if (requestVersion === serverMemberRequestVersionRef.current) {
        setIsLoadingServerMembers(false)
      }
    }
  }

  async function loadMoreServerMembers() {
    const serverId = serverMembersServerIdRef.current
    const cursor = serverMemberCursorRef.current

    if (
      !serverId ||
      !cursor ||
      isLoadingMoreServerMembersRef.current
    ) {
      return false
    }

    const requestVersion = serverMemberRequestVersionRef.current
    const params = new URLSearchParams({
      limit: String(serverMemberPageSize),
      afterPriority: String(cursor.priority),
      afterJoinedAt: cursor.joinedAt,
      afterId: cursor.id,
    })

    isLoadingMoreServerMembersRef.current = true
    setIsLoadingMoreServerMembers(true)

    try {
      const presenceBoundary = captureUserPresenceEventBoundary()
      const page = await apiJson<ServerMemberPageResponse>(
        `/api/servers/${serverId}/members?${params.toString()}`,
        { accessToken },
      )

      if (
        requestVersion !== serverMemberRequestVersionRef.current ||
        serverMembersServerIdRef.current !== serverId
      ) {
        return false
      }

      const members = reconcileServerMembersWithLatestPresence(
        page.items,
        presenceBoundary,
      )
      setServerMembers((current) => mergeServerMemberPages(current, members))
      serverMemberCursorRef.current = page.nextCursor
      setHasMoreServerMembers(page.nextCursor !== null)
      setServerMemberCount(page.totalCount)

      return members.length > 0
    } catch {
      return false
    } finally {
      if (
        requestVersion === serverMemberRequestVersionRef.current &&
        serverMembersServerIdRef.current === serverId
      ) {
        isLoadingMoreServerMembersRef.current = false
        setIsLoadingMoreServerMembers(false)
      }
    }
  }

  async function leaveServer(membership: ServerMemberResponse) {
    setIsMutatingServerMember(true)

    try {
      await apiNoContent(
        `/api/servers/${membership.serverId}/members/me`,
        {
          method: 'DELETE',
          accessToken,
        },
      )

      setServerMemberships((current) => {
        const nextMemberships = current.filter(
          (item) => item.serverId !== membership.serverId,
        )

        writeServerOrder(userId, nextMemberships)
        void writeUserDataCache(userId, 'serverMemberships', nextMemberships)

        return nextMemberships
      })

      if (selectedServerMembership?.serverId === membership.serverId) {
        serverMemberRequestVersionRef.current += 1
        serverMembersServerIdRef.current = null
        serverMemberCursorRef.current = null
        isLoadingMoreServerMembersRef.current = false
        setSelectedServerMembership(null)
        setServerMembers([])
        setServerMemberCount(0)
        setHasMoreServerMembers(false)
        setIsLoadingMoreServerMembers(false)
      }
    } finally {
      setIsMutatingServerMember(false)
    }
  }

  async function removeServerMember(member: ServerMemberDetailsResponse) {
    if (!selectedServerMembership) {
      return
    }

    setIsMutatingServerMember(true)

    try {
      await apiNoContent(
        `/api/servers/${selectedServerMembership.serverId}/members/${member.id}`,
        {
          method: 'DELETE',
          accessToken,
        },
      )

      setServerMembers((current) =>
        current.filter((item) => item.id !== member.id),
      )
      setServerMemberCount((current) => Math.max(0, current - 1))
    } finally {
      setIsMutatingServerMember(false)
    }
  }

  function updateServerMembership(server: ServerResponse) {
    setServerMemberships((current) =>
      current.map((membership) =>
        membership.serverId === server.id
          ? {
              ...membership,
              server,
              updatedAt: server.updatedAt,
            }
          : membership,
      ),
    )

    setSelectedServerMembership((current) =>
      current?.serverId === server.id
        ? {
            ...current,
            server,
            updatedAt: server.updatedAt,
          }
        : current,
    )
  }

  function reorderServerMemberships(activeServerId: string, overServerId: string) {
    setServerMemberships((current) => {
      const nextMemberships = moveServerMembership(
        current,
        activeServerId,
        overServerId,
      )

      if (nextMemberships === current) {
        return current
      }

      writeServerOrder(userId, nextMemberships)
      void writeUserDataCache(userId, 'serverMemberships', nextMemberships)

      return nextMemberships
    })
  }

  return {
    serverMemberships,
    setServerMemberships,
    selectedServerMembership,
    setSelectedServerMembership,
    serverMembers,
    setServerMembers,
    isLoadingServers,
    hasLoadedServers: loadedServersUserId === userId,
    isLoadingServerMembers,
    isLoadingMoreServerMembers,
    hasMoreServerMembers,
    serverMemberCount,
    isMutatingServerMember,
    loadServers,
    loadServerMembers,
    loadMoreServerMembers,
    leaveServer,
    removeServerMember,
    updateServerMembership,
    reorderServerMemberships,
  }
}
