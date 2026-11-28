import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ServerMemberResponse } from '../../../../shared/types'
import {
  loadServerRailLayout,
  reconcileServerRailLayout,
  saveServerRailLayout,
} from '../../components/navigation/serverRailFolders'
import type { ServerRailLayout } from '../../components/navigation/serverRailFolders'

export function useServerRailLayout(
  userId: string,
  memberships: readonly Pick<ServerMemberResponse, 'serverId'>[],
  hasLoadedServers: boolean,
) {
  const [snapshot, setSnapshot] = useState(() => ({
    userId,
    layout: loadServerRailLayout(userId),
  }))
  const isCurrentAccount = snapshot.userId === userId
  const savedLayout = isCurrentAccount ? snapshot.layout : loadServerRailLayout(userId)
  const orderedServerIds = useMemo(
    () => memberships.map((membership) => membership.serverId),
    [memberships],
  )
  const serverLayout = useMemo(
    () => reconcileServerRailLayout(savedLayout, orderedServerIds),
    [savedLayout, orderedServerIds],
  )

  if (!isCurrentAccount || (hasLoadedServers && serverLayout !== snapshot.layout)) {
    setSnapshot({ userId, layout: hasLoadedServers ? serverLayout : savedLayout })
  }

  useEffect(() => {
    if (hasLoadedServers && snapshot.userId === userId) {
      saveServerRailLayout(userId, snapshot.layout)
    }
  }, [hasLoadedServers, snapshot, userId])

  const updateServerLayout = useCallback((layout: ServerRailLayout) => {
    if (hasLoadedServers) {
      setSnapshot({ userId, layout: reconcileServerRailLayout(layout, orderedServerIds) })
    }
  }, [hasLoadedServers, orderedServerIds, userId])

  return { serverLayout, updateServerLayout }
}
