import type { SpaceResponse, SpaceTypeCode } from '../../../shared/types'

export type ServerCoreTab =
  | 'general'
  | 'spaces'
  | 'invites'
  | 'join-requests'
  | 'roles'
  | 'bans'
  | 'audit'
  | 'moderation'

export type ServerDetail =
  | { type: 'overview' }
  | { type: 'channel'; spaceId: string | null; title: string; kind: 'text' | 'voice' }

export function toChannelDetail(space: SpaceResponse): ServerDetail {
  return {
    type: 'channel',
    spaceId: space.id,
    title: space.title,
    kind: space.typeCode === 'voice_room' ? 'voice' : 'text',
  }
}

export function compareSpaces(first: SpaceResponse, second: SpaceResponse) {
  return first.position - second.position || first.title.localeCompare(second.title)
}

export function defaultSpaceTitle(typeCode: SpaceTypeCode) {
  if (typeCode === 'category') {
    return '\u041d\u043e\u0432\u0430\u044f \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f'
  }

  return typeCode === 'voice_room'
    ? '\u041d\u043e\u0432\u044b\u0439 \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0441\u043f\u0435\u0439\u0441'
    : '\u043d\u043e\u0432\u044b\u0439-\u0441\u043f\u0435\u0439\u0441'
}

export function getAncestorCategoryIds(
  space: SpaceResponse | undefined,
  spaces: SpaceResponse[],
) {
  const ancestorIds: string[] = []
  let currentParentId = space?.parentSpaceId ?? null

  while (currentParentId) {
    const parent = spaces.find((item) => item.id === currentParentId)

    if (!parent || parent.typeCode !== 'category') {
      break
    }

    ancestorIds.push(parent.id)
    currentParentId = parent.parentSpaceId
  }

  return ancestorIds
}
