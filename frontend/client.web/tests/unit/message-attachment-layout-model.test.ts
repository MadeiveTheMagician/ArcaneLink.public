import { expect, test } from '@playwright/test';

import {
  getScrollToBottomPlacement,
  resolveAttachmentLayoutTransition
} from '../../src/system/Server/components/messages/messageAttachmentLayoutModel';

test.describe('message attachment layout model', () => {
  test('raises the scroll button only while attachment drafts are selected', () => {
    expect(getScrollToBottomPlacement(0)).toBe('default');
    expect(getScrollToBottomPlacement(1)).toBe('above-attachment-drafts');
    expect(getScrollToBottomPlacement(12)).toBe('above-attachment-drafts');
  });

  test('animates a real attachment layout height change', () => {
    expect(
      resolveAttachmentLayoutTransition({
        fromHeight: 320,
        toHeight: 640,
        prefersReducedMotion: false
      })
    ).toEqual({
      fromHeight: 320,
      shouldAnimate: true,
      toHeight: 640
    });
  });

  test('skips layout motion on first render and for reduced motion', () => {
    expect(
      resolveAttachmentLayoutTransition({
        fromHeight: null,
        toHeight: 320,
        prefersReducedMotion: false
      }).shouldAnimate
    ).toBe(false);
    expect(
      resolveAttachmentLayoutTransition({
        fromHeight: 320,
        toHeight: 640,
        prefersReducedMotion: true
      }).shouldAnimate
    ).toBe(false);
  });
});
