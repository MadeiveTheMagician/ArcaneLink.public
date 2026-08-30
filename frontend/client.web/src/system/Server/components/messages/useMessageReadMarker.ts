import { useCallback, useEffect, useRef } from 'react';

import type {
  SpaceMessageResponse,
  SpaceReadStateResponse
} from '../../../../shared/types';
import {
  createReadMarkerCoordinator,
  getReadMarkerCandidate
} from './messageReadMarkerModel';

type UseMessageReadMarkerOptions = {
  feedKey: string;
  messages: SpaceMessageResponse[];
  isLoading: boolean;
  isNearBottom: boolean;
  isReadingHistory: boolean;
  onMarkRead?: (
    throughMessageId: string
  ) => Promise<SpaceReadStateResponse | null>;
};

export function useMessageReadMarker({
  feedKey,
  messages,
  isLoading,
  isNearBottom,
  isReadingHistory,
  onMarkRead
}: UseMessageReadMarkerOptions) {
  const markReadRef = useRef(onMarkRead);
  const coordinatorRef = useRef<ReturnType<
    typeof createReadMarkerCoordinator
  > | null>(null);

  useEffect(() => {
    markReadRef.current = onMarkRead;
  }, [onMarkRead]);

  useEffect(() => {
    const coordinator = createReadMarkerCoordinator(async ({ messageId }) =>
      Boolean(await markReadRef.current?.(messageId))
    );
    coordinatorRef.current = coordinator;

    return () => {
      coordinator.dispose();
      coordinatorRef.current = null;
    };
  }, []);

  useEffect(() => {
    coordinatorRef.current?.activateFeed(feedKey);
  }, [feedKey]);

  const markVisibleMessagesRead = useCallback(() => {
    const messageId = getReadMarkerCandidate({
      messages,
      isLoaded: !isLoading,
      isDocumentVisible: document.visibilityState === 'visible',
      isNearBottom,
      isReadingHistory
    });

    if (messageId && markReadRef.current) {
      coordinatorRef.current?.request({
        feedKey,
        messageId
      });
    }
  }, [feedKey, isLoading, isNearBottom, isReadingHistory, messages]);

  useEffect(() => {
    markVisibleMessagesRead();
  }, [
    feedKey,
    isLoading,
    isNearBottom,
    isReadingHistory,
    markVisibleMessagesRead,
    messages
  ]);

  useEffect(() => {
    function markWhenVisible() {
      if (document.visibilityState === 'visible') {
        markVisibleMessagesRead();
      }
    }

    document.addEventListener('visibilitychange', markWhenVisible);
    return () =>
      document.removeEventListener('visibilitychange', markWhenVisible);
  }, [markVisibleMessagesRead]);
}
