import { useState } from 'react'

export type FavoriteSpace = { serverId: string; spaceId: string }

function readFavorites(key: string): FavoriteSpace[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(stored)
      ? stored.filter((entry): entry is FavoriteSpace =>
          typeof entry?.serverId === 'string' && typeof entry?.spaceId === 'string')
      : []
  } catch {
    return []
  }
}

export function useFavoriteSpaces(userId: string) {
  const key = `arcanelink.favoriteSpaces.v1.${userId}`
  const [stored, setStored] = useState(() => ({ key, items: readFavorites(key) }))
  const items = stored.key === key ? stored.items : readFavorites(key)

  function toggle(target: FavoriteSpace) {
    const exists = items.some((item) =>
      item.serverId === target.serverId && item.spaceId === target.spaceId)
    const next = exists
      ? items.filter((item) => item.serverId !== target.serverId || item.spaceId !== target.spaceId)
      : [...items, target]
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Keep favorites usable during the session if storage is unavailable.
    }
    setStored({ key, items: next })
  }

  return { items, toggle }
}
