import { expect, test } from '@playwright/test';

import type { PrivateSpaceResponse } from '../../src/shared/types';
import { patchPrivateSpacesPeerBlockState } from '../../src/system/Hub/components/private-space/privateSpaceViewerSettingsModel';

function createSpace(
  spaceId: string,
  kind: PrivateSpaceResponse['kind'],
  memberUserIds: string[]
): PrivateSpaceResponse {
  return {
    spaceId,
    kind,
    ownerUserId: 'current',
    createdByUserId: 'current',
    title: null,
    description: null,
    avatarAssetId: null,
    avatarCropOffsetX: 0,
    avatarCropOffsetY: 0,
    avatarCropZoom: 1,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    unreadCount: 0,
    viewerSettings: {
      note: null,
      customNickname: null,
      customAvatarAssetId: null,
      customAvatarCropOffsetX: 0,
      customAvatarCropOffsetY: 0,
      customAvatarCropZoom: 1,
      mutedUntil: null,
      isMutedIndefinitely: false,
      isPeerBlocked: false
    },
    members: memberUserIds.map((userId, index) => ({
      id: `member-${index}`,
      spaceId,
      userId,
      statusCode: 'active',
      joinedAt: '',
      leftAt: null,
      addedByUserId: null,
      createdAt: '',
      updatedAt: '',
      user: {
        id: userId,
        login: userId,
        displayName: userId,
        avatarAssetId: null,
        avatarCropOffsetX: 0,
        avatarCropOffsetY: 0,
        avatarCropZoom: 1,
        presenceStatus: 'offline',
        lastSeenAt: null,
        tags: [],
        mutualServerCount: 0,
        mutualFriendCount: 0,
        sharedTagCount: 0,
        recommendationScore: 0,
        isFriend: false,
        hasIncomingFriendRequest: false,
        hasOutgoingFriendRequest: false
      }
    })),
    lastMessage: null
  };
}

test.describe('private space peer block state', () => {
  test('updates only Direct spaces containing the changed peer', () => {
    const matchingDirect = createSpace('direct-1', 'direct', [
      'current',
      'peer-1'
    ]);
    const otherDirect = createSpace('direct-2', 'direct', [
      'current',
      'peer-2'
    ]);
    const group = createSpace('group-1', 'group', ['current', 'peer-1']);

    const result = patchPrivateSpacesPeerBlockState(
      [matchingDirect, otherDirect, group],
      'current',
      { userId: 'peer-1', isBlocked: true }
    );

    expect(result[0].viewerSettings.isPeerBlocked).toBe(true);
    expect(result[1]).toBe(otherDirect);
    expect(result[2]).toBe(group);
  });

  test('preserves collection identity when the state is already current', () => {
    const direct = createSpace('direct-1', 'direct', ['current', 'peer-1']);
    const spaces = [direct];

    expect(
      patchPrivateSpacesPeerBlockState(spaces, 'current', {
        userId: 'peer-1',
        isBlocked: false
      })
    ).toBe(spaces);
  });
});
