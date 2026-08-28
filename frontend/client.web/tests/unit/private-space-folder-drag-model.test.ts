import { expect, test } from '@playwright/test'
import {
  privateSpaceDragPreviewSize,
  resolveCenteredDragPreviewTransform,
  resolveFolderChipDropPlacement,
  resolvePointerDropPlacement,
} from '../../src/system/Hub/components/private-space/folders/privateSpaceFolderDragModel'

test.describe('private-space folder drag geometry', () => {
  test('centers the compact conversation preview on the activation point', () => {
    const transform = resolveCenteredDragPreviewTransform({
      transform: { x: 40, y: 15 },
      activationPoint: { x: 260, y: 230 },
      sourceRect: {
        top: 200,
        left: 100,
        width: 320,
        height: 62,
      },
      previewSize: privateSpaceDragPreviewSize,
    })

    const previewLeft = 100 + transform.x
    const previewTop = 200 + transform.y
    const currentPointer = { x: 260 + 40, y: 230 + 15 }

    expect(previewLeft + privateSpaceDragPreviewSize.width / 2).toBe(
      currentPointer.x,
    )
    expect(previewTop + privateSpaceDragPreviewSize.height / 2).toBe(
      currentPointer.y,
    )
  })

  test('keeps the existing transform when preview geometry is invalid', () => {
    expect(
      resolveCenteredDragPreviewTransform({
        transform: { x: 18, y: -6 },
        activationPoint: { x: 130, y: 84 },
        sourceRect: { top: 50, left: 30, width: 0, height: 0 },
        previewSize: { width: 0, height: 36 },
      }),
    ).toEqual({ x: 18, y: -6 })
  })

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
