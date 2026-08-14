import type { HubWorkspace } from './useHubWorkspace'

type WorkspaceTransitionKeyOptions = {
  activeWorkspace: HubWorkspace
  activeServerId: string | null
  activePrivateSpaceId: string | null
}

export function resolveWorkspaceTransitionKey({
  activeWorkspace,
  activeServerId,
  activePrivateSpaceId,
}: WorkspaceTransitionKeyOptions) {
  if (activeWorkspace === 'server') {
    return `server:${activeServerId ?? 'none'}`
  }

  if (activeWorkspace === 'private-space') {
    return `private-space:${activePrivateSpaceId ?? 'none'}`
  }

  return activeWorkspace
}
