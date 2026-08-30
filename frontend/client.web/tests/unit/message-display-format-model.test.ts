import { expect, test } from '@playwright/test';

import {
  createMessagePresentationSettings,
  defaultMessageBubbleAlignment,
  defaultMessageBubbleWidth,
  defaultMessageDisplayFormat,
  isMessageBubbleRightAligned,
  normalizeMessageBubbleAlignment,
  normalizeMessageBubbleWidth,
  normalizeMessageDisplayFormat,
  startsMessageBubbleSequence
} from '../../src/system/shared/messages/messagePresentationModel';

test.describe('message display format model', () => {
  test('accepts every backend format code', () => {
    expect(normalizeMessageDisplayFormat('wall-scroll')).toBe('wall-scroll');
    expect(normalizeMessageDisplayFormat('bubble')).toBe('bubble');
  });

  test('falls back for missing and invalid legacy values', () => {
    expect(normalizeMessageDisplayFormat(undefined)).toBe(
      defaultMessageDisplayFormat
    );
    expect(normalizeMessageDisplayFormat('wall_scroll')).toBe(
      defaultMessageDisplayFormat
    );
  });

  test('normalizes bubble alignment and width independently', () => {
    expect(normalizeMessageBubbleAlignment('one-side-left')).toBe(
      'one-side-left'
    );
    expect(normalizeMessageBubbleAlignment('one-side-right')).toBe(
      'one-side-right'
    );
    expect(normalizeMessageBubbleAlignment('own-left')).toBe('own-left');
    expect(normalizeMessageBubbleAlignment('own-right')).toBe('own-right');
    expect(normalizeMessageBubbleAlignment('invalid')).toBe(
      defaultMessageBubbleAlignment
    );

    expect(normalizeMessageBubbleWidth('standard')).toBe('standard');
    expect(normalizeMessageBubbleWidth('full-width')).toBe('full-width');
    expect(normalizeMessageBubbleWidth(null)).toBe(defaultMessageBubbleWidth);
  });

  test('creates a safe presentation object from an API response', () => {
    expect(
      createMessagePresentationSettings(
        'bubble',
        'one-side-right',
        'full-width'
      )
    ).toEqual({
      format: 'bubble',
      bubbleAlignment: 'one-side-right',
      bubbleWidth: 'full-width'
    });
  });

  test('resolves the visual side without coupling it to message ownership', () => {
    expect(isMessageBubbleRightAligned('one-side-left', true)).toBe(false);
    expect(isMessageBubbleRightAligned('one-side-left', false)).toBe(false);
    expect(isMessageBubbleRightAligned('one-side-right', true)).toBe(true);
    expect(isMessageBubbleRightAligned('one-side-right', false)).toBe(true);
    expect(isMessageBubbleRightAligned('own-right', true)).toBe(true);
    expect(isMessageBubbleRightAligned('own-right', false)).toBe(false);
    expect(isMessageBubbleRightAligned('own-left', true)).toBe(false);
    expect(isMessageBubbleRightAligned('own-left', false)).toBe(true);
  });

  test('starts a bubble sequence only after a sender or time-section boundary', () => {
    expect(startsMessageBubbleSequence('user-a', null, false)).toBe(true);
    expect(startsMessageBubbleSequence('user-a', 'user-b', false)).toBe(true);
    expect(startsMessageBubbleSequence('user-a', 'user-a', true)).toBe(true);
    expect(startsMessageBubbleSequence('user-a', 'user-a', false)).toBe(false);
  });
});
