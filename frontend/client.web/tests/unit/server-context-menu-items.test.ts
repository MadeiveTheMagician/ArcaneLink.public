import { expect, test } from '@playwright/test'
import type { ServerMemberResponse } from '../../src/shared/types'
import type { ContextMenuItem } from '../../src/system/shared/components/contextMenuTypes'
import { buildServerContextMenuItems } from '../../src/system/Hub/utils/serverContextMenuItems'

function createMembership(ownerUserId: string) {
  return {
    serverId: 'server-1',
    server: {
      id: 'server-1',
      ownerUserId,
    },
  } as ServerMemberResponse
}

function selectItem(item: ContextMenuItem) {
  expect(item.type).toBe('item')

  if (item.type === 'item') {
    item.onSelect?.()
  }
}

test.describe('server context menu items', () => {
  test('offers copy and leave actions to a regular member', () => {
    const copiedIds: string[] = []
    let leaveCount = 0
    const items = buildServerContextMenuItems({
      membership: createMembership('owner-1'),
      currentUserId: 'member-1',
      onOpenServerSettings: () => {
        throw new Error('Regular members cannot open server settings.')
      },
      onLeaveServer: () => {
        leaveCount += 1
      },
      onCopyServerId: (serverId) => copiedIds.push(serverId),
    })

    expect(items).toHaveLength(3)
    selectItem(items[0])
    selectItem(items[2])
    expect(copiedIds).toEqual(['server-1'])
    expect(leaveCount).toBe(1)
  })

  test('offers settings sections and deletion to the owner', () => {
    const openedSections: string[] = []
    const membership = createMembership('owner-1')
    const items = buildServerContextMenuItems({
      membership,
      currentUserId: 'owner-1',
      onOpenServerSettings: (_membership, section) =>
        openedSections.push(section),
      onLeaveServer: () => {
        throw new Error('The owner cannot leave through this menu.')
      },
      onCopyServerId: () => undefined,
    })

    expect(items).toHaveLength(4)
    const settingsItem = items[0]
    expect(settingsItem.type).toBe('item')

    if (settingsItem.type === 'item') {
      selectItem(settingsItem)
      expect(settingsItem.submenu).toHaveLength(2)
      selectItem(settingsItem.submenu![0])
      selectItem(settingsItem.submenu![1])
    }

    selectItem(items[3])
    expect(openedSections).toEqual(['all', 'edit', 'delete', 'delete'])
  })

  test('opens only delegated settings without exposing server deletion', () => {
    const openedAccess: Array<{
      canManageProfile: boolean
      canManageSettings: boolean
      canDelete: boolean
    }> = []
    let leaveCount = 0
    const items = buildServerContextMenuItems({
      membership: createMembership('owner-1'),
      currentUserId: 'member-1',
      canManageServerProfile: true,
      canManageServerSettings: false,
      onOpenServerSettings: (_membership, _section, access) =>
        openedAccess.push(access),
      onLeaveServer: () => {
        leaveCount += 1
      },
      onCopyServerId: () => undefined,
    })

    const settingsItem = items[0]
    expect(settingsItem.type).toBe('item')
    if (settingsItem.type === 'item') {
      selectItem(settingsItem)
      expect(settingsItem.submenu).toHaveLength(1)
      selectItem(settingsItem.submenu![0])
    }
    selectItem(items.at(-1)!)

    expect(openedAccess).toEqual([
      {
        canManageProfile: true,
        canManageSettings: false,
        canDelete: false,
      },
      {
        canManageProfile: true,
        canManageSettings: false,
        canDelete: false,
      },
    ])
    expect(leaveCount).toBe(1)
    expect(
      items.some(
        (item) =>
          item.type === 'item' &&
          item.icon === 'trash' &&
          item.danger === true,
      ),
    ).toBe(false)
  })
})
