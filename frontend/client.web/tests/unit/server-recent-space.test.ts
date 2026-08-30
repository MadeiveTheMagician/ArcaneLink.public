import { expect, test } from '@playwright/test';

import type { SpaceResponse } from '../../src/shared/types';
import {
  getRecentServerDetail,
  recentServerSpaceLifetimeMs,
  rememberRecentServerDetail
} from '../../src/system/Server/utils/serverRecentSpace';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  } as Storage;
}

function createSpace(id: string, typeCode: SpaceResponse['typeCode']) {
  return {
    id,
    serverId: 'server-1',
    typeId: 'type-1',
    typeCode,
    parentSpaceId: null,
    createdByUserId: 'user-1',
    title: id,
    description: null,
    requiredServerRoleId: null,
    position: 0,
    isSystem: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
    permissionOverrides: [],
    effectiveCapabilities: {
      canSendMessages: true,
      canConnectVoice: true,
      canManageSpace: true
    }
  } satisfies SpaceResponse;
}

test.describe('recent server space', () => {
  test('restores a recently visited server channel', () => {
    const storage = createStorage();
    const space = createSpace('space-1', 'text_room');

    rememberRecentServerDetail(
      'server-1',
      { type: 'channel', spaceId: space.id, title: space.title, kind: 'text' },
      1000,
      storage
    );

    expect(getRecentServerDetail('server-1', [space], 2000, storage)).toEqual({
      type: 'channel',
      spaceId: space.id,
      title: space.title,
      kind: 'text'
    });
  });

  test('expires a visited channel after one hour', () => {
    const storage = createStorage();
    const space = createSpace('space-1', 'text_room');

    rememberRecentServerDetail(
      'server-1',
      { type: 'channel', spaceId: space.id, title: space.title, kind: 'text' },
      1000,
      storage
    );

    expect(
      getRecentServerDetail(
        'server-1',
        [space],
        1001 + recentServerSpaceLifetimeMs,
        storage
      )
    ).toBeNull();
  });

  test('does not restore a deleted or category space', () => {
    const storage = createStorage();
    const category = createSpace('category-1', 'category');

    rememberRecentServerDetail(
      'server-1',
      {
        type: 'channel',
        spaceId: category.id,
        title: category.title,
        kind: 'text'
      },
      1000,
      storage
    );

    expect(
      getRecentServerDetail('server-1', [category], 2000, storage)
    ).toBeNull();
  });
});
