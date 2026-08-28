import { expect, test } from '@playwright/test';

import type { SpaceMessageResponse } from '../../src/shared/types';
import {
  getFirstUnreadNavigationTarget,
  getLatestUnreadMessageId,
  shouldHoldInitialUnreadPosition
} from '../../src/system/Server/components/messages/messageUnreadNavigationModel';

function message(
  id: string,
  senderUserId: string,
  deletedAt: string | null = null
) {
  return { id, senderUserId, deletedAt } as SpaceMessageResponse;
}

test('returns the first unread incoming message from the unread count boundary', () => {
  expect(
    getFirstUnreadNavigationTarget(
      [
        message('already-read', 'friend'),
        message('incoming-1', 'friend'),
        message('own-between', 'me'),
        message('incoming-2', 'friend'),
        message('own-latest', 'me')
      ],
      'me',
      2,
      true
    )
  ).toEqual({
    messageId: 'incoming-1',
    needsOlderMessages: false
  });
});

test('keeps the down action targeted at the latest unread incoming message', () => {
  const messages = [
    message('first-unread', 'friend'),
    message('own-between', 'me'),
    message('latest-unread', 'friend'),
    message('deleted-latest', 'friend', '2026-08-13T00:00:00Z')
  ];

  expect(getLatestUnreadMessageId(messages, 'me', 2)).toBe('latest-unread');
  expect(getLatestUnreadMessageId(messages, 'me', 0)).toBeNull();
});

test('requests older history when the unread boundary is outside the loaded page', () => {
  expect(
    getFirstUnreadNavigationTarget(
      [message('loaded-incoming', 'friend'), message('own-latest', 'me')],
      'me',
      3,
      true
    )
  ).toEqual({
    messageId: null,
    needsOlderMessages: true
  });
});

test('keeps initial positioning pending after a transient older-history failure', () => {
  expect(
    shouldHoldInitialUnreadPosition({
      hasFocusedMessage: false,
      unreadCount: 3,
      isLoading: false,
      isLoadingOlderMessages: false,
      needsOlderMessages: true
    })
  ).toBe(true);

  expect(
    shouldHoldInitialUnreadPosition({
      hasFocusedMessage: true,
      unreadCount: 3,
      isLoading: false,
      isLoadingOlderMessages: false,
      needsOlderMessages: true
    })
  ).toBe(false);
});

test('falls back to the oldest available incoming message after history is exhausted', () => {
  expect(
    getFirstUnreadNavigationTarget(
      [
        message('oldest-loaded-incoming', 'friend'),
        message('newest-loaded-incoming', 'friend')
      ],
      'me',
      3,
      false
    )
  ).toEqual({
    messageId: 'oldest-loaded-incoming',
    needsOlderMessages: false
  });
});

test('ignores deleted and own messages and does not navigate without unread messages', () => {
  const messages = [
    message('incoming', 'friend'),
    message('own', 'me'),
    message('deleted-latest', 'friend', '2026-08-13T00:00:00Z')
  ];

  expect(getFirstUnreadNavigationTarget(messages, 'me', 1, true)).toEqual({
    messageId: 'incoming',
    needsOlderMessages: false
  });
  expect(getFirstUnreadNavigationTarget(messages, 'me', 0, true)).toEqual({
    messageId: null,
    needsOlderMessages: false
  });
});
