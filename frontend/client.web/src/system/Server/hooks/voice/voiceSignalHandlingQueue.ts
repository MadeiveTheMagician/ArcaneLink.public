export type VoiceSignalHandlingResult = 'handled' | 'dropped';

type VoiceSignalHandlingRequest = {
  generation: object;
  peerId: string;
  isCurrent: () => boolean;
  handle: () => Promise<void>;
};

export function createVoiceSignalHandlingQueue() {
  let epoch = 0;
  const tailsByGeneration = new Map<object, Map<string, Promise<void>>>();

  function enqueue({
    generation,
    peerId,
    isCurrent,
    handle
  }: VoiceSignalHandlingRequest): Promise<VoiceSignalHandlingResult> {
    const queuedEpoch = epoch;
    const peerKey = peerId.trim().toLowerCase();
    const tailsByPeer = tailsByGeneration.get(generation) ?? new Map();
    tailsByGeneration.set(generation, tailsByPeer);
    const previous = tailsByPeer.get(peerKey) ?? Promise.resolve();

    const operation = previous.then(async () => {
      if (queuedEpoch !== epoch || !isCurrent()) {
        return 'dropped' as const;
      }

      try {
        await handle();
      } catch (error) {
        if (queuedEpoch !== epoch || !isCurrent()) {
          return 'dropped' as const;
        }
        throw error;
      }

      return queuedEpoch === epoch && isCurrent()
        ? ('handled' as const)
        : ('dropped' as const);
    });
    const tail = operation.then(
      () => undefined,
      () => undefined
    );
    tailsByPeer.set(peerKey, tail);
    void tail.then(() => {
      if (tailsByPeer.get(peerKey) === tail) {
        tailsByPeer.delete(peerKey);
      }
      if (
        tailsByPeer.size === 0 &&
        tailsByGeneration.get(generation) === tailsByPeer
      ) {
        tailsByGeneration.delete(generation);
      }
    });

    return operation;
  }

  function invalidate() {
    epoch += 1;
    tailsByGeneration.clear();
  }

  return { enqueue, invalidate };
}
