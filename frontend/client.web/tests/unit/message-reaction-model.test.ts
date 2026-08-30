import { expect, test } from '@playwright/test';

import type {
  SpaceMessageReactionResponse,
  SpaceMessageResponse
} from '../../src/shared/types';
import {
  completeReactionPresenceAnimation,
  createReactionPresenceState,
  curatedMessageReactions,
  reconcileReactionPresence,
  replaceMessage,
  shouldAddMessageReaction,
  sortMessageReactions
} from '../../src/system/Server/components/messages/messageReactionModel';

function reaction(
  emojiCode: string,
  count: number,
  reactedByCurrentUser = false
): SpaceMessageReactionResponse {
  return { emojiCode, count, reactedByCurrentUser };
}

function message(
  id: string,
  reactions: SpaceMessageReactionResponse[] = []
): SpaceMessageResponse {
  return { id, reactions } as SpaceMessageResponse;
}

test.describe('message reaction model', () => {
  test('toggles according to the current user reaction', () => {
    expect(shouldAddMessageReaction([], '👍')).toBe(true);
    expect(shouldAddMessageReaction([reaction('👍', 3, false)], '👍')).toBe(
      true
    );
    expect(shouldAddMessageReaction([reaction('👍', 3, true)], '👍')).toBe(
      false
    );
  });

  test('replaces only a message that is still in the active list', () => {
    const original = [message('one'), message('two')];
    const replacement = message('two', [reaction('❤️', 1, true)]);

    const replaced = replaceMessage(original, replacement);
    const ignored = replaceMessage(original, message('three'));

    expect(replaced).toEqual([original[0], replacement]);
    expect(ignored).toBe(original);
    expect(original[1]?.reactions).toEqual([]);
  });

  test('sorts curated reactions first and custom reactions by count and code', () => {
    const original = [
      reaction('🫠', 2),
      reaction('😢', 50),
      reaction('🪄', 4),
      reaction('❤️', 1),
      reaction('👍', 1),
      reaction('🧭', 4)
    ];

    expect(
      sortMessageReactions(original).map((item) => item.emojiCode)
    ).toEqual(['👍', '❤️', '😢', '🧭', '🪄', '🫠']);
    expect(original[0]?.emojiCode).toBe('🫠');
  });

  test('exposes a compact unique context-menu set with Russian labels', () => {
    expect(
      curatedMessageReactions.map((item) => item.emojiCode).slice(0, 6)
    ).toEqual(['👍', '❤️', '😂', '🎉', '😮', '😢']);
    expect(curatedMessageReactions.length).toBeGreaterThanOrEqual(120);
    expect(
      new Set(curatedMessageReactions.map((item) => item.emojiCode)).size
    ).toBe(curatedMessageReactions.length);
    expect(
      curatedMessageReactions.every((item) => /[А-Яа-яЁё]/u.test(item.label))
    ).toBe(true);
  });

  test('keeps initial reactions stable and animates a newly added reaction', () => {
    const initial = createReactionPresenceState('message', [
      reaction(':one:', 1)
    ]);
    expect(initial.items.map((item) => item.phase)).toEqual(['present']);

    const empty = createReactionPresenceState('empty-message', []);
    const entering = reconcileReactionPresence(empty, 'empty-message', [
      reaction(':new:', 1, true)
    ]);
    const enteringItem = expectSinglePresenceItem(
      entering,
      ':new:',
      'entering'
    );
    const present = completeReactionPresenceAnimation(
      entering,
      'empty-message',
      ':new:',
      enteringItem.token
    );

    expectSinglePresenceItem(present, ':new:', 'present');
  });

  test('retains the last reaction until its exit animation completes', () => {
    const initial = createReactionPresenceState('message', [
      reaction(':last:', 1)
    ]);
    const exiting = reconcileReactionPresence(initial, 'message', []);
    const exitingItem = expectSinglePresenceItem(exiting, ':last:', 'exiting');
    const completed = completeReactionPresenceAnimation(
      exiting,
      'message',
      ':last:',
      exitingItem.token
    );

    expect(completed.items).toEqual([]);
  });

  test('ignores stale completion after remove and re-add', () => {
    const initial = createReactionPresenceState('message', [
      reaction(':wave:', 1)
    ]);
    const firstExit = reconcileReactionPresence(initial, 'message', []);
    const firstExitItem = expectSinglePresenceItem(
      firstExit,
      ':wave:',
      'exiting'
    );
    const restored = reconcileReactionPresence(firstExit, 'message', [
      reaction(':wave:', 2)
    ]);

    expectSinglePresenceItem(restored, ':wave:', 'present');
    expect(
      completeReactionPresenceAnimation(
        restored,
        'message',
        ':wave:',
        firstExitItem.token
      )
    ).toBe(restored);

    const secondExit = reconcileReactionPresence(restored, 'message', []);
    const secondExitItem = expectSinglePresenceItem(
      secondExit,
      ':wave:',
      'exiting'
    );
    expect(secondExitItem.token).not.toBe(firstExitItem.token);
    expect(
      reconcileReactionPresence(secondExit, 'message', []).items[0]?.token
    ).toBe(secondExitItem.token);
  });

  test('updates counts without animation and resets cleanly for another message', () => {
    const initial = createReactionPresenceState('first', [
      reaction(':same:', 1)
    ]);
    const countUpdated = reconcileReactionPresence(initial, 'first', [
      reaction(':same:', 3, true)
    ]);

    const updatedItem = expectSinglePresenceItem(
      countUpdated,
      ':same:',
      'present'
    );
    expect(updatedItem.reaction.count).toBe(3);

    const reset = reconcileReactionPresence(countUpdated, 'second', [
      reaction(':other:', 1)
    ]);
    expectSinglePresenceItem(reset, ':other:', 'present');
  });

  test('handles a simultaneous reaction replacement', () => {
    const initial = createReactionPresenceState('message', [
      reaction(':old:', 1)
    ]);
    const replaced = reconcileReactionPresence(initial, 'message', [
      reaction(':new:', 1)
    ]);

    expect(replaced.items).toHaveLength(2);
    expect(
      replaced.items.find((item) => item.reaction.emojiCode === ':old:')?.phase
    ).toBe('exiting');
    expect(
      replaced.items.find((item) => item.reaction.emojiCode === ':new:')?.phase
    ).toBe('entering');
  });
});

function expectSinglePresenceItem(
  state: ReturnType<typeof createReactionPresenceState>,
  emojiCode: string,
  phase: 'present' | 'entering' | 'exiting'
) {
  const item = state.items.find(
    (candidate) => candidate.reaction.emojiCode === emojiCode
  );
  expect(item).toBeDefined();
  expect(item?.phase).toBe(phase);
  return item!;
}
