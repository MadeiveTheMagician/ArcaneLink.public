import { apiJson } from '../../../../shared/api/api'
import type {
  ServerInviteResponse,
  ServerMemberResponse,
} from '../../../../shared/types'

type UseHubServerInvitesOptions = {
  accessToken: string
  loadDirectServerInvites: () => Promise<void>
}

export function useHubServerInvites({
  accessToken,
  loadDirectServerInvites,
}: UseHubServerInvitesOptions) {
  async function createDirectServerInviteForUser(
    serverId: string,
    targetUserId: string,
  ) {
    await apiJson<ServerInviteResponse>(`/api/servers/${serverId}/invites`, {
      method: 'POST',
      accessToken,
      body: {
        kindCode: 'direct',
        targetUserId,
      },
    })
    await loadDirectServerInvites()
  }

  async function loadInviteTargetServersForUser(targetUserId: string) {
    return await apiJson<ServerMemberResponse[]>(
      `/api/server-invites/target-servers/${targetUserId}`,
      { accessToken },
    )
  }

  return {
    createDirectServerInviteForUser,
    loadInviteTargetServersForUser,
  }
}
