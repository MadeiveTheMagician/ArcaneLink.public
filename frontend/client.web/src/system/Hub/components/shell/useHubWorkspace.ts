import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import type {
  ServerMemberResponse,
  SpaceMessageResponse,
} from '../../../../shared/types'
import { useContextMenuDismiss } from '../../../shared/hooks/useContextMenuDismiss'
import {
  resolveMessageFocus,
  type MessageFocusRequest,
} from '../../../shared/messages/messageFocusModel'

export type HubWorkspace =
  | 'profile'
  | 'server'
  | 'servers'
  | 'friends'
  | 'invites'
  | 'private-space'

type ServerContextMenuState = {
  membership: ServerMemberResponse
  x: number
  y: number
}

type UseHubWorkspaceOptions = {
  serverMemberships: ServerMemberResponse[]
  loadServers: () => Promise<ServerMemberResponse[] | undefined>
  loadServerMembers: (membership: ServerMemberResponse) => Promise<void>
  leaveServer: (membership: ServerMemberResponse) => Promise<void>
  initialActiveWorkspace?: HubWorkspace
  initialActivePrivateSpaceId?: string | null
  initialIsServerPanelOpen?: boolean
  initialActiveServerId?: string | null
}

export function useHubWorkspace({
  serverMemberships,
  loadServers,
  loadServerMembers,
  leaveServer,
  initialActiveWorkspace = 'profile',
  initialActivePrivateSpaceId = null,
  initialIsServerPanelOpen = true,
  initialActiveServerId = null,
}: UseHubWorkspaceOptions) {
  const [isServerPanelOpen, setIsServerPanelOpen] = useState(
    initialIsServerPanelOpen,
  )
  const [activeWorkspace, setActiveWorkspace] =
    useState<HubWorkspace>(initialActiveWorkspace)
  const [activePrivateSpaceId, setActivePrivateSpaceId] = useState<string | null>(
    initialActivePrivateSpaceId,
  )
  const [focusedPrivateMessage, setFocusedPrivateMessage] =
    useState<MessageFocusRequest | null>(null)
  const [activeServerId, setActiveServerId] = useState<string | null>(
    initialActiveServerId,
  )
  const [serverContextMenu, setServerContextMenu] =
    useState<ServerContextMenuState | null>(null)

  const visibleServerMemberships = useMemo(
    () =>
      [...serverMemberships]
        .sort(
          (first, second) =>
            new Date(second.updatedAt).getTime() -
            new Date(first.updatedAt).getTime(),
        ),
    [serverMemberships],
  )

  useContextMenuDismiss(Boolean(serverContextMenu), () =>
    setServerContextMenu(null),
  )

  async function openServerWorkspace(membership: ServerMemberResponse) {
    setFocusedPrivateMessage(resolveMessageFocus({ kind: 'latest' }))
    setActiveServerId(membership.serverId)
    setActiveWorkspace('server')
    await loadServerMembers(membership)
  }

  function openServerContextMenu(
    event: MouseEvent<HTMLButtonElement>,
    membership: ServerMemberResponse,
  ) {
    event.preventDefault()
    event.stopPropagation()
    setServerContextMenu({
      membership,
      x: event.clientX,
      y: event.clientY,
    })
  }

  function toggleServerPanel() {
    setIsServerPanelOpen((current) => {
      const nextValue = !current

      if (nextValue) {
        void loadServers()
      }

      return nextValue
    })
  }

  function showProfileWorkspace() {
    setFocusedPrivateMessage(resolveMessageFocus({ kind: 'latest' }))
    setActivePrivateSpaceId(null)
    setActiveServerId(null)
    setActiveWorkspace('profile')
  }

  function showServersWorkspace() {
    setFocusedPrivateMessage(resolveMessageFocus({ kind: 'latest' }))
    setActivePrivateSpaceId(null)
    setActiveServerId(null)
    setActiveWorkspace('servers')
  }

  function showFriendsWorkspace() {
    setFocusedPrivateMessage(resolveMessageFocus({ kind: 'latest' }))
    setActivePrivateSpaceId(null)
    setActiveServerId(null)
    setActiveWorkspace('friends')
  }

  function showInvitesWorkspace() {
    setFocusedPrivateMessage(resolveMessageFocus({ kind: 'latest' }))
    setActivePrivateSpaceId(null)
    setActiveServerId(null)
    setActiveWorkspace('invites')
  }

  function openPrivateSpace(spaceId: string) {
    setFocusedPrivateMessage(resolveMessageFocus({ kind: 'latest' }))
    activatePrivateSpace(spaceId)
  }

  function openPrivateSearchResult(message: SpaceMessageResponse) {
    setFocusedPrivateMessage(
      resolveMessageFocus({ kind: 'search-result', message }),
    )
    activatePrivateSpace(message.spaceId)
  }

  function activatePrivateSpace(spaceId: string) {
    setActivePrivateSpaceId(spaceId)
    setActiveServerId(null)
    setActiveWorkspace('private-space')
  }

  function closeServerContextMenu() {
    setServerContextMenu(null)
  }

  function leaveServerFromContextMenu() {
    if (serverContextMenu) {
      void leaveServer(serverContextMenu.membership)
    }

    setServerContextMenu(null)
  }

  return {
    isServerPanelOpen,
    activeWorkspace,
    activeServerId,
    activePrivateSpaceId,
    focusedPrivateMessage,
    serverContextMenu,
    visibleServerMemberships,
    setIsServerPanelOpen,
    openServerWorkspace,
    openServerContextMenu,
    toggleServerPanel,
    showProfileWorkspace,
    showServersWorkspace,
    showFriendsWorkspace,
    showInvitesWorkspace,
    openPrivateSpace,
    openPrivateSearchResult,
    closeServerContextMenu,
    leaveServerFromContextMenu,
  }
}
