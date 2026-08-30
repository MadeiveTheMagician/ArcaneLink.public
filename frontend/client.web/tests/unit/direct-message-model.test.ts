import { expect, test } from '@playwright/test';

import type {
  FriendUserResponse,
  PrivateSpaceMemberResponse,
  PrivateSpaceResponse,
  SpaceMessageAssetResponse,
  SpaceMessageResponse
} from '../../src/shared/types';
import {
  filterPrivateSpacesByConversationQuery,
  formatPrivateSpaceMuteRemaining,
  getDefaultPrivateSpaceGroupTitle,
  getPrivateSpaceOtherMember,
  getPrivateSpacePresenceStatus,
  getPrivateSpacePreview,
  getPrivateSpaceTitle,
  getPrivateSpaceTooltipModel,
  resolvePrivateSpaceMuteState
} from '../../src/system/Hub/components/direct-messages/directMessageModel';
import { communityCopy } from '../../src/system/shared/copy/community.ru';

function createUser(id: string, displayName: string): FriendUserResponse {
  return {
    id,
    login: id,
    displayName,
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
  };
}

function createMember(
  userId: string,
  displayName: string,
  statusCode = 'active'
): PrivateSpaceMemberResponse {
  return {
    id: `member-${userId}`,
    spaceId: 'space-1',
    userId,
    statusCode,
    joinedAt: '',
    leftAt: null,
    addedByUserId: null,
    createdAt: '',
    updatedAt: '',
    user: createUser(userId, displayName)
  };
}

function createSpace(
  members: PrivateSpaceMemberResponse[],
  overrides: Partial<PrivateSpaceResponse> = {}
): PrivateSpaceResponse {
  return {
    spaceId: 'space-1',
    createdByUserId: 'current',
    ownerUserId: 'current',
    kind: 'direct',
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
    members,
    lastMessage: null,
    ...overrides
  };
}

function createMessage(
  overrides: Partial<SpaceMessageResponse> = {}
): SpaceMessageResponse {
  return {
    id: 'message-1',
    serverId: 'private-server',
    spaceId: 'space-1',
    senderUserId: 'friend-1',
    senderDisplayName: 'Astra',
    senderAvatarAssetId: null,
    senderAvatarCropOffsetX: 0,
    senderAvatarCropOffsetY: 0,
    senderAvatarCropZoom: 1,
    messageTypeId: 'message-type-text',
    messageTypeCode: 'text',
    body: null,
    payload: null,
    replyToMessageId: null,
    replyTo: null,
    createdAt: '',
    updatedAt: '',
    editedAt: null,
    deletedAt: null,
    assets: [],
    reactions: [],
    mentions: [],
    receipt: null,
    ...overrides
  };
}

function createAsset(): SpaceMessageAssetResponse {
  return {
    assetId: 'asset-1',
    displayOrder: 0,
    fileName: 'attachment.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    createdAt: '',
    isSpoiler: false
  };
}

