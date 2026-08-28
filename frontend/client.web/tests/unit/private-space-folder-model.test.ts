import { expect, test } from '@playwright/test'
import type { PrivateSpaceFolderResponse } from '../../src/shared/types'
import { getPrivateSpaceFolderContext } from '../../src/system/Hub/components/private-space/folders/privateSpaceFolderModel'

function folder(
  id: string,
  name: string,
  isSystem: boolean,
  spaceIds: string[],
): PrivateSpaceFolderResponse {
  return {
    id,
    name,
    icon: isSystem ? '💬' : '⭐',
    color: null,
    position: 0,
    isSystem,
    isOrderLocked: false,
    spaceIds,
    pinnedSpaceIds: [],
  }
}

test.describe('private-space folder context', () => {
  const folders = [
    folder('all', 'Все', true, ['space-1', 'space-2']),
    folder('stars', 'Старс', false, ['space-1']),
    folder('work', 'Работа', false, []),
  ]

  test('offers only folders that do not already contain the conversation from All', () => {
    const context = getPrivateSpaceFolderContext(folders, 'all', 'space-1')

    expect(context.activeFolder?.id).toBe('all')
    expect(context.addTargets.map((item) => item.id)).toEqual(['work'])
  })

  test('returns the active custom folder for remove-from-folder actions', () => {
    const context = getPrivateSpaceFolderContext(folders, 'stars', 'space-1')

    expect(context.activeFolder?.id).toBe('stars')
    expect(context.addTargets).toEqual([])
  })
})
