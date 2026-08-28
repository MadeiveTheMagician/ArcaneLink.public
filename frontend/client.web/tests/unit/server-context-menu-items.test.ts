import { expect, test } from '@playwright/test';

import type { ServerMemberResponse } from '../../src/shared/types';
import { buildServerContextMenuItems } from '../../src/system/Hub/utils/serverContextMenuItems';
import type { ContextMenuItem } from '../../src/system/shared/components/contextMenuTypes';

function createMembership(ownerUserId: string) {
  return {
    serverId: 'server-1',
    server: {
      id: 'server-1',
      ownerUserId
    }
  } as ServerMemberResponse;
}

function selectItem(item: ContextMenuItem) {
  expect(item.type).toBe('item');

  if (item.type === 'item') {
    item.onSelect?.();
  }
}

test.describe('server context menu items', () => {
  test('offers copy and leave actions to a regular member', () => {
    const copiedIds: string[] = [];
    let leaveCount = 0;
    const items = buildServerContextMenuItems({
      membership: createMembership('owner-1'),
      currentUserId: 'member-1',
      onOpenServerSettings: () => {
        throw new Error('Regular members cannot open server settings.');
      },
      onLeaveServer: () => {
        leaveCount += 1;
      },
      onCopyServerId: (serverId) => copiedIds.push(serverId)
    });

    expect(items).toHaveLength(3);
    selectItem(items[0]);
    selectItem(items[2]);
    expect(copiedIds).toEqual(['server-1']);
    expect(leaveCount).toBe(1);
  });

  test('opens the full settings form without a nested owner menu', () => {
    const openedServerIds: string[] = [];
    const membership = createMembership('owner-1');
    const items = buildServerContextMenuItems({
      membership,
      currentUserId: 'owner-1',
      onOpenServerSettings: (selectedMembership) =>
        openedServerIds.push(selectedMembership.serverId),
      onLeaveServer: () => {
        throw new Error('The owner cannot leave through this menu.');
      },
      onCopyServerId: () => undefined
    });

    expect(items).toHaveLength(2);
    const settingsItem = items[0];
    expect(settingsItem.type).toBe('item');

    if (settingsItem.type === 'item') {
      selectItem(settingsItem);
      expect(settingsItem.submenu).toBeUndefined();
    }

    expect(openedServerIds).toEqual(['server-1']);
    expect(
      items.some(
        (item) =>
          item.type === 'item' &&
          (item.icon === 'trash' || item.danger === true)
      )
    ).toBe(false);
  });

  test('opens only delegated settings without exposing server deletion', () => {
    const openedServerIds: string[] = [];
    let leaveCount = 0;
    const items = buildServerContextMenuItems({
      membership: createMembership('owner-1'),
      currentUserId: 'member-1',
      canOpenFullServerSettings: true,
      onOpenServerSettings: (selectedMembership) =>
        openedServerIds.push(selectedMembership.serverId),
      onLeaveServer: () => {
        leaveCount += 1;
      },
      onCopyServerId: () => undefined
    });

    const settingsItem = items[0];
    expect(settingsItem.type).toBe('item');
    if (settingsItem.type === 'item') {
      selectItem(settingsItem);
      expect(settingsItem.submenu).toBeUndefined();
    }
    selectItem(items.at(-1)!);

    expect(openedServerIds).toEqual(['server-1']);
    expect(leaveCount).toBe(1);
    expect(
      items.some(
        (item) =>
          item.type === 'item' && item.icon === 'trash' && item.danger === true
      )
    ).toBe(false);
  });
});
