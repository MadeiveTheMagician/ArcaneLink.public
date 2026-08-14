import type { ServerMemberResponse } from '../../../../shared/types'
import type { ServerCoreTab } from '../../../Server/utils/serverWorkspaceModel'
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh'
import { useRealtime } from '../../../shared/hooks/useRealtime'

type UseHubRealtimeSyncOptions = {
  accessToken: string
  currentUserId: string
  currentDeviceSessionId?: string | null
  selectedServerMembership: ServerMemberResponse | null
  activeWorkspace: string
  serverCoreTab: ServerCoreTab
  avatarLibraryIsOpen: boolean
  serverIconLibraryIsOpen: boolean
  loadServers: (silent?: boolean) => Promise<ServerMemberResponse[] | undefined>
  loadServerMembers: (
    membership: ServerMemberResponse,
    silent?: boolean,
  ) => Promise<void>
  loadServerGovernance: (
    tab?: ServerCoreTab,
    silent?: boolean,
  ) => Promise<void>
  loadServerSpaces: (silent?: boolean) => Promise<void>
  loadPrivateSpaces: (silent?: boolean) => Promise<void>
  loadFriends: (silent?: boolean) => Promise<void>
  loadDirectServerInvites: (silent?: boolean) => Promise<void>
  loadPublicProfile: () => Promise<void>
  loadCurrentUser: () => Promise<void>
  loadProfileSettings: (silent?: boolean) => Promise<void>
  loadAvatarAssets: () => Promise<void>
  loadServerIconAssets: () => Promise<void>
  onCurrentSessionRevoked: () => Promise<void>
}

export function useHubRealtimeSync({
  accessToken,
  currentUserId,
  currentDeviceSessionId,
  selectedServerMembership,
  activeWorkspace,
  serverCoreTab,
  avatarLibraryIsOpen,
  serverIconLibraryIsOpen,
  loadServers,
  loadServerMembers,
  loadServerGovernance,
  loadServerSpaces,
  loadPrivateSpaces,
  loadFriends,
  loadDirectServerInvites,
  loadPublicProfile,
  loadCurrentUser,
  loadProfileSettings,
  loadAvatarAssets,
  loadServerIconAssets,
  onCurrentSessionRevoked,
}: UseHubRealtimeSyncOptions) {
  useAutoRefresh({
    intervalMs: 90000,
    onRefresh: async () => {
      await Promise.all([
        loadServers(true),
        loadFriends(true),
        loadPrivateSpaces(true),
        loadDirectServerInvites(true),
        selectedServerMembership && activeWorkspace === 'server'
          ? loadServerMembers(selectedServerMembership, true)
          : Promise.resolve(),
        selectedServerMembership && activeWorkspace === 'server'
          ? loadServerGovernance(serverCoreTab, true)
          : Promise.resolve(),
        selectedServerMembership && activeWorkspace === 'server'
          ? loadServerSpaces(true)
          : Promise.resolve(),
      ])
    },
  })

  useRealtime({
    accessToken,
    currentUserId,
    currentDeviceSessionId,
    selectedServerId: selectedServerMembership?.serverId ?? null,
    onFriendsChanged: () => loadFriends(true),
    onPrivateSpacesChanged: () => loadPrivateSpaces(true),
    onDirectServerInvitesChanged: () => loadDirectServerInvites(true),
    onServersChanged: async () => {
      await loadServers(true)
    },
    onCurrentServerMembersChanged: () =>
      selectedServerMembership
        ? loadServerMembers(selectedServerMembership, true)
        : undefined,
    onCurrentServerGovernanceChanged: () =>
      selectedServerMembership
        ? loadServerGovernance(serverCoreTab, true)
        : undefined,
    onCurrentServerSpacesChanged: () =>
      selectedServerMembership ? loadServerSpaces(true) : undefined,
    onUserProfileChanged: async () => {
      await Promise.all([loadPublicProfile(), loadCurrentUser()])
    },
    onUserProfileSettingsChanged: () => loadProfileSettings(true),
    onUserAssetsChanged: async () => {
      await Promise.all([
        avatarLibraryIsOpen ? loadAvatarAssets() : Promise.resolve(),
        serverIconLibraryIsOpen ? loadServerIconAssets() : Promise.resolve(),
      ])
    },
    onCurrentSessionRevoked,
  })
}
