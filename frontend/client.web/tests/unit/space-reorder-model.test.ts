import { expect, test } from '@playwright/test';

import type { SpaceResponse } from '../../src/shared/types';
import {
  buildRootSpaceReorderRequest,
  buildSpaceReorderRequest,
  getSpaceDropMode,
  wouldCreateSpaceCycle
} from '../../src/system/Server/components/channel-tree/spaceReorderModel';

function createSpace(
  id: string,
  position: number,
  patch: Partial<SpaceResponse> = {}
): SpaceResponse {
  return {
    id,
    serverId: 'server-1',
    typeId: 'type-1',
    typeCode: 'text',
    parentSpaceId: null,
    createdByUserId: 'user-1',
    title: id,
    description: null,
    requiredServerRoleId: null,
    position,
    isSystem: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
    permissionOverrides: [],
    effectiveCapabilities: {
      canSendMessages: true,
      canConnectVoice: true,
      canManageSpace: true
    },
    ...patch
  };
}

test.describe('space reorder model', () => {
  test('resolves category and channel drop zones', () => {
    expect(getSpaceDropMode(0.27, 'category')).toBe('before');
    expect(getSpaceDropMode(0.5, 'category')).toBe('inside');
    expect(getSpaceDropMode(0.73, 'category')).toBe('after');
    expect(getSpaceDropMode(0.49, 'text')).toBe('before');
    expect(getSpaceDropMode(0.5, 'voice')).toBe('after');
  });

  test('moves a space before a sibling', () => {
    const spaces = [
      createSpace('a', 0),
      createSpace('b', 1),
      createSpace('c', 2)
    ];

    expect(buildSpaceReorderRequest(spaces, 'c', 'a', 'before')).toEqual({
      spaces: [
        { spaceId: 'c', parentSpaceId: null, position: 0 },
        { spaceId: 'a', parentSpaceId: null, position: 1 },
        { spaceId: 'b', parentSpaceId: null, position: 2 }
      ]
    });
  });

  test('moves a space into a category and normalizes both sibling groups', () => {
    const spaces = [
      createSpace('source-a', 0),
      createSpace('dragged', 1),
      createSpace('source-b', 2),
      createSpace('category', 3, { typeCode: 'category' }),
      createSpace('child', 0, { parentSpaceId: 'category' })
    ];

    expect(
      buildSpaceReorderRequest(spaces, 'dragged', 'category', 'inside')
    ).toEqual({
      spaces: [
        { spaceId: 'source-b', parentSpaceId: null, position: 1 },
        { spaceId: 'category', parentSpaceId: null, position: 2 },
        { spaceId: 'dragged', parentSpaceId: 'category', position: 1 }
      ]
    });
  });

  test('moves a nested space to the end of the root', () => {
    const spaces = [
      createSpace('root', 0),
      createSpace('category', 1, { typeCode: 'category' }),
      createSpace('nested', 0, { parentSpaceId: 'category' }),
      createSpace('nested-b', 1, { parentSpaceId: 'category' })
    ];

    expect(buildRootSpaceReorderRequest(spaces, 'nested')).toEqual({
      spaces: [
        { spaceId: 'nested-b', parentSpaceId: 'category', position: 0 },
        { spaceId: 'nested', parentSpaceId: null, position: 2 }
      ]
    });
  });

  test('rejects a category move into its descendant', () => {
    const spaces = [
      createSpace('parent', 0, { typeCode: 'category' }),
      createSpace('child', 0, {
        typeCode: 'category',
        parentSpaceId: 'parent'
      })
    ];

    expect(wouldCreateSpaceCycle('parent', 'child', spaces)).toBe(true);
    expect(
      buildSpaceReorderRequest(spaces, 'parent', 'child', 'inside')
    ).toEqual({
      spaces: []
    });
  });

  test('returns an empty change set for missing spaces and invalid inside drops', () => {
    const spaces = [createSpace('text', 0), createSpace('target', 1)];

    expect(
      buildSpaceReorderRequest(spaces, 'missing', 'target', 'after')
    ).toEqual({
      spaces: []
    });
    expect(
      buildSpaceReorderRequest(spaces, 'text', 'target', 'inside')
    ).toEqual({
      spaces: []
    });
  });
});
