import type { SpaceMessageResponse } from '../../../../shared/types';

export type ReadMarkerCandidateOptions = {
  messages: SpaceMessageResponse[];
  isLoaded: boolean;
  isDocumentVisible: boolean;
  isNearBottom: boolean;
  isReadingHistory: boolean;
};

export function getReadMarkerCandidate({
  messages,
  isLoaded,
  isDocumentVisible,
  isNearBottom,
  isReadingHistory
}: ReadMarkerCandidateOptions) {
  if (!isLoaded || !isDocumentVisible || !isNearBottom || isReadingHistory) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message && !message.deletedAt) {
      return message.id;
    }
  }

  return null;
}

type MarkReadRequest = {
  feedKey: string;
  messageId: string;
};

export function createReadMarkerCoordinator(
  markRead: (request: MarkReadRequest) => Promise<boolean>
) {
  const lastMarkedMessageByFeed = new Map<string, string>();
  let pendingRequest: MarkReadRequest | null = null;
  let activeFeedKey: string | null = null;
  let isRunning = false;
  let isDisposed = false;

  async function drain() {
    if (isRunning || isDisposed) {
      return;
    }

    isRunning = true;

    try {
      while (pendingRequest && !isDisposed) {
        const request = pendingRequest;
        pendingRequest = null;

        if (
          lastMarkedMessageByFeed.get(request.feedKey) === request.messageId
        ) {
          continue;
        }

        try {
          if (await markRead(request)) {
            lastMarkedMessageByFeed.set(request.feedKey, request.messageId);
          }
        } catch {
          // A later viewport or message event may retry this best-effort marker.
        }
      }
    } finally {
      isRunning = false;
    }
  }

  function request(nextRequest: MarkReadRequest) {
    if (
      isDisposed ||
      nextRequest.feedKey !== activeFeedKey ||
      lastMarkedMessageByFeed.get(nextRequest.feedKey) === nextRequest.messageId
    ) {
      return;
    }

    pendingRequest = nextRequest;
    void drain();
  }

  return {
    activateFeed(feedKey: string) {
      if (isDisposed || activeFeedKey === feedKey) {
        return;
      }

      activeFeedKey = feedKey;
      if (pendingRequest?.feedKey !== feedKey) {
        pendingRequest = null;
      }
    },
    request,
    dispose() {
      isDisposed = true;
      activeFeedKey = null;
      pendingRequest = null;
    }
  };
}
