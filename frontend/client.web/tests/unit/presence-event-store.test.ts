import { expect, test } from '@playwright/test';

import type {
  FriendUserResponse,
  PrivateSpaceResponse
} from '../../src/shared/types';
import {
  acceptUserPresenceChangedPayload,
  beginUserPresenceEventSession,
  captureUserPresenceEventBoundary,
  clearUserPresenceEventStore,
  getLatestUserPresence,
  parseSystemTextJsonUtcTicks,
  reconcileFriendUsersWithLatestPresence,
  reconcilePrivateSpacesWithLatestPresence,
  userPresenceEventStoreLimit
} from '../../src/system/shared/presence/presenceEventStore';
import type { UserPresenceChangedPayload } from '../../src/system/shared/presence/presenceModel';

function user(id: string): FriendUserResponse {
  return {
    id,
    login: id,
    displayName: id,
    avatarAssetId: null,
    avatarCropOffsetX: 0,
    avatarCropOffsetY: 0,
    avatarCropZoom: 1,
    presenceStatus: 'offline',
    lastSeenAt: '2026-07-21T11:00:00.000Z',
    tags: [],
    mutualServerCount: 0,
    mutualFriendCount: 0,
    sharedTagCount: 0,
    recommendationScore: 0,
    isFriend: true,
    hasIncomingFriendRequest: false,
    hasOutgoingFriendRequest: false
  };
}

function presence(
  userId: string,
  changedAt: string
): UserPresenceChangedPayload {
  return {
    userId,
    presenceStatus: 'online',
    lastSeenAt: null,
    changedAt
  };
}

test.afterEach(() => clearUserPresenceEventStore());

test.describe('presence event store', () => {
  test('rejects reversed and duplicate realtime events per user', () => {
    beginUserPresenceEventSession('viewer');
    const newer = presence('USER-2', '2026-07-21T12:00:02.000Z');
    const older = presence('user-2', '2026-07-21T12:00:01.000Z');

    expect(acceptUserPresenceChangedPayload(newer)).toBe(true);
    expect(acceptUserPresenceChangedPayload(older)).toBe(false);
    expect(acceptUserPresenceChangedPayload({ ...newer })).toBe(false);
    expect(getLatestUserPresence('user-2')).toBe(newer);
  });

  test('orders System.Text.Json UTC timestamps at their full 100ns precision', () => {
    beginUserPresenceEventSession('viewer');
    const first = presence('user-2', '2026-07-21T12:00:02.0000001Z');
    const second = presence('user-2', '2026-07-21T12:00:02.0000002Z');

    expect(Date.parse(first.changedAt)).toBe(Date.parse(second.changedAt));
    expect(acceptUserPresenceChangedPayload(first)).toBe(true);
    expect(acceptUserPresenceChangedPayload(second)).toBe(true);
    expect(acceptUserPresenceChangedPayload(first)).toBe(false);
    expect(getLatestUserPresence('user-2')).toBe(second);

    const farFutureTicks = parseSystemTextJsonUtcTicks(
      '9999-12-31T23:59:59.9999999Z'
    );
    expect(typeof farFutureTicks).toBe('bigint');
    expect(
      parseSystemTextJsonUtcTicks('2026-07-21T12:00:02.00000001Z')
    ).toBeNull();
  });

  test('does not let a pre-request event overwrite a fresh REST response', () => {
    beginUserPresenceEventSession('viewer');
    expect(
      acceptUserPresenceChangedPayload(
        presence('user-2', '2026-07-21T12:00:01.0000001Z')
      )
    ).toBe(true);
    const requestBoundary = captureUserPresenceEventBoundary();
    const freshUser = user('user-2');

    expect(
      reconcileFriendUsersWithLatestPresence([freshUser], requestBoundary)[0]
        .presenceStatus
    ).toBe('offline');
  });

  test('replays an event accepted while a REST request is in flight', () => {
    beginUserPresenceEventSession('viewer');
    const requestBoundary = captureUserPresenceEventBoundary();
    expect(
      acceptUserPresenceChangedPayload(
        presence('user-2', '2026-07-21T12:00:01.0000001Z')
      )
    ).toBe(true);

    expect(
      reconcileFriendUsersWithLatestPresence(
        [user('user-2')],
        requestBoundary
      )[0].presenceStatus
    ).toBe('online');
  });

  test('initializes a null session before capturing a REST boundary', () => {
    const requestBoundary = captureUserPresenceEventBoundary('viewer');
    expect(requestBoundary.sessionUserId).toBe('viewer');

    expect(
      acceptUserPresenceChangedPayload(
        presence('user-2', '2026-07-21T12:00:01.0000001Z')
      )
    ).toBe(true);
    expect(
      reconcileFriendUsersWithLatestPresence(
        [user('user-2')],
        requestBoundary
      )[0].presenceStatus
    ).toBe('online');
  });

  test('reconciles a stale REST response with a newer realtime event', () => {
    beginUserPresenceEventSession('viewer');
    const latest = presence('user-2', '2026-07-21T12:00:02.000Z');
    expect(acceptUserPresenceChangedPayload(latest)).toBe(true);

    const staleUser = user('USER-2');
    const stalePrivateSpace = {
      spaceId: 'space-1',
      members: [{ id: 'member-2', user: staleUser }]
    } as unknown as PrivateSpaceResponse;

    expect(
      reconcileFriendUsersWithLatestPresence([staleUser])[0].presenceStatus
    ).toBe('online');
    expect(
      reconcilePrivateSpacesWithLatestPresence([stalePrivateSpace])[0]
        .members[0].user.presenceStatus
    ).toBe('online');
  });

  test('bounds stored users and clears data when the viewer changes', () => {
    beginUserPresenceEventSession('viewer-one');

    for (let index = 0; index <= userPresenceEventStoreLimit; index += 1) {
      expect(
        acceptUserPresenceChangedPayload(
          presence(
            `user-${index}`,
            new Date(Date.UTC(2026, 6, 21, 12, 0, index)).toISOString()
          )
        )
      ).toBe(true);
    }

    expect(getLatestUserPresence('user-0')).toBeUndefined();
    expect(
      getLatestUserPresence(`user-${userPresenceEventStoreLimit}`)
    ).toBeDefined();

    beginUserPresenceEventSession('viewer-two');
    expect(
      getLatestUserPresence(`user-${userPresenceEventStoreLimit}`)
    ).toBeUndefined();
  });
});
