import type { FriendUserResponse } from '../../../../shared/types';
import { communityCopy } from '../../../shared/copy/community.ru';
import type { CommunityFriendStatusFilter } from './communityTypes';

export function matchesCommunityQuery(user: FriendUserResponse, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');

  if (!normalizedQuery) {
    return true;
  }

  return `${user.displayName} ${user.login}`
    .toLocaleLowerCase('ru-RU')
    .includes(normalizedQuery);
}

export function matchesFriendStatusFilter(
  user: FriendUserResponse,
  filter: CommunityFriendStatusFilter
) {
  if (filter === 'all') {
    return true;
  }

  const isOnline = user.presenceStatus === 'online';

  return filter === 'online' ? isOnline : !isOnline;
}

export function matchesSelectedTags(
  user: FriendUserResponse,
  selectedTagIds: string[]
) {
  if (selectedTagIds.length === 0) {
    return true;
  }

  const userTagIds = new Set((user.tags ?? []).map((tag) => tag.id));
  return selectedTagIds.every((tagId) => userTagIds.has(tagId));
}

export function toggleStringInList(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function uniqueCommunityUsers(users: FriendUserResponse[]) {
  const seen = new Set<string>();

  return users.filter((user) => {
    if (seen.has(user.id)) {
      return false;
    }

    seen.add(user.id);
    return true;
  });
}

export function formatCommunityDate(value: string | null) {
  if (!value) {
    return communityCopy.states.offline;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return communityCopy.states.offline;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatCommunityPresence(user: FriendUserResponse) {
  if (user.presenceStatus === 'online') {
    return communityCopy.states.online;
  }

  return user.lastSeenAt
    ? formatCommunityDate(user.lastSeenAt)
    : communityCopy.states.offline;
}
