import { expect, test } from '@playwright/test';

import type { SpaceResponse } from '../../src/shared/types';
import { getServerOverviewSpaceGroups } from '../../src/system/Server/components/overview/serverOverviewSpaceGroups';

function space(
  id: string,
  typeCode: SpaceResponse['typeCode'],
  position: number,
  parentSpaceId: string | null = null,
  title = id
): SpaceResponse {
  return {
    id,
    serverId: 'server-1',
    typeId: `${typeCode}-id`,
    typeCode,
    parentSpaceId,
    voiceChatSpaceId: null,
    createdByUserId: 'user-1',
    title,
    description: null,
    requiredServerRoleId: null,
    position,
    isSystem: false,
    createdAt: '2026-08-13T00:00:00Z',
    updatedAt: '2026-08-13T00:00:00Z',
    deletedAt: null,
    unreadCount: 0,
    permissionOverrides: [],
    effectiveCapabilities: {
      canSendMessages: true,
      canConnectVoice: true,
      canManageSpace: false
    }
  };
}

test.describe('server overview space groups', () => {
  test('keeps uncategorized spaces together and preserves nested category trees', () => {
    const groups = getServerOverviewSpaceGroups(
      [
        space('lobby', 'text_room', 0, null, 'Лобби'),
        space('category-games', 'category', 1, null, 'Игры'),
        space('rules', 'text_room', 0, 'category-games', 'Правила'),
        space('category-voice', 'category', 1, 'category-games', 'Голосовые'),
        space('raid', 'voice_room', 0, 'category-voice', 'Рейд'),
        space('category-archive', 'category', 2, null, 'Архив')
      ],
      ''
    );

    expect(groups.map((group) => group.id)).toEqual([
      'uncategorized',
      'category:category-games',
      'category:category-archive'
    ]);

    const games = groups[1];
    expect(games.kind).toBe('category');
    if (games.kind !== 'category') {
      return;
    }

    expect(games.node.children.map((node) => node.space.id)).toEqual([
      'rules',
      'category-voice'
    ]);
    expect(games.node.children[1]?.children[0]?.space.id).toBe('raid');
  });

  test('keeps the category ancestry while filtering by a nested space', () => {
    const groups = getServerOverviewSpaceGroups(
      [
        space('category-games', 'category', 0, null, 'Игры'),
        space('rules', 'text_room', 0, 'category-games', 'Правила'),
        space('category-voice', 'category', 1, 'category-games', 'Голосовые'),
        space('raid', 'voice_room', 0, 'category-voice', 'Рейдовый зал'),
        space('lobby', 'text_room', 1, null, 'Лобби')
      ],
      'рейд'
    );

    expect(groups).toHaveLength(1);
    const group = groups[0];
    expect(group.kind).toBe('category');
    if (group.kind !== 'category') {
      return;
    }

    expect(group.node.space.id).toBe('category-games');
    expect(group.node.children.map((node) => node.space.id)).toEqual([
      'category-voice'
    ]);
    expect(group.node.children[0]?.children[0]?.space.id).toBe('raid');
  });

  test('puts orphaned spaces into understandable root groups instead of hiding them', () => {
    const groups = getServerOverviewSpaceGroups(
      [
        space('orphan-category', 'category', 2, 'missing', 'Старая категория'),
        space('orphan-text', 'text_room', 1, 'missing', 'Старый спейс')
      ],
      ''
    );

    expect(groups.map((group) => group.id)).toEqual([
      'uncategorized',
      'category:orphan-category'
    ]);
  });
});
