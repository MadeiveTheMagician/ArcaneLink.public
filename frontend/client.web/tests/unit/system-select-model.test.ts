import { expect, test } from '@playwright/test'
import {
  getNextSystemSelectOptionIndex,
  getSystemSelectCloseDelayMs,
  resolveSystemSelectPopupPosition,
  systemSelectTransitionDurationMs,
} from '../../src/system/shared/ui/systemSelectModel'

test.describe('system select model', () => {
  test('opens below the trigger when there is enough room', () => {
    const position = resolveSystemSelectPopupPosition({
      trigger: { top: 80, bottom: 122, left: 120, width: 280 },
      viewportWidth: 960,
      viewportHeight: 720,
      contentHeight: 160,
    })

    expect(position.placement).toBe('bottom')
    expect(position.top).toBe(128)
    expect(position.left).toBe(120)
    expect(position.width).toBe(280)
  })

  test('flips above and constrains the popup near the lower edge', () => {
    const position = resolveSystemSelectPopupPosition({
      trigger: { top: 610, bottom: 652, left: 820, width: 240 },
      viewportWidth: 960,
      viewportHeight: 680,
      contentHeight: 420,
    })

    expect(position.placement).toBe('top')
    expect(position.left + position.width).toBeLessThanOrEqual(952)
    expect(position.top).toBeGreaterThanOrEqual(8)
    expect(position.maxHeight).toBeLessThanOrEqual(320)
  })

  test('keyboard navigation skips disabled options and wraps', () => {
    const disabled = [false, true, false]

    expect(
      getNextSystemSelectOptionIndex({
        activeIndex: 0,
        direction: 1,
        disabled,
      }),
    ).toBe(2)
    expect(
      getNextSystemSelectOptionIndex({
        activeIndex: 2,
        direction: 1,
        disabled,
      }),
    ).toBe(0)
  })

  test('keeps close animation unless reduced motion is requested', () => {
    expect(getSystemSelectCloseDelayMs(false)).toBe(
      systemSelectTransitionDurationMs,
    )
    expect(getSystemSelectCloseDelayMs(true)).toBe(0)
  })
})
