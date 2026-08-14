import type { PrivateSpaceResponse } from '../../../../shared/types'

type UserBlockStateChange = {
  userId: string
  isBlocked: boolean
}

export function patchPrivateSpacesPeerBlockState(
  spaces: PrivateSpaceResponse[],
  currentUserId: string,
  change: UserBlockStateChange,
) {
  let hasChanged = false
  const nextSpaces = spaces.map((space) => {
    const containsChangedPeer =
      space.kind === 'direct' &&
      change.userId !== currentUserId &&
      space.members.some((member) => member.userId === change.userId)

    if (
      !containsChangedPeer ||
      space.viewerSettings.isPeerBlocked === change.isBlocked
    ) {
      return space
    }

    hasChanged = true
    return {
      ...space,
      viewerSettings: {
        ...space.viewerSettings,
        isPeerBlocked: change.isBlocked,
      },
    }
  })

  return hasChanged ? nextSpaces : spaces
}
