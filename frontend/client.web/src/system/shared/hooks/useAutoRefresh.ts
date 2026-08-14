import { useEffect, useRef } from 'react'

type UseAutoRefreshOptions = {
  enabled?: boolean
  intervalMs: number
  onRefresh: () => Promise<void> | void
}

export function useAutoRefresh({
  enabled = true,
  intervalMs,
  onRefresh,
}: UseAutoRefreshOptions) {
  const refreshRef = useRef(onRefresh)
  const isRefreshingRef = useRef(false)

  useEffect(() => {
    refreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    async function refresh() {
      if (document.hidden || isRefreshingRef.current) {
        return
      }

      isRefreshingRef.current = true

      try {
        await refreshRef.current()
      } catch {
        // Background refresh is best-effort; visible flows surface their own errors.
      } finally {
        isRefreshingRef.current = false
      }
    }

    function refreshWhenVisible() {
      if (!document.hidden) {
        void refresh()
      }
    }

    const intervalId = window.setInterval(() => void refresh(), intervalMs)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [enabled, intervalMs])
}
