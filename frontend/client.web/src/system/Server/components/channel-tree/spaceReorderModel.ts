import type {
  ReorderSpacesRequest,
  SpaceResponse,
} from '../../../../shared/types'

export type SpaceDropMode = 'before' | 'after' | 'inside'

export function getSpaceDropMode(
  relativeOffset: number,
  targetTypeCode: SpaceResponse['typeCode'],
): SpaceDropMode {
  if (targetTypeCode === 'category') {
    if (relativeOffset < 0.28) {
      return 'before'
    }

    if (relativeOffset > 0.72) {
      return 'after'
    }

    return 'inside'
  }

  return relativeOffset < 0.5 ? 'before' : 'after'
}

export function buildSpaceReorderRequest(
  spaces: SpaceResponse[],
  draggedSpaceId: string,
  targetSpaceId: string,
  mode: SpaceDropMode,
): ReorderSpacesRequest {
  const draggedSpace = spaces.find((space) => space.id === draggedSpaceId)
  const targetSpace = spaces.find((space) => space.id === targetSpaceId)

  if (!draggedSpace || !targetSpace) {
    return { spaces: [] }
  }

  if (mode === 'inside') {
    if (
      targetSpace.typeCode !== 'category' ||
      wouldCreateSpaceCycle(draggedSpaceId, targetSpaceId, spaces)
    ) {
      return { spaces: [] }
    }

    return buildMoveRequest(spaces, draggedSpace, targetSpace.id, null)
  }

  return buildMoveRequest(
    spaces,
    draggedSpace,
    targetSpace.parentSpaceId,
    {
      targetSpaceId: targetSpace.id,
      placeAfter: mode === 'after',
    },
  )
}

export function buildRootSpaceReorderRequest(
  spaces: SpaceResponse[],
  draggedSpaceId: string,
): ReorderSpacesRequest {
  const draggedSpace = spaces.find((space) => space.id === draggedSpaceId)

  if (!draggedSpace) {
    return { spaces: [] }
  }

  return buildMoveRequest(spaces, draggedSpace, null, null)
}

export function wouldCreateSpaceCycle(
  draggedSpaceId: string,
  targetParentSpaceId: string,
  spaces: SpaceResponse[],
) {
  let currentParentId: string | null = targetParentSpaceId

  while (currentParentId) {
    if (currentParentId === draggedSpaceId) {
      return true
    }

    currentParentId =
      spaces.find((space) => space.id === currentParentId)?.parentSpaceId ?? null
  }

  return false
}

function buildMoveRequest(
  spaces: SpaceResponse[],
  draggedSpace: SpaceResponse,
  nextParentSpaceId: string | null,
  placement: { targetSpaceId: string; placeAfter: boolean } | null,
): ReorderSpacesRequest {
  const sourceParentSpaceId = draggedSpace.parentSpaceId
  const sourceSiblings = getSiblings(spaces, sourceParentSpaceId).filter(
    (space) => space.id !== draggedSpace.id,
  )
  const targetSiblings =
    sourceParentSpaceId === nextParentSpaceId
      ? sourceSiblings
      : getSiblings(spaces, nextParentSpaceId).filter(
          (space) => space.id !== draggedSpace.id,
        )
  const insertIndex = placement
    ? Math.max(
        0,
        targetSiblings.findIndex((space) => space.id === placement.targetSpaceId) +
          (placement.placeAfter ? 1 : 0),
      )
    : targetSiblings.length
  const nextTargetSiblings = [
    ...targetSiblings.slice(0, insertIndex),
    draggedSpace,
    ...targetSiblings.slice(insertIndex),
  ]
  const changed = new Map<string, { parentSpaceId: string | null; position: number }>()

  if (sourceParentSpaceId !== nextParentSpaceId) {
    sourceSiblings.forEach((space, index) => {
      changed.set(space.id, {
        parentSpaceId: sourceParentSpaceId,
        position: index,
      })
    })
  }

  nextTargetSiblings.forEach((space, index) => {
    changed.set(space.id, {
      parentSpaceId: nextParentSpaceId,
      position: index,
    })
  })

  return {
    spaces: Array.from(changed.entries())
      .filter(([spaceId, next]) => {
        const current = spaces.find((space) => space.id === spaceId)

        return (
          current &&
          (current.parentSpaceId !== next.parentSpaceId ||
            current.position !== next.position)
        )
      })
      .map(([spaceId, next]) => ({
        spaceId,
        parentSpaceId: next.parentSpaceId,
        position: next.position,
      })),
  }
}

function getSiblings(spaces: SpaceResponse[], parentSpaceId: string | null) {
  return spaces
    .filter((space) => space.parentSpaceId === parentSpaceId)
    .sort(compareSpaces)
}

function compareSpaces(first: SpaceResponse, second: SpaceResponse) {
  return first.position - second.position || first.title.localeCompare(second.title)
}
