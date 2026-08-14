import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiJson } from '../../../shared/api/api'
import { createRealtimeRefreshCoalescer } from '../../shared/hooks/realtimeRefreshCoalescer'
import {
  isModerationEventForServer,
  moderationCaseChangedWindowEvent,
  type ModerationCaseChangedPayload,
} from '../../shared/moderation/moderationRealtime'
import { moderationCopy } from '../moderationCopy.ru'
import type {
  ModerationCaseCursorResponse,
  ModerationCaseDetailResponse,
  ModerationCasePageResponse,
  ModerationCaseStatus,
} from '../moderationTypes'
import {
  createModerationCaseListUrl,
  mergeModerationCasePages,
  replaceModerationCaseSummary,
  type ModerationCaseFilter,
} from '../models/moderationCaseModel'

export function useServerModeration({
  accessToken,
  serverId,
}: {
  accessToken: string
  serverId: string
}) {
  const [statusFilter, setStatusFilter] =
    useState<ModerationCaseFilter>('open')
  const [cases, setCases] =
    useState<ModerationCasePageResponse['items']>([])
  const [nextCursor, setNextCursor] =
    useState<ModerationCaseCursorResponse | null>(null)
  const [selectedCase, setSelectedCase] =
    useState<ModerationCaseDetailResponse | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [isLoadingCases, setIsLoadingCases] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isUpdatingCase, setIsUpdatingCase] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const nextCursorRef = useRef(nextCursor)
  const selectedCaseIdRef = useRef(selectedCaseId)
  const casesRef = useRef(cases)
  const selectedCaseRef = useRef(selectedCase)
  const listRequestIdRef = useRef(0)
  const detailRequestIdRef = useRef(0)
  const refreshSelectedCaseRef = useRef(false)

  useEffect(() => {
    nextCursorRef.current = nextCursor
  }, [nextCursor])

  useEffect(() => {
    selectedCaseIdRef.current = selectedCaseId
  }, [selectedCaseId])

  useEffect(() => {
    casesRef.current = cases
  }, [cases])

  useEffect(() => {
    selectedCaseRef.current = selectedCase
  }, [selectedCase])

  const loadCases = useCallback(
    async ({ append = false, silent = false } = {}) => {
      const cursor = append ? nextCursorRef.current : null
      if (append && !cursor) {
        return
      }

      const requestId = ++listRequestIdRef.current
      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoadingMore(false)
        if (!silent) {
          setIsLoadingCases(true)
        }
      }

      if (!silent) {
        setListError(null)
      }

      try {
        const page = await apiJson<ModerationCasePageResponse>(
          createModerationCaseListUrl({
            serverId,
            status: statusFilter,
            cursor,
          }),
          { accessToken },
        )

        if (requestId !== listRequestIdRef.current) {
          return
        }

        setCases((current) => {
          const nextCases = append
            ? mergeModerationCasePages(current, page)
            : page.items
          casesRef.current = nextCases
          return nextCases
        })
        setNextCursor(page.nextCursor)
        setListError(null)
      } catch (requestError) {
        if (
          requestId === listRequestIdRef.current &&
          (!silent || casesRef.current.length === 0)
        ) {
          setListError(
            requestError instanceof Error && requestError.message
              ? requestError.message
              : moderationCopy.cases.failed,
          )
        }
      } finally {
        if (requestId === listRequestIdRef.current) {
          if (append) {
            setIsLoadingMore(false)
          } else {
            setIsLoadingCases(false)
          }
        }
      }
    },
    [accessToken, serverId, statusFilter],
  )

  const loadCaseDetail = useCallback(
    async (caseId: string, silent = false) => {
      const requestId = ++detailRequestIdRef.current
      selectedCaseIdRef.current = caseId
      setSelectedCaseId(caseId)
      if (!silent) {
        setIsLoadingDetail(true)
        setDetailError(null)
      }

      try {
        const detail = await apiJson<ModerationCaseDetailResponse>(
          `/api/servers/${serverId}/moderation/cases/${caseId}`,
          { accessToken },
        )

        if (requestId === detailRequestIdRef.current) {
          selectedCaseRef.current = detail
          setSelectedCase(detail)
          setDetailError(null)
        }

        return detail
      } catch (requestError) {
        if (
          requestId === detailRequestIdRef.current &&
          (!silent || selectedCaseRef.current === null)
        ) {
          selectedCaseRef.current = null
          setSelectedCase(null)
          setDetailError(
            requestError instanceof Error && requestError.message
              ? requestError.message
              : moderationCopy.cases.detailFailed,
          )
        }
        return null
      } finally {
        if (requestId === detailRequestIdRef.current) {
          setIsLoadingDetail(false)
        }
      }
    },
    [accessToken, serverId],
  )

  useEffect(() => {
    setCases([])
    casesRef.current = []
    setNextCursor(null)
    nextCursorRef.current = null
    setSelectedCase(null)
    selectedCaseRef.current = null
    setSelectedCaseId(null)
    selectedCaseIdRef.current = null
    setUpdateError(null)
    void loadCases()

    return () => {
      listRequestIdRef.current += 1
      detailRequestIdRef.current += 1
    }
  }, [loadCases])

  useEffect(() => {
    const refresh = createRealtimeRefreshCoalescer(async () => {
      const shouldRefreshSelectedCase = refreshSelectedCaseRef.current
      refreshSelectedCaseRef.current = false
      await loadCases({ silent: true })
      const caseId = selectedCaseIdRef.current

      if (caseId && shouldRefreshSelectedCase) {
        await loadCaseDetail(caseId, true)
      }
    }, 120)

    function refreshFromRealtime(event: Event) {
      const payload = (
        event as CustomEvent<ModerationCaseChangedPayload | undefined>
      ).detail

      if (isModerationEventForServer(payload, serverId)) {
        const selectedCaseId = selectedCaseIdRef.current
        refreshSelectedCaseRef.current ||= Boolean(
          selectedCaseId &&
            (!payload?.caseId ||
              payload.caseId.toLowerCase() === selectedCaseId.toLowerCase()),
        )
        refresh.request()
      }
    }

    window.addEventListener(
      moderationCaseChangedWindowEvent,
      refreshFromRealtime,
    )

    return () => {
      refresh.dispose()
      window.removeEventListener(
        moderationCaseChangedWindowEvent,
        refreshFromRealtime,
      )
    }
  }, [loadCaseDetail, loadCases, serverId])

  async function updateCase(
    status: ModerationCaseStatus,
    note: string,
  ) {
    if (!selectedCase) {
      return false
    }

    setIsUpdatingCase(true)
    setUpdateError(null)

    try {
      const updated = await apiJson<ModerationCaseDetailResponse>(
        `/api/servers/${serverId}/moderation/cases/${selectedCase.caseId}`,
        {
          method: 'PATCH',
          accessToken,
          body: {
            status,
            note: note.trim() || null,
            expectedUpdatedAt: selectedCase.updatedAt,
          },
        },
      )

      selectedCaseRef.current = updated
      setSelectedCase(updated)
      setCases((current) => {
        const updatedCases = replaceModerationCaseSummary(current, updated)

        const nextCases = statusFilter === 'all' || statusFilter === updated.status
          ? updatedCases
          : updatedCases.filter(
              (item) =>
                item.caseId.toLowerCase() !== updated.caseId.toLowerCase(),
            )
        casesRef.current = nextCases
        return nextCases
      })
      return true
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        setUpdateError(moderationCopy.cases.conflict)
        await Promise.all([
          loadCases({ silent: true }),
          loadCaseDetail(selectedCase.caseId, true),
        ])
      } else {
        setUpdateError(
          requestError instanceof Error && requestError.message
            ? requestError.message
            : moderationCopy.cases.updateFailed,
        )
      }
      return false
    } finally {
      setIsUpdatingCase(false)
    }
  }

  function closeCase() {
    detailRequestIdRef.current += 1
    selectedCaseIdRef.current = null
    selectedCaseRef.current = null
    setSelectedCase(null)
    setSelectedCaseId(null)
    setDetailError(null)
    setUpdateError(null)
  }

  return {
    cases,
    nextCursor,
    selectedCase,
    selectedCaseId,
    statusFilter,
    isLoadingCases,
    isLoadingMore,
    isLoadingDetail,
    isUpdatingCase,
    listError,
    detailError,
    updateError,
    setStatusFilter,
    loadCases,
    loadCaseDetail,
    updateCase,
    closeCase,
  }
}
