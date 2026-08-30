export type VoiceStateUpdateGeneration = {
  participantId: string;
  spaceId: string;
};

export type VoiceStateUpdateRequest = VoiceStateUpdateGeneration & {
  isMuted: boolean;
  isDeafened: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
};

type VoiceStateSnapshot = Omit<
  VoiceStateUpdateRequest,
  keyof VoiceStateUpdateGeneration
>;

export function enqueueAcceptedVoiceGenerationState(
  synchronizer: { enqueue: (request: VoiceStateUpdateRequest) => void },
  participantId: string,
  spaceId: string,
  getCurrentState: () => VoiceStateSnapshot
) {
  synchronizer.enqueue({
    participantId,
    spaceId,
    ...getCurrentState()
  });
}

type VoiceStateUpdateSynchronizerOptions = {
  send: (request: VoiceStateUpdateRequest) => Promise<void>;
  isCurrentGeneration: (request: VoiceStateUpdateGeneration) => boolean;
  retryDelayMs?: number;
  schedule?: (callback: () => void, delayMs: number) => number;
  cancel?: (handle: number) => void;
};

export function createVoiceStateUpdateSynchronizer({
  send,
  isCurrentGeneration,
  retryDelayMs = 500,
  schedule = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancel = (handle) => globalThis.clearTimeout(handle)
}: VoiceStateUpdateSynchronizerOptions) {
  let pending: VoiceStateUpdateRequest | null = null;
  let isSending = false;
  let retryHandle: number | null = null;
  let isDisposed = false;

  function scheduleFlush() {
    if (isDisposed || isSending || retryHandle !== null || !pending) {
      return;
    }
    isSending = true;
    void flush();
  }

  async function flush() {
    while (!isDisposed && pending) {
      const request = pending;
      pending = null;
      if (!isCurrentGeneration(request)) {
        continue;
      }

      try {
        await send(request);
      } catch {
        if (!pending && isCurrentGeneration(request)) {
          pending = request;
        }
        isSending = false;
        if (pending && retryHandle === null) {
          retryHandle = schedule(() => {
            retryHandle = null;
            scheduleFlush();
          }, retryDelayMs);
        }
        return;
      }
    }
    isSending = false;
  }

  return {
    enqueue(request: VoiceStateUpdateRequest) {
      if (isDisposed) {
        return;
      }
      pending = request;
      scheduleFlush();
    },
    invalidate() {
      pending = null;
      if (retryHandle !== null) {
        cancel(retryHandle);
        retryHandle = null;
      }
    },
    dispose() {
      isDisposed = true;
      pending = null;
      if (retryHandle !== null) {
        cancel(retryHandle);
        retryHandle = null;
      }
    }
  };
}
