import { expect, test } from '@playwright/test'
import {
  getContextMenuItemKey,
  type ContextMenuItem,
} from '../../src/system/shared/components/context-menu/contextMenuTypes'

test.describe('context menu item keys', () => {
  test('keeps an explicit item id stable when its visible label changes', () => {
    const first: ContextMenuItem = {
      id: 'private-space-mute',
      type: 'item',
      label: 'Заглушить · 59:59',
    }
    const next: ContextMenuItem = {
      ...first,
      label: 'Заглушить · 59:58',
    }

    expect(getContextMenuItemKey(first, 1)).toBe('private-space-mute')
    expect(getContextMenuItemKey(next, 1)).toBe('private-space-mute')
  })

  test('preserves a deterministic fallback for legacy items and separators', () => {
    expect(
      getContextMenuItemKey(
        { type: 'item', label: 'Открыть профиль' },
        2,
      ),
    ).toBe('item:Открыть профиль:2')
    expect(getContextMenuItemKey({ type: 'separator' }, 3)).toBe(
      'separator:3',
    )
  })
})
