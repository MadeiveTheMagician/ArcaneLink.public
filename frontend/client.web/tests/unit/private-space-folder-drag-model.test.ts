import { expect, test } from '@playwright/test'
import {
  resolveFolderChipDropPlacement,
  resolvePointerDropPlacement,
} from '../../src/system/Hub/components/private-space/folders/privateSpaceFolderDragModel'

test.describe('private-space folder drag geometry', () => {
  test('switches a vertical target slightly before its visual midpoint', () => {
    const targetRect = {
      top: 100,
      left: 20,
      width: 240,
      height: 100,
    }

    expect(
      resolvePointerDropPlacement({
        pointer: { x: 120, y: 144 },
        targetRect,
        axis: 'vertical',
      }),
    ).toBe('before')
    expect(
      resolvePointerDropPlacement({
        pointer: { x: 120, y: 145 },
        targetRect,
        axis: 'vertical',
      }),
    ).toBe('after')
  })

  test('uses the pointer instead of the dragged row center', () => {
    expect(
      resolvePointerDropPlacement({
        pointer: { x: 46, y: 220 },
        targetRect: {
          top: 200,
          left: 10,
          width: 80,
          height: 30,
        },
        axis: 'horizontal',
      }),
    ).toBe('after')
  })

  test('uses horizontal placement on the same folder row', () => {
    expect(
      resolveFolderChipDropPlacement({
        pointer: { x: 130, y: 112 },
        targetRect: {
          top: 100,
          left: 100,
          width: 100,
          height: 28,
        },
        activeRect: {
          top: 101,
          left: 20,
          width: 70,
          height: 28,
        },
      }),
    ).toBe('before')
  })

  test('uses vertical placement when moving between wrapped folder rows', () => {
    expect(
      resolveFolderChipDropPlacement({
        pointer: { x: 180, y: 145 },
        targetRect: {
          top: 140,
          left: 100,
          width: 100,
          height: 28,
        },
        activeRect: {
          top: 90,
          left: 100,
          width: 100,
          height: 28,
        },
      }),
    ).toBe('before')
  })

  test('falls back safely for an unmeasurable target', () => {
    expect(
      resolvePointerDropPlacement({
        pointer: { x: 0, y: 0 },
        targetRect: {
          top: 0,
          left: 0,
          width: 0,
          height: 0,
        },
        axis: 'vertical',
      }),
    ).toBe('before')
  })
})
