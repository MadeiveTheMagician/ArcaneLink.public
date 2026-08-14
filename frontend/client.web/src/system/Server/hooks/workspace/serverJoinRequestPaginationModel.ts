import type { ServerJoinRequestResponse } from '../../../../shared/types'

export const serverJoinRequestPageSize = 100

export function mergeServerJoinRequestPages(
  current: ServerJoinRequestResponse[],
  next: ServerJoinRequestResponse[],
) {
  const seenRequestIds = new Set<string>()

  return [...current, ...next].filter((request) => {
    if (seenRequestIds.has(request.id)) {
      return false
    }

    seenRequestIds.add(request.id)
    return true
  })
}
