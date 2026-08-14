import { expect, test } from '@playwright/test'
import type {
  FriendRequestResponse,
  FriendUserResponse,
  PrivateSpaceResponse,
  ServerMemberDetailsResponse,
  UserFriendResponse,
} from '../../src/shared/types'
import {
  isUserPresenceChangedPayload,
  patchFriendRequestsPresence,
  patchPrivateSpacesPresence,
  patchServerMembersPresence,
  patchUserFriendsPresence,
  type UserPresenceChangedPayload,
} from '../../src/system/shared/presence/presenceModel'

const payload: UserPresenceChangedPayload = {
  userId: 'USER-2',
  presenceStatus: 'online',
  lastSeenAt: null,
  changedAt: '2026-07-21T12:00:00.000Z',
}

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
    lastSeenAt: '2026-07-20T12:00:00.000Z',
    tags: [],
    mutualServerCount: 0,
    mutualFriendCount: 0,
    sharedTagCount: 0,
    recommendationScore: 0,
    isFriend: true,
    hasIncomingFriendRequest: false,
    hasOutgoingFriendRequest: false,
  }
}

test.describe('presence model', () => {
  test('validates realtime payloads before state mutation', () => {
    expect(isUserPresenceChangedPayload(payload)).toBe(true)
    expect(
      isUserPresenceChangedPayload({ ...payload, presenceStatus: 'idle' }),
    ).toBe(false)
    expect(isUserPresenceChangedPayload({ ...payload, changedAt: '' })).toBe(
      false,
    )
    expect(
      isUserPresenceChangedPayload({ ...payload, changedAt: 'not-a-date' }),
    ).toBe(false)
  })

  test('patches friends and both sides of pending requests case-insensitively', () => {
    const friend = {
      userId: 'user-1',
      friendUserId: 'user-2',
      createdByRequestId: 'request-1',
      createdAt: payload.changedAt,
      friend: user('user-2'),
    } satisfies UserFriendResponse
    const request = {
      id: 'request-1',
      fromUserId: 'user-1',
      toUserId: 'user-2',
      statusCode: 'pending',
      createdAt: payload.changedAt,
      updatedAt: payload.changedAt,
      respondedAt: null,
      fromUser: user('user-1'),
      toUser: user('user-2'),
    } satisfies FriendRequestResponse

    const friends = patchUserFriendsPresence([friend], payload)
    const requests = patchFriendRequestsPresence([request], payload)

    expect(friends[0].friend.presenceStatus).toBe('online')
    expect(requests[0].fromUser).toBe(request.fromUser)
    expect(requests[0].toUser.presenceStatus).toBe('online')
  })

  test('patches private and server nested users while preserving untouched roots', () => {
    const privateSpace = {
      spaceId: 'space-1',
      members: [
        { id: 'member-1', user: user('user-1') },
        { id: 'member-2', user: user('user-2') },
      ],
    } as unknown as PrivateSpaceResponse
    const serverMember = {
      id: 'server-member-2',
      user: user('user-2'),
    } as unknown as ServerMemberDetailsResponse
    const untouchedServerMember = {
      id: 'server-member-1',
      user: user('user-1'),
    } as unknown as ServerMemberDetailsResponse

    const privateSpaces = patchPrivateSpacesPresence([privateSpace], payload)
    const serverMembers = patchServerMembersPresence(
      [untouchedServerMember, serverMember],
      payload,
    )

    expect(privateSpaces[0].members[0]).toBe(privateSpace.members[0])
    expect(privateSpaces[0].members[1].user.presenceStatus).toBe('online')
    expect(serverMembers[0]).toBe(untouchedServerMember)
    expect(serverMembers[1].user.presenceStatus).toBe('online')
  })

  test('preserves array identity when the payload user is absent', () => {
    const friends: UserFriendResponse[] = []
    const requests: FriendRequestResponse[] = []

    expect(patchUserFriendsPresence(friends, payload)).toBe(friends)
    expect(patchFriendRequestsPresence(requests, payload)).toBe(requests)
  })
})
