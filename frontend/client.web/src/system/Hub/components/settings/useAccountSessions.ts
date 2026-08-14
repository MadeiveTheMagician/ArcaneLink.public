import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../../../../shared/api/api'
import type { UserDeviceSessionResponse } from '../../../../shared/types'
import { settingsCopy } from '../../../shared/copy/index'

type UseAccountSessionsOptions = {
  accessToken: string
  currentDeviceSessionId?: string | null
}

export function useAccountSessions({
  accessToken,
  currentDeviceSessionId,
}: UseAccountSessionsOptions) {
  const [sessions, setSessions] = useState<UserDeviceSessionResponse[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || sessions.length > 0 || isLoading) {
      return
    }

    let isDisposed = false

    async function loadSessions() {
      setIsLoading(true)
      setError(null)

      try {
        const data = await apiJson<UserDeviceSessionResponse[]>(
          '/api/auth/sessions',
          { accessToken },
        )

        if (!isDisposed) {
          setSessions(data)
        }
      } catch (requestError) {
        if (!isDisposed) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : settingsCopy.errors.loadSessions,
          )
        }
      } finally {
        if (!isDisposed) {
          setIsLoading(false)
        }
      }
    }

    void loadSessions()

    return () => {
      isDisposed = true
    }
  }, [accessToken, isLoading, isOpen, sessions.length])

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((first, second) => {
        const firstCurrent =
          first.isCurrent || first.id === currentDeviceSessionId
        const secondCurrent =
          second.isCurrent || second.id === currentDeviceSessionId

        if (firstCurrent !== secondCurrent) {
          return firstCurrent ? -1 : 1
        }

        return (
          new Date(second.lastUsedAt).getTime() -
          new Date(first.lastUsedAt).getTime()
        )
      }),
    [currentDeviceSessionId, sessions],
  )

  return {
    sessions: sortedSessions,
    isOpen,
    isLoading,
    error,
    toggle: () => setIsOpen((current) => !current),
  }
}
