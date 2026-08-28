import { expect, test } from '@playwright/test';

import {
  advanceMessageComposerFocus,
  createMessageComposerFocusState,
  insertMessageEmoji
} from '../../src/system/Server/components/messages/messageComposerInteractionModel';

test.describe('message composer focus', () => {
  test('autofocuses a private composer but leaves a server composer idle', () => {
    const privateDecision = advanceMessageComposerFocus(
      createMessageComposerFocusState(),
      {
        autoFocusOnMount: true,
        focusRequestId: 0,
        canFocus: true
      }
    );
    const serverDecision = advanceMessageComposerFocus(
      createMessageComposerFocusState(),
      {
        autoFocusOnMount: false,
        focusRequestId: 0,
        canFocus: true
      }
    );

    expect(privateDecision.shouldFocus).toBe(true);
    expect(serverDecision.shouldFocus).toBe(false);
  });

  test('keeps a successful-send focus request pending until the composer is enabled', () => {
    const initialState = createMessageComposerFocusState();
    const busyDecision = advanceMessageComposerFocus(initialState, {
      autoFocusOnMount: false,
      focusRequestId: 1,
      canFocus: false
    });
    const readyDecision = advanceMessageComposerFocus(busyDecision.state, {
      autoFocusOnMount: false,
      focusRequestId: 1,
      canFocus: true
    });
    const handledDecision = advanceMessageComposerFocus(readyDecision.state, {
      autoFocusOnMount: false,
      focusRequestId: 1,
      canFocus: true
    });

    expect(busyDecision.shouldFocus).toBe(false);
    expect(readyDecision.shouldFocus).toBe(true);
    expect(handledDecision.shouldFocus).toBe(false);
  });
});

test.describe('message composer emoji insertion', () => {
  test('inserts an emoji at the caret and returns its next position', () => {
    expect(
      insertMessageEmoji({
        text: 'Привет мир',
        emoji: '🙂',
        selectionStart: 6,
        selectionEnd: 6
      })
    ).toEqual({
      text: 'Привет🙂 мир',
      caret: 8,
      didInsert: true
    });
  });

  test('replaces the selected text even when the range is reversed', () => {
    expect(
      insertMessageEmoji({
        text: 'До встречи',
        emoji: '👋',
        selectionStart: 10,
        selectionEnd: 3
      })
    ).toEqual({
      text: 'До 👋',
      caret: 5,
      didInsert: true
    });
  });

  test('does not exceed the message length limit', () => {
    expect(
      insertMessageEmoji({
        text: '1234',
        emoji: '🙂',
        selectionStart: 4,
        selectionEnd: 4,
        maximumLength: 5
      })
    ).toEqual({
      text: '1234',
      caret: 4,
      didInsert: false
    });
  });
});
