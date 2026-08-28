import { expect, test } from '@playwright/test';

import {
  isDismissableLayerEscapeKey,
  isPointerEventOutsideDismissableLayer
} from '../../src/system/shared/hooks/useDismissableLayer';

function eventWithPath(path: EventTarget[]) {
  return {
    composedPath: () => path,
    target: path[0] ?? null
  };
}

test.describe('dismissable layer pointer contract', () => {
  test('keeps the layer open for interaction inside its surface', () => {
    const layer = new EventTarget();

    expect(
      isPointerEventOutsideDismissableLayer(
        eventWithPath([new EventTarget(), layer]),
        layer
      )
    ).toBe(false);
  });

  test('keeps the layer open when its trigger is pressed', () => {
    const layer = new EventTarget();
    const trigger = new EventTarget();

    expect(
      isPointerEventOutsideDismissableLayer(
        eventWithPath([new EventTarget(), trigger]),
        layer,
        trigger
      )
    ).toBe(false);
  });

  test('dismisses only when the pointer path is outside both boundaries', () => {
    const layer = new EventTarget();
    const trigger = new EventTarget();

    expect(
      isPointerEventOutsideDismissableLayer(
        eventWithPath([new EventTarget(), new EventTarget()]),
        layer,
        trigger
      )
    ).toBe(true);
  });

  test('keeps a parent layer open for a portaled dismissable-layer branch', () => {
    const layer = new EventTarget();
    const branch = Object.assign(new EventTarget(), {
      hasAttribute: (name: string) => name === 'data-dismissable-layer-branch'
    });
    const option = new EventTarget();

    expect(
      isPointerEventOutsideDismissableLayer(
        eventWithPath([option, branch, new EventTarget()]),
        layer
      )
    ).toBe(false);
  });
});

test.describe('dismissable layer keyboard contract', () => {
  test('dismisses on an unhandled Escape key only', () => {
    expect(
      isDismissableLayerEscapeKey({
        key: 'Escape',
        defaultPrevented: false
      })
    ).toBe(true);
    expect(
      isDismissableLayerEscapeKey({
        key: 'Escape',
        defaultPrevented: true
      })
    ).toBe(false);
    expect(
      isDismissableLayerEscapeKey({
        key: 'Enter',
        defaultPrevented: false
      })
    ).toBe(false);
  });
});
