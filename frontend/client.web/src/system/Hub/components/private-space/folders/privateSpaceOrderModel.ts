import type { PrivateSpaceResponse } from '../../../../../shared/types';
import type { PrivateSpaceFolderResponse } from '../../../../../shared/types';
import type { FolderDropPlacement } from './privateSpaceFolderDragModel';

type PrivateSpaceWithOptionalActivity = PrivateSpaceResponse & {
  listActivityAt?: string | null;
};

export function getPrivateSpaceListActivityMs(
  space: PrivateSpaceWithOptionalActivity
) {
  const activityCandidates = [
    space.listActivityAt,
    space.lastMessage?.createdAt,
    space.updatedAt,
    space.createdAt
  ];

  for (const candidate of activityCandidates) {
    if (!candidate) continue;
    const timestamp = Date.parse(candidate);
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

export function reconcilePrivateSpaceFolderOrder(
  folder: Pick<
    PrivateSpaceFolderResponse,
    'isOrderLocked' | 'isSystem' | 'pinnedSpaceIds' | 'spaceIds'
  >,
  privateSpaces: readonly PrivateSpaceResponse[]
) {
  const privateSpaceById = new Map(
    privateSpaces.map((space, index) => [
      space.spaceId,
      {
        activityAt: getPrivateSpaceListActivityMs(space),
        inputIndex: index
      }
    ])
  );
  const existingSpaceIds = folder.spaceIds.filter((spaceId) =>
    privateSpaceById.has(spaceId)
  );
  const existingSpaceIdSet = new Set(existingSpaceIds);
  const unlistedSpaceIds = folder.isSystem
    ? privateSpaces
        .map((space) => space.spaceId)
        .filter((spaceId) => !existingSpaceIdSet.has(spaceId))
    : [];
  const visibleSpaceIds = [...existingSpaceIds, ...unlistedSpaceIds];

  if (folder.isOrderLocked) {
    if (unlistedSpaceIds.length === 0) {
      return existingSpaceIds;
    }

    const pinnedSpaceIds = folder.pinnedSpaceIds.filter((spaceId) =>
      existingSpaceIdSet.has(spaceId)
    );
    const pinnedSpaceIdSet = new Set(pinnedSpaceIds);
    return [
      ...pinnedSpaceIds,
      ...unlistedSpaceIds,
      ...existingSpaceIds.filter((spaceId) => !pinnedSpaceIdSet.has(spaceId))
    ];
  }

  const visibleSpaceIdSet = new Set(visibleSpaceIds);
  const pinnedSpaceIds = folder.pinnedSpaceIds.filter((spaceId) =>
    visibleSpaceIdSet.has(spaceId)
  );
  const pinnedSpaceIdSet = new Set(pinnedSpaceIds);
  const regularSpaceIds = visibleSpaceIds
    .filter((spaceId) => !pinnedSpaceIdSet.has(spaceId))
    .sort((leftId, rightId) => {
      const left = privateSpaceById.get(leftId);
      const right = privateSpaceById.get(rightId);
      const activityDifference =
        (right?.activityAt ?? 0) - (left?.activityAt ?? 0);

      if (activityDifference !== 0) {
        return activityDifference;
      }

      return (left?.inputIndex ?? 0) - (right?.inputIndex ?? 0);
    });

  return [...pinnedSpaceIds, ...regularSpaceIds];
}

export function orderPrivateSpaces(
  privateSpaces: readonly PrivateSpaceResponse[],
  orderedSpaceIds: readonly string[],
  includeUnlisted: boolean
) {
  const privateSpaceById = new Map(
    privateSpaces.map((space) => [space.spaceId, space])
  );
  const ordered = orderedSpaceIds
    .map((spaceId) => privateSpaceById.get(spaceId))
    .filter((space): space is PrivateSpaceResponse => Boolean(space));

  if (!includeUnlisted) {
    return ordered;
  }

  const orderedIds = new Set(orderedSpaceIds);
  return [
    ...ordered,
    ...privateSpaces.filter((space) => !orderedIds.has(space.spaceId))
  ];
}

export function orderPrivateSpacesPinnedFirst(
  privateSpaces: readonly PrivateSpaceResponse[],
  pinnedSpaceIds: readonly string[]
) {
  const pinnedIds = new Set(pinnedSpaceIds);

  return [
    ...privateSpaces.filter((space) => pinnedIds.has(space.spaceId)),
    ...privateSpaces.filter((space) => !pinnedIds.has(space.spaceId))
  ];
}

export function reorderPrivateSpaceIds(
  spaceIds: readonly string[],
  activeSpaceId: string,
  overSpaceId: string,
  placement: FolderDropPlacement,
  pinnedSpaceIds: readonly string[] = []
) {
  if (activeSpaceId === overSpaceId) {
    return [...spaceIds];
  }

  const pinnedIds = new Set(pinnedSpaceIds);
  if (pinnedIds.has(activeSpaceId) || pinnedIds.has(overSpaceId)) {
    return [...spaceIds];
  }

  const activeIndex = spaceIds.indexOf(activeSpaceId);
  const overIndex = spaceIds.indexOf(overSpaceId);
  if (activeIndex < 0 || overIndex < 0) {
    return [...spaceIds];
  }

  const reordered = [...spaceIds];
  const [movedSpaceId] = reordered.splice(activeIndex, 1);
  const targetIndex = reordered.indexOf(overSpaceId);
  const insertionIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
  reordered.splice(Math.max(0, insertionIndex), 0, movedSpaceId);
  return reordered;
}
