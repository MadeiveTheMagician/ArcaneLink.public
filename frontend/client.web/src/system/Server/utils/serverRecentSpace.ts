import type { SpaceResponse } from '../../../shared/types'
import { toChannelDetail, type ServerDetail } from './serverWorkspaceModel'

const recentServerSpaceStorageKey = 'arcanelink.server-recent-space.v1'
export const recentServerSpaceLifetimeMs = 60 * 60 * 1000

type RecentServerSpaceEntry = {
  detailType: 'overview' | 'channel'
  spaceId: string | null
  visitedAt: number
}

type RecentServerSpaceStorage = Record<string, RecentServerSpaceEntry>

function getSessionStorage() {
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function readStorage(storage: Storage): RecentServerSpaceStorage {
  try {
    const value = JSON.parse(storage.getItem(recentServerSpaceStorageKey) ?? '{}')
    return value && typeof value === 'object'
      ? value as RecentServerSpaceStorage
      : {}
  } catch {
    return {}
  }
}

function writeStorage(storage: Storage, value: RecentServerSpaceStorage) {
  try {
    storage.setItem(recentServerSpaceStorageKey, JSON.stringify(value))
  } catch {
    // Session history is an optional navigation enhancement.
  }
}

export function rememberRecentServerDetail(
  serverId: string,
  detail: ServerDetail,
  now = Date.now(),
  storage = getSessionStorage(),
) {
  if (!storage) return

  const snapshot = readStorage(storage)
  snapshot[serverId] = {
    detailType: detail.type,
    spaceId: detail.type === 'channel' ? detail.spaceId : null,
    visitedAt: now,
  }
  writeStorage(storage, snapshot)
}

export function getRecentServerDetail(
  serverId: string,
  spaces: SpaceResponse[],
  now = Date.now(),
  storage = getSessionStorage(),
): ServerDetail | null {
  if (!storage) return null

  const snapshot = readStorage(storage)
  const entry = snapshot[serverId]
  if (!entry) return null

  if (
    !Number.isFinite(entry.visitedAt) ||
    now - entry.visitedAt > recentServerSpaceLifetimeMs
  ) {
    delete snapshot[serverId]
    writeStorage(storage, snapshot)
    return null
  }

  if (entry.detailType === 'overview') {
    return { type: 'overview' }
  }

  const space = spaces.find(
    (item) => item.id === entry.spaceId && item.typeCode !== 'category',
  )
  return space ? toChannelDetail(space) : null
}
