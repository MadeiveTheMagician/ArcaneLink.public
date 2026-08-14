import type {
  ReorderSpacesRequest,
  SpaceResponse,
} from '../../../shared/types'

type SpaceCapabilityTarget =
  | Pick<SpaceResponse, 'effectiveCapabilities'>
  | null
  | undefined

export function canSendMessagesToSpace(space: SpaceCapabilityTarget) {
  return Boolean(space?.effectiveCapabilities.canSendMessages)
}

export function canConnectToVoiceSpace(space: SpaceCapabilityTarget) {
  return Boolean(space?.effectiveCapabilities.canConnectVoice)
}

export function canManageSpace(space: SpaceCapabilityTarget) {
  return Boolean(space?.effectiveCapabilities.canManageSpace)
}

export function canManageAnySpace(
  spaces: SpaceResponse[],
  isOwner = false,
) {
  return isOwner || spaces.some(canManageSpace)
}

export function canApplySpaceReorder(
  spaces: SpaceResponse[],
  request: ReorderSpacesRequest,
  canManageServer = false,
) {
  if (request.spaces.length === 0) {
    return false
  }

  const spaceById = new Map(spaces.map((space) => [space.id, space]))
  const requestedIds = new Set(request.spaces.map((item) => item.spaceId))
  if (
    requestedIds.size !== request.spaces.length ||
    request.spaces.some((item) => !spaceById.has(item.spaceId))
  ) {
    return false
  }

  if (canManageServer) {
    return true
  }

  const childrenByParentId = new Map<string, SpaceResponse[]>()
  spaces.forEach((space) => {
    if (!space.parentSpaceId) return
    const children = childrenByParentId.get(space.parentSpaceId) ?? []
    children.push(space)
    childrenByParentId.set(space.parentSpaceId, children)
  })

  for (const item of request.spaces) {
    const source = spaceById.get(item.spaceId)
    if (!canManageSpace(source)) {
      return false
    }

    if (source?.typeCode === 'category') {
      const pending = [...(childrenByParentId.get(source.id) ?? [])]
      const visited = new Set<string>([source.id])
      while (pending.length > 0) {
        const descendant = pending.shift()
        if (
          !descendant ||
          visited.has(descendant.id) ||
          !canManageSpace(descendant)
        ) {
          return false
        }

        visited.add(descendant.id)
        pending.push(...(childrenByParentId.get(descendant.id) ?? []))
      }
    }
  }

  const proposedParentById = new Map(
    spaces.map((space) => [space.id, space.parentSpaceId]),
  )
  request.spaces.forEach((item) => {
    proposedParentById.set(item.spaceId, item.parentSpaceId)
  })

  for (const item of request.spaces) {
    if (!item.parentSpaceId) {
      return false
    }

    let currentId: string | null = item.parentSpaceId
    const visited = new Set<string>()
    while (currentId) {
      const destination = spaceById.get(currentId)
      if (
        visited.has(currentId) ||
        !destination ||
        !canManageSpace(destination)
      ) {
        return false
      }

      visited.add(currentId)
      currentId = proposedParentById.get(currentId) ?? null
    }
  }

  return true
}
