import type {
  FriendRequestResponse,
  PrivateSpaceResponse,
  ServerMemberResponse,
  UserFriendResponse,
  UserProfileSettingsResponse,
} from '../types'

const layoutCacheVersion = 1
export const userDataCacheVersion = 2
const dataCacheVersion = userDataCacheVersion
const layoutCacheTtlMs = 14 * 24 * 60 * 60 * 1000
const dataCacheTtlMs = 24 * 60 * 60 * 1000
const dataCacheDbName = 'arcanelink-client-cache'
const dataCacheStoreName = 'snapshots'

export type LayoutCacheWorkspace =
  | 'profile'
  | 'server'
  | 'servers'
  | 'friends'
  | 'invites'
  | 'private-space'

export type LayoutCacheMobileTab = 'servers' | 'messages' | 'profile' | 'menu'

export type LayoutCachePanelWidths = {
  sidePanelWidth: number
  memberPanelWidth: number
}

export type LayoutCacheSnapshot = {
  version: number
  userId: string
  updatedAt: number
  activeWorkspace: LayoutCacheWorkspace
  activeServerId: string | null
  activePrivateSpaceId: string | null
  isServerPanelOpen: boolean
  mobileTab: LayoutCacheMobileTab
  panelWidths: LayoutCachePanelWidths
  profileSettings: Pick<
    UserProfileSettingsResponse,
    | 'interfaceScale'
    | 'fontScale'
    | 'serverInterfaceScale'
    | 'isServerRailPinned'
    | 'showPrivateReadAllButton'
    | 'serverMessageDisplayFormat'
    | 'privateMessageDisplayFormat'
    | 'serverMessageBubbleAlignment'
    | 'privateMessageBubbleAlignment'
    | 'serverMessageBubbleWidth'
    | 'privateMessageBubbleWidth'
    | 'expandMessageAttachmentsByDefault'
    | 'loadExternalMediaPreviews'
    | 'horizontalVideoCardSize'
    | 'verticalVideoCardSize'
    | 'selectedThemeCode'
    | 'profileColor'
    | 'profileBackgroundAssetId'
    | 'applySystemThemeToOtherProfiles'
  >
}

export type FriendsCacheSnapshot = {
  friends: UserFriendResponse[]
  incomingRequests: FriendRequestResponse[]
  outgoingRequests: FriendRequestResponse[]
}

export type UserDataCacheKey = 'serverMemberships' | 'friends' | 'privateSpaces'

type DataCacheValueByKey = {
  serverMemberships: ServerMemberResponse[]
  friends: FriendsCacheSnapshot
  privateSpaces: PrivateSpaceResponse[]
}

type DataCacheRecord<T> = {
  key: string
  version: number
  updatedAt: number
  value: T
}

function getLayoutCacheKey(userId: string) {
  return `arcanelink.layoutCache.v${layoutCacheVersion}.${userId}`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFresh(updatedAt: unknown, ttlMs: number) {
  return (
    typeof updatedAt === 'number' &&
    Number.isFinite(updatedAt) &&
    Date.now() - updatedAt <= ttlMs
  )
}

export function isUserDataCacheRecordCompatible(
  record: unknown,
  now = Date.now(),
) {
  if (!isObject(record) || !('value' in record)) {
    return false
  }

  return (
    record.version === userDataCacheVersion &&
    typeof record.updatedAt === 'number' &&
    Number.isFinite(record.updatedAt) &&
    now - record.updatedAt <= dataCacheTtlMs
  )
}

export function readLayoutCache(userId: string): LayoutCacheSnapshot | null {
  try {
    const raw = window.localStorage.getItem(getLayoutCacheKey(userId))
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown
    if (
      !isObject(parsed) ||
      parsed.version !== layoutCacheVersion ||
      parsed.userId !== userId ||
      !isFresh(parsed.updatedAt, layoutCacheTtlMs)
    ) {
      return null
    }

    return parsed as LayoutCacheSnapshot
  } catch {
    return null
  }
}

export function writeLayoutCache(
  userId: string,
  snapshot: Omit<LayoutCacheSnapshot, 'version' | 'userId' | 'updatedAt'>,
) {
  try {
    window.localStorage.setItem(
      getLayoutCacheKey(userId),
      JSON.stringify({
        ...snapshot,
        version: layoutCacheVersion,
        userId,
        updatedAt: Date.now(),
      }),
    )
  } catch {
    // Best-effort UI cache; storage quota or privacy mode should not break app use.
  }
}

function getDataCacheKey(userId: string, key: UserDataCacheKey) {
  return `${userId}:${key}`
}

function openDataCacheDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(dataCacheDbName, dataCacheVersion)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(dataCacheStoreName)) {
        db.createObjectStore(dataCacheStoreName, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withDataCacheStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDataCacheDb()

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(dataCacheStoreName, mode)
      const request = run(transaction.objectStore(dataCacheStoreName))

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export async function readUserDataCache<K extends UserDataCacheKey>(
  userId: string,
  key: K,
): Promise<DataCacheValueByKey[K] | null> {
  if (!window.indexedDB) {
    return null
  }

  try {
    const record = await withDataCacheStore<DataCacheRecord<DataCacheValueByKey[K]> | undefined>(
      'readonly',
      (store) => store.get(getDataCacheKey(userId, key)),
    )

    if (!record || !isUserDataCacheRecordCompatible(record)) {
      return null
    }

    return record.value
  } catch {
    return null
  }
}

export async function writeUserDataCache<K extends UserDataCacheKey>(
  userId: string,
  key: K,
  value: DataCacheValueByKey[K],
) {
  if (!window.indexedDB) {
    return
  }

  try {
    await withDataCacheStore<IDBValidKey>('readwrite', (store) =>
      store.put({
        key: getDataCacheKey(userId, key),
        version: dataCacheVersion,
        updatedAt: Date.now(),
        value,
      }),
    )
  } catch {
    // Cached data is optional and must never make a fresh network path fail.
  }
}

export async function clearUserDataCache(userId: string) {
  if (!window.indexedDB) {
    return
  }

  await Promise.all(
    (['serverMemberships', 'friends', 'privateSpaces'] as const).map((key) =>
      withDataCacheStore<undefined>('readwrite', (store) =>
        store.delete(getDataCacheKey(userId, key)),
      ).catch(() => undefined),
    ),
  )
}
