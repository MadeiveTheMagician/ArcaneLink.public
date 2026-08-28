import { expect, test } from '@playwright/test';

import { createVoiceSignalHandlingQueue } from '../../src/system/Server/hooks/voice/voiceSignalHandlingQueue';

test.describe('voice signal handling queue', () => {
  test('preserves arrival order for one peer while other peers remain independent', async () => {
    const queue = createVoiceSignalHandlingQueue();
    const generation = {};
    const order: string[] = [];
    let releaseFirstSignal: (() => void) | null = null;
    const firstSignalBlocked = new Promise<void>((resolve) => {
      releaseFirstSignal = resolve;
    });

    const firstSignal = queue.enqueue({
      generation,
      peerId: 'PEER-A',
      isCurrent: () => true,
      handle: async () => {
        order.push('first:start');
        await firstSignalBlocked;
        order.push('first:end');
      }
    });
    const secondSignal = queue.enqueue({
      generation,
      peerId: 'peer-a',
      isCurrent: () => true,
      handle: async () => {
        order.push('second');
      }
    });
    const otherPeerSignal = queue.enqueue({
      generation,
      peerId: 'peer-b',
      isCurrent: () => true,
      handle: async () => {
        order.push('other');
      }
    });

    await expect(otherPeerSignal).resolves.toBe('handled');
    expect(order).toEqual(['first:start', 'other']);
    releaseFirstSignal?.();
    await expect(firstSignal).resolves.toBe('handled');
    await expect(secondSignal).resolves.toBe('handled');
    expect(order).toEqual(['first:start', 'other', 'first:end', 'second']);
  });

  test('preserves current-generation errors without blocking the next signal', async () => {
    const queue = createVoiceSignalHandlingQueue();
    const generation = {};
    let retryRan = false;

    const failedSignal = queue.enqueue({
      generation,
      peerId: 'peer-a',
      isCurrent: () => true,
      handle: async () => {
        throw new Error('signal failed');
      }
    });
    const retry = queue.enqueue({
      generation,
      peerId: 'peer-a',
      isCurrent: () => true,
      handle: async () => {
        retryRan = true;
      }
    });

    await expect(failedSignal).rejects.toThrow('signal failed');
    await expect(retry).resolves.toBe('handled');
    expect(retryRan).toBe(true);
  });

  test('drops invalidated work and lets the next generation start immediately', async () => {
    const queue = createVoiceSignalHandlingQueue();
    const replacedGeneration = {};
    const currentGeneration = {};
    let releaseReplacedSignal: (() => void) | null = null;
    const replacedSignalBlocked = new Promise<void>((resolve) => {
      releaseReplacedSignal = resolve;
    });
    let queuedReplacedSignalRan = false;

    const activeReplacedSignal = queue.enqueue({
      generation: replacedGeneration,
      peerId: 'peer-a',
      isCurrent: () => true,
      handle: async () => {
        await replacedSignalBlocked;
        throw new Error('stale failure');
      }
    });
    const queuedReplacedSignal = queue.enqueue({
      generation: replacedGeneration,
      peerId: 'peer-a',
      isCurrent: () => true,
      handle: async () => {
        queuedReplacedSignalRan = true;
      }
    });

    queue.invalidate();
    await expect(
      queue.enqueue({
        generation: currentGeneration,
        peerId: 'peer-a',
        isCurrent: () => true,
        handle: async () => undefined
      })
    ).resolves.toBe('handled');

    releaseReplacedSignal?.();
    await expect(activeReplacedSignal).resolves.toBe('dropped');
    await expect(queuedReplacedSignal).resolves.toBe('dropped');
    expect(queuedReplacedSignalRan).toBe(false);
  });

  test('drops pending work when its channel generation is no longer current', async () => {
    const queue = createVoiceSignalHandlingQueue();
    const generation = {};
    let isCurrent = true;
    let releaseActiveSignal: (() => void) | null = null;
    const activeSignalBlocked = new Promise<void>((resolve) => {
      releaseActiveSignal = resolve;
    });
    let pendingSignalRan = false;

    const activeSignal = queue.enqueue({
      generation,
      peerId: 'peer-a',
      isCurrent: () => isCurrent,
      handle: async () => {
        await activeSignalBlocked;
      }
    });
    const pendingSignal = queue.enqueue({
      generation,
      peerId: 'peer-a',
      isCurrent: () => isCurrent,
      handle: async () => {
        pendingSignalRan = true;
      }
    });

    isCurrent = false;
    releaseActiveSignal?.();
    await expect(activeSignal).resolves.toBe('dropped');
    await expect(pendingSignal).resolves.toBe('dropped');
    expect(pendingSignalRan).toBe(false);
  });

  test('keeps a reused generation key serialized after invalidation', async () => {
    const queue = createVoiceSignalHandlingQueue();
    const generation = {};
    let releaseReplacedSignal: (() => void) | null = null;
    let releaseCurrentSignal: (() => void) | null = null;
    const replacedSignalBlocked = new Promise<void>((resolve) => {
      releaseReplacedSignal = resolve;
    });
    const currentSignalBlocked = new Promise<void>((resolve) => {
      releaseCurrentSignal = resolve;
    });

    const replacedSignal = queue.enqueue({
      generation,
      peerId: 'peer-a',
      isCurrent: () => true,
      handle: () => replacedSignalBlocked
    });
    queue.invalidate();
    const currentSignal = queue.enqueue({
      generation,
      peerId: 'peer-a',
      isCurrent: () => true,
      handle: () => currentSignalBlocked
    });

    releaseReplacedSignal?.();
    await expect(replacedSignal).resolves.toBe('dropped');

    let pendingSignalRan = false;
    const pendingSignal = queue.enqueue({
      generation,
      peerId: 'peer-a',
      isCurrent: () => true,
      handle: async () => {
        pendingSignalRan = true;
      }
    });
    await Promise.resolve();
    expect(pendingSignalRan).toBe(false);

    releaseCurrentSignal?.();
    await expect(currentSignal).resolves.toBe('handled');
    await expect(pendingSignal).resolves.toBe('handled');
    expect(pendingSignalRan).toBe(true);
  });
});
