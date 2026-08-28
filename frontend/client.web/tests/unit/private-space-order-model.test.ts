import { expect, test } from '@playwright/test';

import type { PrivateSpaceResponse } from '../../src/shared/types';
import {
  getPrivateSpaceListActivityMs,
  orderPrivateSpaces,
  orderPrivateSpacesPinnedFirst,
  reconcilePrivateSpaceFolderOrder,
  reorderPrivateSpaceIds
} from '../../src/system/Hub/components/private-space/folders/privateSpaceOrderModel';

function privateSpace(
  spaceId: string,
  updatedAt = '2026-07-29T10:00:00.000Z'
): PrivateSpaceResponse {
  return {
    spaceId,
    createdByUserId: 'current',
    ownerUserId: 'current',
    kind: 'group',
    title: `Space ${spaceId}`,
    description: null,
    avatarAssetId: null,
    avatarCropOffsetX: 0,
    avatarCropOffsetY: 0,
    avatarCropZoom: 1,
    createdAt: '2026-07-29T09:00:00.000Z',
    updatedAt,
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
    members: [],
    lastMessage: null
  };
}

test.describe('private-space list order model', () => {
  test('moves a conversation before or after another conversation', () => {
    expect(reorderPrivateSpaceIds(['a', 'b', 'c'], 'c', 'a', 'before')).toEqual(
      ['c', 'a', 'b']
    );
    expect(reorderPrivateSpaceIds(['a', 'b', 'c'], 'a', 'b', 'after')).toEqual([
      'b',
      'a',
      'c'
    ]);
  });

  test('orders a custom folder strictly by its saved ids', () => {
    expect(
      orderPrivateSpaces(
        [privateSpace('a'), privateSpace('b'), privateSpace('c')],
        ['c', 'a'],
        false
      ).map((space) => space.spaceId)
    ).toEqual(['c', 'a']);
  });

  test('keeps new unlisted conversations visible in the all folder', () => {
    expect(
      orderPrivateSpaces(
        [privateSpace('new'), privateSpace('a'), privateSpace('b')],
        ['b', 'a'],
        true
      ).map((space) => space.spaceId)
    ).toEqual(['b', 'a', 'new']);
  });

  test('places pinned conversations first without changing saved space ids', () => {
    const spaces = [
      privateSpace('a'),
      privateSpace('b'),
      privateSpace('c'),
      privateSpace('d')
    ];
    const pinnedSpaceIds = ['c', 'a'];

    expect(
      orderPrivateSpacesPinnedFirst(spaces, pinnedSpaceIds).map(
        (space) => space.spaceId
      )
    ).toEqual(['a', 'c', 'b', 'd']);
    expect(spaces.map((space) => space.spaceId)).toEqual(['a', 'b', 'c', 'd']);
    expect(pinnedSpaceIds).toEqual(['c', 'a']);
  });

  test('uses independent pinned ids for each folder view', () => {
    const spaces = [privateSpace('a'), privateSpace('b'), privateSpace('c')];

    expect(
      orderPrivateSpacesPinnedFirst(spaces, ['a']).map((space) => space.spaceId)
    ).toEqual(['a', 'b', 'c']);
    expect(
      orderPrivateSpacesPinnedFirst(spaces, ['c']).map((space) => space.spaceId)
    ).toEqual(['c', 'a', 'b']);
  });

  test('does not reorder a pinned item or across the pinned boundary', () => {
    const spaceIds = ['pinned', 'a', 'b'];
    const pinnedSpaceIds = ['pinned'];

    expect(
      reorderPrivateSpaceIds(spaceIds, 'pinned', 'b', 'after', pinnedSpaceIds)
    ).toEqual(spaceIds);
    expect(
      reorderPrivateSpaceIds(spaceIds, 'b', 'pinned', 'before', pinnedSpaceIds)
    ).toEqual(spaceIds);
    expect(
      reorderPrivateSpaceIds(spaceIds, 'b', 'a', 'before', pinnedSpaceIds)
    ).toEqual(['pinned', 'b', 'a']);
  });

  test('raises recently active conversations in an unlocked folder', () => {
    const spaces = [
      privateSpace('old', '2026-07-29T10:00:00.000Z'),
      privateSpace('fresh', '2026-07-29T12:00:00.000Z'),
      privateSpace('middle', '2026-07-29T11:00:00.000Z')
    ];
    const folder = {
      isSystem: true,
      isOrderLocked: false,
      spaceIds: ['old', 'fresh'],
      pinnedSpaceIds: []
    };

    expect(reconcilePrivateSpaceFolderOrder(folder, spaces)).toEqual([
      'fresh',
      'middle',
      'old'
    ]);
    expect(folder.spaceIds).toEqual(['old', 'fresh']);
  });

  test('preserves a locked order but places a new conversation after pins', () => {
    expect(
      reconcilePrivateSpaceFolderOrder(
        {
          isSystem: true,
          isOrderLocked: true,
          spaceIds: ['old', 'pinned', 'fresh'],
          pinnedSpaceIds: ['pinned']
        },
        [
          privateSpace('fresh', '2026-07-29T12:00:00.000Z'),
          privateSpace('new', '2026-07-29T13:00:00.000Z'),
          privateSpace('pinned', '2026-07-29T09:00:00.000Z'),
          privateSpace('old', '2026-07-29T10:00:00.000Z')
        ]
      )
    ).toEqual(['pinned', 'new', 'old', 'fresh']);
  });

  test('keeps pins first and does not add unrelated spaces to a custom folder', () => {
    expect(
      reconcilePrivateSpaceFolderOrder(
        {
          isSystem: false,
          isOrderLocked: false,
          spaceIds: ['old', 'pinned', 'fresh'],
          pinnedSpaceIds: ['pinned']
        },
        [
          privateSpace('unrelated', '2026-07-29T14:00:00.000Z'),
          privateSpace('fresh', '2026-07-29T13:00:00.000Z'),
          privateSpace('pinned', '2026-07-29T09:00:00.000Z'),
          privateSpace('old', '2026-07-29T10:00:00.000Z')
        ]
      )
    ).toEqual(['pinned', 'fresh', 'old']);
  });

  test('prefers an explicit list activity timestamp when the API provides it', () => {
    const space = {
      ...privateSpace('activity', '2026-07-29T10:00:00.000Z'),
      listActivityAt: '2026-07-29T15:00:00.000Z'
    };

    expect(getPrivateSpaceListActivityMs(space)).toBe(
      Date.parse('2026-07-29T15:00:00.000Z')
    );
  });
});
