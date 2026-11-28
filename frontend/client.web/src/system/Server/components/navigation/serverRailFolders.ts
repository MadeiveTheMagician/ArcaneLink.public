import { normalizeHexColor } from '../../../shared/ui/hexColor'

export type ServerRailServerEntry = { kind: 'server'; id: string }

export type ServerRailFolderEntry = {
  kind: 'folder'
  id: string
  name: string
  color: string
  serverIds: string[]
}

export type ServerRailEntry = ServerRailServerEntry | ServerRailFolderEntry
export type ServerRailLayout = ServerRailEntry[]
export type ServerRailItemRef = Pick<ServerRailEntry, 'kind' | 'id'>

export type ServerRailDropTarget =
  | (ServerRailItemRef & { placement: 'before' | 'after' | 'inside' })
  | { kind: 'end' }

type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
type NewServerRailFolder = Pick<ServerRailFolderEntry, 'id' | 'name'> & {
  color?: string
}

export const defaultServerRailFolderColor = '#5865f2'
export const maxServerRailFolderNameLength = 64

function makeServerEntry(id: string): ServerRailServerEntry {
  return { kind: 'server', id }
}

export function reconcileServerRailLayout(
  layout: ServerRailLayout,
  orderedServerIds: readonly string[],
): ServerRailLayout {
  const available = new Set(orderedServerIds.filter(isId))
  const next = pruneLayout(layout, available)
  const existing = new Set(
    next.flatMap((entry) => entry.kind === 'folder' ? entry.serverIds : [entry.id]),
  )
  const missing = [...available].filter((id) => !existing.has(id))
  return missing.length > 0 ? [...next, ...missing.map(makeServerEntry)] : next
}

export function applyServerRailDrop(
  layout: ServerRailLayout,
  source: ServerRailItemRef,
  target: ServerRailDropTarget,
  newFolder?: NewServerRailFolder,
): ServerRailLayout {
  if (source.kind === target.kind && source.id === target.id) {
    return layout
  }

  const origin = findItem(layout, source)
  const destination = target.kind === 'end' ? null : findItem(layout, target)
  if (!origin || (target.kind !== 'end' && !destination)) {
    return layout
  }

  if (source.kind === 'folder') {
    if (target.kind !== 'end' && (target.placement === 'inside' || destination?.entry === origin.entry)) {
      return layout
    }

    const next = layout.filter((entry) => entry !== origin.entry)
    return insertAtRailTarget(next, origin.entry, target)
  }

  const movingServer = makeServerEntry(source.id)
  if (
    target.kind === 'server' &&
    target.placement === 'inside' &&
    destination?.entry.kind === 'server'
  ) {
    const name = normalizeName(newFolder?.name)
    if (!newFolder || !isId(newFolder.id) || !name || layout.some(
      (entry) => entry.kind === 'folder' && entry.id === newFolder.id,
    )) {
      return layout
    }

    const folder: ServerRailFolderEntry = {
      kind: 'folder',
      id: newFolder.id,
      name,
      color: normalizeHexColor(newFolder.color) ?? defaultServerRailFolderColor,
      serverIds: [target.id, source.id],
    }
    return removeServer(layout, source.id).map((entry) =>
      entry === destination.entry ? folder : entry,
    )
  }

  if (target.kind === 'folder' && destination?.entry === origin.entry &&
      origin.entry.kind === 'folder' && origin.entry.serverIds.length === 1) {
    return target.placement === 'inside'
      ? layout
      : dissolveServerRailFolder(layout, target.id)
  }

  const next = removeServer(layout, source.id)
  if (target.kind === 'end' || !destination) {
    return [...next, movingServer]
  }

  const targetFolder = destination.entry.kind === 'folder' ? destination.entry : null
  if (targetFolder && (target.kind === 'server' || target.placement === 'inside')) {
    return next.map((entry) => {
      if (entry.kind !== 'folder' || entry.id !== targetFolder.id) {
        return entry
      }
      if (target.kind === 'folder') {
        return { ...entry, serverIds: [...entry.serverIds, source.id] }
      }

      const serverIds = [...entry.serverIds]
      const insertionIndex = serverIds.indexOf(target.id) + (target.placement === 'before' ? 0 : 1)
      serverIds.splice(insertionIndex, 0, source.id)
      return { ...entry, serverIds }
    })
  }

  return insertAtRailTarget(next, movingServer, target)
}

export function updateServerRailFolder(
  layout: ServerRailLayout,
  folderId: string,
  patch: Partial<Pick<ServerRailFolderEntry, 'name' | 'color'>>,
): ServerRailLayout {
  const folder = layout.find((entry): entry is ServerRailFolderEntry =>
    entry.kind === 'folder' && entry.id === folderId,
  )
  if (!folder) {
    return layout
  }

  const name = normalizeName(patch.name) || folder.name
  const color = normalizeHexColor(patch.color) ?? folder.color
  if (name === folder.name && color === folder.color) {
    return layout
  }
  return layout.map((entry) => entry === folder ? { ...folder, name, color } : entry)
}

