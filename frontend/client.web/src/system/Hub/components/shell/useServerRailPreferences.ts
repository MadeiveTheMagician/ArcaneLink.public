import { useEffect, useState } from 'react'

export const maxServerRailColumns = 4

type ServerRailPreferences = {
  resizeEnabled: boolean
  columnCount: number
}

const defaultPreferences: ServerRailPreferences = {
  resizeEnabled: true,
  columnCount: 1,
}

function clampServerRailColumns(columns: number) {
  return Math.min(maxServerRailColumns, Math.max(1, Math.round(columns)))
}

function readPreferences(key: string): ServerRailPreferences {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return defaultPreferences

    const stored = JSON.parse(raw) as Partial<ServerRailPreferences> | null
    return {
      resizeEnabled: stored?.resizeEnabled !== false,
      columnCount:
        typeof stored?.columnCount === 'number' && Number.isFinite(stored.columnCount)
          ? clampServerRailColumns(stored.columnCount)
          : defaultPreferences.columnCount,
    }
  } catch {
    return defaultPreferences
  }
}

export function useServerRailPreferences(userId: string) {
  const key = `arcanelink.serverRailPreferences.v1.${userId}`
  const [preferences, setPreferences] = useState(() => readPreferences(key))

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(preferences))
    } catch {
      // The layout remains usable when browser storage is unavailable.
    }
  }, [key, preferences])

  function setResizeEnabled(resizeEnabled: boolean) {
    setPreferences((current) =>
      current.resizeEnabled === resizeEnabled ? current : { ...current, resizeEnabled },
    )
  }

  function setColumnCount(columnCount: number) {
    const next = clampServerRailColumns(columnCount)
    setPreferences((current) =>
      current.columnCount === next ? current : { ...current, columnCount: next },
    )
  }

  return {
    resizeEnabled: preferences.resizeEnabled,
    columnCount: preferences.resizeEnabled ? preferences.columnCount : 1,
    setResizeEnabled,
    setColumnCount,
  }
}
