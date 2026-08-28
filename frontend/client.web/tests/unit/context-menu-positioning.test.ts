import { expect, test } from '@playwright/test';

import {
  resolveContextMenuHeight,
  resolveContextMenuPlacement
} from '../../src/system/shared/services/contextMenuPositioning';

test.describe('context menu positioning', () => {
  test('uses overflowing content height when opening near the lower edge', () => {
    const viewportHeight = 463;
    const menuHeight = resolveContextMenuHeight({
      renderedHeight: 180,
      contentHeight: 306,
      estimatedHeight: 180,
      viewportHeight
    });

    const placement = resolveContextMenuPlacement({
      x: 247,
      y: 430,
      menuWidth: 330,
      menuHeight,
      submenuWidth: 274,
      viewportWidth: 767,
      viewportHeight
    });

    expect(menuHeight).toBe(306);
    expect(placement.top).toBeGreaterThanOrEqual(8);
    expect(placement.top + menuHeight).toBeLessThanOrEqual(viewportHeight - 8);
  });

  test('caps a menu that is taller than the viewport', () => {
    expect(
      resolveContextMenuHeight({
        renderedHeight: 180,
        contentHeight: 900,
        estimatedHeight: 180,
        viewportHeight: 463
      })
    ).toBe(447);
  });

  test('keeps the scrollable menu inside a very short viewport', () => {
    const viewportHeight = 160;
    const menuHeight = resolveContextMenuHeight({
      renderedHeight: 180,
      contentHeight: 306,
      estimatedHeight: 180,
      viewportHeight
    });

    const placement = resolveContextMenuPlacement({
      x: 865,
      y: 96,
      menuWidth: 264,
      menuHeight,
      submenuWidth: 274,
      viewportWidth: 1200,
      viewportHeight
    });

    expect(menuHeight).toBe(144);
    expect(placement.top).toBe(8);
    expect(placement.maxHeight).toBe(144);
    expect(placement.top + placement.maxHeight).toBeLessThanOrEqual(
      viewportHeight - 8
    );
  });
});