export function dissolveServerRailFolder(
  layout: ServerRailLayout,
  folderId: string,
): ServerRailLayout {
  if (!layout.some((entry) => entry.kind === 'folder' && entry.id === folderId)) {
    return layout
  }
  return layout.flatMap<ServerRailEntry>((entry) =>
    entry.kind === 'folder' && entry.id === folderId
      ? entry.serverIds.map(makeServerEntry)
      : [entry],
  )
}

export function loadServerRailLayout(userId: string, storage?: StorageAccess): ServerRailLayout {
  const key = getServerRailLayoutKey(userId)
  if (!key) {
    return []
  }

  try {
    const raw = (storage ?? window.localStorage).getItem(key)
    return raw ? normalizeLayout(JSON.parse(raw) as unknown) : []
  } catch {
    return []
  }
}

export function saveServerRailLayout(
  userId: string,
  layout: ServerRailLayout,
  storage?: StorageAccess,
) {
  const key = getServerRailLayoutKey(userId)
  if (!key) {
    return
  }

  try {
    const target = storage ?? window.localStorage
    target.setItem(key, JSON.stringify(normalizeLayout(layout)))
  } catch {
    // The in-memory layout remains available when browser storage is blocked.
  }
}

function getServerRailLayoutKey(userId: string) {
  const accountId = userId.trim().toLowerCase()
  return accountId ? `arcanelink.serverRailLayout.v1.${accountId}` : null
}

function findItem(layout: ServerRailLayout, item: ServerRailItemRef) {
  const index = layout.findIndex((entry) =>
    (entry.kind === item.kind && entry.id === item.id) ||
    (item.kind === 'server' && entry.kind === 'folder' && entry.serverIds.includes(item.id)),
  )
  return index >= 0 ? { index, entry: layout[index] } : null
}

function insertAtRailTarget(
  layout: ServerRailLayout,
  entry: ServerRailEntry,
  target: ServerRailDropTarget,
) {
  if (target.kind === 'end') {
    return [...layout, entry]
  }

  const destination = findItem(layout, target)
  if (!destination) {
    return layout
  }
  const next = [...layout]
  const insertionIndex = destination.index + (target.placement === 'before' ? 0 : 1)
  next.splice(insertionIndex, 0, entry)
  return next
}

function removeServer(layout: ServerRailLayout, serverId: string): ServerRailLayout {
  return layout.flatMap<ServerRailEntry>((entry) => {
    if (entry.kind === 'server') {
      return entry.id === serverId ? [] : [entry]
    }

    const serverIds = entry.serverIds.filter((id) => id !== serverId)
    if (serverIds.length === entry.serverIds.length) {
      return [entry]
    }
    return serverIds.length > 0 ? [{ ...entry, serverIds }] : []
  })
}

function pruneLayout(layout: ServerRailLayout, available?: ReadonlySet<string>): ServerRailLayout {
  const owned = new Set<string>()
  const folders = new Set<string>()

  function takeServer(id: string) {
    if (owned.has(id) || (available && !available.has(id))) {
      return false
    }
    owned.add(id)
    return true
  }

  const next = layout.flatMap<ServerRailEntry>((entry) => {
    if (entry.kind === 'server') {
      return takeServer(entry.id) ? [entry] : []
    }
    if (folders.has(entry.id)) {
      return []
    }
    const serverIds = entry.serverIds.filter(takeServer)
    if (serverIds.length === 0) {
      return []
    }
    folders.add(entry.id)
    return [serverIds.length === entry.serverIds.length ? entry : { ...entry, serverIds }]
  })

  return next.length === layout.length && next.every((entry, index) => entry === layout[index])
    ? layout
    : next
}

function normalizeLayout(value: unknown): ServerRailLayout {
  if (!Array.isArray(value)) {
    return []
  }

  return pruneLayout(value.flatMap<ServerRailEntry>((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || !('id' in entry) || !isId(entry.id)) {
      return []
    }
    if ('kind' in entry && entry.kind === 'server') {
      return [makeServerEntry(entry.id)]
    }
    if (!('kind' in entry) || entry.kind !== 'folder' || !('serverIds' in entry) ||
        !Array.isArray(entry.serverIds)) {
      return []
    }

    return [{
      kind: 'folder',
      id: entry.id,
      name: normalizeName('name' in entry ? entry.name : undefined),
      color: normalizeHexColor('color' in entry ? entry.color : undefined) ?? defaultServerRailFolderColor,
      serverIds: entry.serverIds.filter(isId),
    }]
  }))
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, maxServerRailFolderNameLength) : ''
}
