import { useEffect, useRef, useState } from 'react'
import type { SpaceResponse } from '../../../../shared/types'
import {
  getAncestorCategoryIds,
  toChannelDetail,
  type ServerDetail,
} from '../../utils/serverWorkspaceModel'
import {
  getRecentServerDetail,
  rememberRecentServerDetail,
} from '../../utils/serverRecentSpace'

type UseServerWorkspaceSelectionOptions = {
  activeDetail: ServerDetail | null
  autoSelectDefaultDetail?: boolean
  isLoadingSpaces: boolean
  serverId: string
  serverDefaultTextSpaceId: string | null
  serverSpaces: SpaceResponse[]
  textSpaces: SpaceResponse[]
  visibleDetail: ServerDetail | null
  onSetActiveDetail: (detail: ServerDetail | null) => void
}

export function useServerWorkspaceSelection({
  activeDetail,
  autoSelectDefaultDetail = true,
  isLoadingSpaces,
  serverId,
  serverDefaultTextSpaceId,
  serverSpaces,
  textSpaces,
  visibleDetail,
  onSetActiveDetail,
}: UseServerWorkspaceSelectionOptions) {
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(
    () => new Set(),
  )
  const initializedServerIdRef = useRef<string | null>(null)

  useEffect(() => {
    setCollapsedCategoryIds((current) => {
      const liveCategoryIds = new Set(
        serverSpaces
          .filter((space) => space.typeCode === 'category')
          .map((space) => space.id),
      )
      const next = new Set(
        [...current].filter((categoryId) => liveCategoryIds.has(categoryId)),
      )
      const isSameSet =
        next.size === current.size &&
        [...next].every((categoryId) => current.has(categoryId))

      return isSameSet ? current : next
    })
  }, [serverSpaces])

  useEffect(() => {
    if (visibleDetail?.type !== 'channel' || !visibleDetail.spaceId) {
      return
    }

    const selectedSpace = serverSpaces.find(
      (space) => space.id === visibleDetail.spaceId,
    )
    const ancestorIds = getAncestorCategoryIds(selectedSpace, serverSpaces)

    if (ancestorIds.length === 0) {
      return
    }

    setCollapsedCategoryIds((current) => {
      if (ancestorIds.every((categoryId) => !current.has(categoryId))) {
        return current
      }

      const next = new Set(current)
      ancestorIds.forEach((categoryId) => next.delete(categoryId))
      return next
    })
  }, [serverSpaces, visibleDetail])

  useEffect(() => {
    if (isLoadingSpaces) {
      return
    }

    const isEnteringServer = initializedServerIdRef.current !== serverId

    const selectedChannelMissing =
      activeDetail?.type === 'channel' &&
      activeDetail.spaceId !== null &&
      !serverSpaces.some((space) => space.id === activeDetail.spaceId)

    if (!isEnteringServer && activeDetail && !selectedChannelMissing) {
      return
    }

    if (!isEnteringServer && !selectedChannelMissing) {
      return
    }

    initializedServerIdRef.current = serverId

    if (!autoSelectDefaultDetail) {
      if (selectedChannelMissing) {
        onSetActiveDetail(null)
      }

      return
    }

    const recentDetail = getRecentServerDetail(serverId, serverSpaces)
    if (recentDetail) {
      onSetActiveDetail(recentDetail)
      return
    }

    const defaultTextSpace = serverDefaultTextSpaceId
      ? textSpaces.find((space) => space.id === serverDefaultTextSpaceId)
      : null

    if (defaultTextSpace) {
      const defaultDetail = toChannelDetail(defaultTextSpace)
      rememberRecentServerDetail(serverId, defaultDetail)
      onSetActiveDetail(defaultDetail)
      return
    }

    const overviewDetail = { type: 'overview' } as const
    rememberRecentServerDetail(serverId, overviewDetail)
    onSetActiveDetail(overviewDetail)
  }, [
    activeDetail,
    autoSelectDefaultDetail,
    isLoadingSpaces,
    onSetActiveDetail,
    serverDefaultTextSpaceId,
    serverId,
    serverSpaces,
    textSpaces,
  ])

  function toggleCategory(spaceId: string) {
    setCollapsedCategoryIds((current) => {
      const next = new Set(current)

      if (next.has(spaceId)) {
        next.delete(spaceId)
      } else {
        next.add(spaceId)
      }

      return next
    })
  }

  return {
    collapsedCategoryIds,
    toggleCategory,
  }
}
