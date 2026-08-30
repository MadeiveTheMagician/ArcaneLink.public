import { expect, test } from '@playwright/test';

import type { FriendUserResponse } from '../../src/shared/types';
import {
  formatCommunityPresence,
  matchesFriendStatusFilter
} from '../../src/system/Hub/components/community/communityFilters';
import { communityCopy } from '../../src/system/shared/copy/community.ru';

function user(
  presenceStatus: FriendUserResponse['presenceStatus'],
  lastSeenAt: string | null
) {
  return {
    id: 'user-1',
    displayName: 'User',
    login: 'user',
    presenceStatus,
    lastSeenAt,
    tags: []
  } as FriendUserResponse;
}

test.describe('community presence', () => {
  test('filters by explicit presence instead of deriving a five-minute window', () => {
    const onlineWithOldTimestamp = user('online', '2020-01-01T00:00:00.000Z');
    const offlineWithFreshTimestamp = user('offline', new Date().toISOString());

    expect(matchesFriendStatusFilter(onlineWithOldTimestamp, 'online')).toBe(
      true
    );
    expect(matchesFriendStatusFilter(offlineWithFreshTimestamp, 'online')).toBe(
      false
    );
  });

  test('shows last-seen time only when the backend supplied it', () => {
    expect(formatCommunityPresence(user('offline', null))).toBe(
      communityCopy.states.offline
    );
    expect(
      formatCommunityPresence(user('offline', '2026-07-20T10:00:00.000Z'))
    ).not.toBe(communityCopy.states.offline);
    expect(formatCommunityPresence(user('online', null))).toBe(
      communityCopy.states.online
    );
  });
});
