import type { ServerMemberResponse } from '../../../shared/types'

export async function openServerSettingsForMembership({
  membership,
  selectedServerId,
  selectServer,
  openSettings,
}: {
  membership: ServerMemberResponse
  selectedServerId: string | null
  selectServer: (membership: ServerMemberResponse) => Promise<void>
  openSettings: () => void
}) {
  if (selectedServerId !== membership.serverId) {
    try {
      await selectServer(membership)
    } catch {
      return false
    }
  }

  openSettings()
  return true
}