test.describe('direct message model', () => {
  test('filters the conversation list by effective direct and group titles', () => {
    const direct = createSpace(
      [createMember('current', 'Current'), createMember('friend-1', 'Astra')],
      { spaceId: 'direct-1' }
    );
    const group = createSpace(
      [createMember('current', 'Current'), createMember('friend-2', 'Boris')],
      { spaceId: 'group-1', kind: 'group', title: 'Учебная группа' }
    );

    expect(
      filterPrivateSpacesByConversationQuery(
        [direct, group],
        'current',
        '  ГРУППА '
      ).map((space) => space.spaceId)
    ).toEqual(['group-1']);
    expect(
      filterPrivateSpacesByConversationQuery(
        [direct, group],
        'current',
        'astra'
      ).map((space) => space.spaceId)
    ).toEqual(['direct-1']);
  });

  test('uses the other member name for an explicit Direct space', () => {
    const directSpace = createSpace([
      createMember('current', 'Current'),
      createMember('friend-1', 'Astra')
    ]);

    expect(getPrivateSpaceTitle(directSpace, 'current')).toBe('Astra');
  });

  test('keeps a two-user Group distinct from a Direct conversation', () => {
    const twoUserGroup = createSpace(
      [createMember('current', 'Current'), createMember('friend-1', 'Astra')],
      {
        kind: 'group',
        title: 'Проектная группа'
      }
    );

    expect(getPrivateSpaceTitle(twoUserGroup, 'current')).toBe(
      'Проектная группа'
    );
    expect(getPrivateSpacePresenceStatus(twoUserGroup, 'current')).toBeNull();
  });

  test('builds a stable default Group title from three displayed members', () => {
    const members = [
      createMember('current', 'Current'),
      createMember('friend-1', 'Astra'),
      createMember('friend-2', 'Boris'),
      createMember('friend-3', 'Clara')
    ];
    const group = createSpace(members, {
      kind: 'group',
      title: null
    });

    expect(getDefaultPrivateSpaceGroupTitle(members)).toBe(
      'Группа пользователей Current, Astra, Boris и др.'
    );
    expect(getPrivateSpaceTitle(group, 'current')).toBe(
      'Группа пользователей Current, Astra, Boris и др.'
    );
  });

  test('ignores inactive members in a generated Group title', () => {
    const members = [
      createMember('current', 'Current'),
      createMember('friend-1', 'Astra'),
      createMember('friend-2', 'Former member', 'left')
    ];

    expect(getDefaultPrivateSpaceGroupTitle(members)).toBe(
      'Группа пользователей Current, Astra'
    );
  });

  test('prefers a viewer custom nickname in a Direct conversation', () => {
    const directSpace = createSpace(
      [createMember('current', 'Current'), createMember('friend-1', 'Astra')],
      {
        viewerSettings: {
          ...createSpace([]).viewerSettings,
          customNickname: '  Напарница  '
        }
      }
    );

    expect(getPrivateSpaceTitle(directSpace, 'current')).toBe('Напарница');
  });

  test('keeps the original and custom Direct names in the tooltip', () => {
    const directSpace = createSpace(
      [createMember('current', 'Current'), createMember('friend-1', 'Astra')],
      {
        viewerSettings: {
          ...createSpace([]).viewerSettings,
          customNickname: '  Напарница  ',
          note: '  Вместе работаем над релизом  '
        }
      }
    );

    expect(getPrivateSpaceTooltipModel(directSpace, 'current')).toEqual({
      title: 'Astra: Напарница',
      note: 'Вместе работаем над релизом'
    });
  });

  test('uses the group title without applying a Direct custom nickname', () => {
    const groupSpace = createSpace(
      [createMember('current', 'Current'), createMember('friend-1', 'Astra')],
      {
        kind: 'group',
        title: 'Команда',
        viewerSettings: {
          ...createSpace([]).viewerSettings,
          customNickname: 'Не должно отображаться'
        }
      }
    );

    expect(getPrivateSpaceTooltipModel(groupSpace, 'current')).toEqual({
      title: 'Команда',
      note: null
    });
  });

  test('resolves finite, expired, invalid and indefinite mute states', () => {
    const nowMs = Date.parse('2026-07-29T10:00:00.000Z');

    expect(
      resolvePrivateSpaceMuteState(
        {
          isMutedIndefinitely: false,
          mutedUntil: '2026-07-29T11:02:03.000Z'
        },
        nowMs
      )
    ).toEqual({
      isMuted: true,
      isIndefinite: false,
      expiresAtMs: Date.parse('2026-07-29T11:02:03.000Z'),
      remainingMs: 3_723_000
    });
    expect(
      resolvePrivateSpaceMuteState(
        {
          isMutedIndefinitely: false,
          mutedUntil: '2026-07-29T09:59:59.000Z'
        },
        nowMs
      ).isMuted
    ).toBe(false);
    expect(
      resolvePrivateSpaceMuteState(
        {
          isMutedIndefinitely: false,
          mutedUntil: 'not-a-date'
        },
        nowMs
      ).isMuted
    ).toBe(false);
    expect(
      resolvePrivateSpaceMuteState(
        {
          isMutedIndefinitely: true,
          mutedUntil: null
        },
        nowMs
      )
    ).toEqual({
      isMuted: true,
      isIndefinite: true,
      expiresAtMs: null,
      remainingMs: null
    });
  });

  test('formats finite and indefinite mute countdowns', () => {
    expect(
      formatPrivateSpaceMuteRemaining({
        isMuted: true,
        isIndefinite: false,
        expiresAtMs: 3_723_000,
        remainingMs: 3_723_000
      })
    ).toBe('1:02:03');
    expect(
      formatPrivateSpaceMuteRemaining({
        isMuted: true,
        isIndefinite: false,
        expiresAtMs: 63_000,
        remainingMs: 63_000
      })
    ).toBe('01:03');
    expect(
      formatPrivateSpaceMuteRemaining({
        isMuted: true,
        isIndefinite: true,
        expiresAtMs: null,
        remainingMs: null
      })
    ).toBe('∞');
    expect(
      formatPrivateSpaceMuteRemaining({
        isMuted: false,
        isIndefinite: false,
        expiresAtMs: null,
        remainingMs: null
      })
    ).toBeNull();
  });

  test('prefers an active other member', () => {
    const inactive = createMember('friend-1', 'Inactive', 'left');
    const active = createMember('friend-2', 'Active');
    const space = createSpace([
      createMember('current', 'Current'),
      inactive,
      active
    ]);

    expect(getPrivateSpaceOtherMember(space, 'current')).toBe(active);
  });

  test('exposes presence only for one-to-one conversations', () => {
    const onlineFriend = createMember('friend-1', 'Online friend');
    onlineFriend.user = {
      ...onlineFriend.user,
      presenceStatus: 'online'
    };
    const directSpace = createSpace([
      createMember('current', 'Current'),
      onlineFriend
    ]);
    const groupSpace = createSpace(
      [...directSpace.members, createMember('friend-2', 'Another friend')],
      { kind: 'group' }
    );

    expect(getPrivateSpacePresenceStatus(directSpace, 'current')).toBe(
      'online'
    );
    expect(
      getPrivateSpacePresenceStatus(
        createSpace([
          createMember('current', 'Current'),
          createMember('friend-1', 'Offline friend')
        ]),
        'current'
      )
    ).toBe('offline');
    expect(getPrivateSpacePresenceStatus(groupSpace, 'current')).toBeNull();
  });

  test('uses message text, attachment and empty-state previews in order', () => {
    const space = createSpace([]);
    const message = createMessage({ body: '  Hello  ' });

    expect(getPrivateSpacePreview({ ...space, lastMessage: message })).toBe(
      'Hello'
    );
    expect(
      getPrivateSpacePreview({
        ...space,
        lastMessage: createMessage({
          body: '',
          assets: [createAsset()]
        })
      })
    ).toBe(communityCopy.direct.attachment);
    expect(getPrivateSpacePreview(space)).toBe(communityCopy.direct.noMessages);
  });
});
