import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';

import type { OlderMessageLoadResult } from '../../hooks/messages/messagePaginationModel';

export function useMessageFeedNavigation({
  feedKey,
  messageCount,
  focusedMessageId,
  initialMessageId,
  isInitialPositionPending = false,
  hasOlderMessages = false,
  isLoadingOlderMessages = false,
  onLoadOlderMessages
}: {
  feedKey: string;
  messageCount: number;
  focusedMessageId?: string | null;
  initialMessageId?: string | null;
  isInitialPositionPending?: boolean;
  hasOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  onLoadOlderMessages?: () => Promise<OlderMessageLoadResult>;
}) {
  const feedRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const activeFeedKeyRef = useRef(feedKey);
  const hasPositionedCurrentFeedRef = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);
  const isLoadingOlderRef = useRef(false);
  const paginationRef = useRef({
    feedKey,
    hasOlderMessages,
    isLoadingOlderMessages,
    onLoadOlderMessages
  });
  const [canScrollToBottom, setCanScrollToBottom] = useState(false);
  const [positionedFeedKey, setPositionedFeedKey] = useState<string | null>(
    null
  );
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  useEffect(() => {
    paginationRef.current = {
      feedKey,
      hasOlderMessages,
      isLoadingOlderMessages,
      onLoadOlderMessages
    };
  }, [feedKey, hasOlderMessages, isLoadingOlderMessages, onLoadOlderMessages]);

  const scrollMessagesToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const feed = feedRef.current;

      if (!feed) return;

      feed.scrollTo({ top: feed.scrollHeight, behavior });
      setCanScrollToBottom(false);
    },
    []
  );

  const stickToBottom = useCallback(() => {
    shouldStickToBottomRef.current = true;
  }, []);

  const updateScrollPositionState = useCallback((feed: HTMLDivElement) => {
    const distanceToBottom =
      feed.scrollHeight - feed.scrollTop - feed.clientHeight;
    const isNearBottom = distanceToBottom < 72;

    shouldStickToBottomRef.current = isNearBottom;
    setCanScrollToBottom(!isNearBottom);
  }, []);

  const jumpToMessage = useCallback((messageId: string) => {
    const target = feedRef.current?.querySelector<HTMLElement>(
      `[data-message-id="${messageId}"]`
    );

    if (!target) return;

    shouldStickToBottomRef.current = false;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);

    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId(null);
      highlightTimeoutRef.current = null;
    }, 1800);
  }, []);

  const updateScrollState = useCallback(() => {
    const feed = feedRef.current;

    if (!feed) return;

    updateScrollPositionState(feed);

    const {
      feedKey: paginationFeedKey,
      hasOlderMessages: canLoadOlder,
      isLoadingOlderMessages: olderPageIsLoading,
      onLoadOlderMessages: loadOlder
    } = paginationRef.current;
    const scrollableHeight = feed.scrollHeight - feed.clientHeight;
    const scrollProgress =
      scrollableHeight <= 0 ? 0 : feed.scrollTop / scrollableHeight;
    if (
      scrollProgress > 0.15 ||
      !canLoadOlder ||
      olderPageIsLoading ||
      !loadOlder ||
      isLoadingOlderRef.current
    ) {
      return;
    }

    isLoadingOlderRef.current = true;
    shouldStickToBottomRef.current = false;
    const previousScrollHeight = feed.scrollHeight;
    const previousScrollTop = feed.scrollTop;

    void loadOlder()
      .then((result) => {
        if (
          result !== 'loaded' ||
          paginationRef.current.feedKey !== paginationFeedKey
        ) {
          return;
        }

        window.requestAnimationFrame(() => {
          const activeFeed = feedRef.current;
          if (
            !activeFeed ||
            paginationRef.current.feedKey !== paginationFeedKey
          ) {
            return;
          }

          activeFeed.scrollTop =
            previousScrollTop +
            Math.max(0, activeFeed.scrollHeight - previousScrollHeight);
          updateScrollPositionState(activeFeed);
        });
      })
      .finally(() => {
        isLoadingOlderRef.current = false;
      });
  }, [updateScrollPositionState]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = feedRef.current;

    if (!container) return undefined;

    container.addEventListener('scroll', updateScrollState, { passive: true });
    return () => container.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState]);

  useLayoutEffect(() => {
    if (activeFeedKeyRef.current !== feedKey) {
      activeFeedKeyRef.current = feedKey;
      shouldStickToBottomRef.current = true;
      hasPositionedCurrentFeedRef.current = false;
      setPositionedFeedKey(null);
      setCanScrollToBottom(false);
    }

    const isInitialPosition = !hasPositionedCurrentFeedRef.current;

    if (isInitialPosition && isInitialPositionPending) {
      return;
    }

    if (isInitialPosition && initialMessageId) {
      const feed = feedRef.current;
      const target = feed?.querySelector<HTMLElement>(
        `[data-message-id="${initialMessageId}"]`
      );

      if (!feed || !target) {
        return;
      }

      shouldStickToBottomRef.current = false;
      target.scrollIntoView({ behavior: 'auto', block: 'center' });
      updateScrollPositionState(feed);
      hasPositionedCurrentFeedRef.current = true;
      setPositionedFeedKey(feedKey);
      return;
    }

    if (!shouldStickToBottomRef.current) {
      return;
    }

    scrollMessagesToBottom(isInitialPosition ? 'auto' : 'smooth');

    if (messageCount > 0) {
      hasPositionedCurrentFeedRef.current = true;
      setPositionedFeedKey(feedKey);
    }
  }, [
    feedKey,
    initialMessageId,
    isInitialPositionPending,
    messageCount,
    scrollMessagesToBottom,
    updateScrollPositionState
  ]);

  useEffect(() => {
    if (!focusedMessageId || messageCount === 0) return;

    window.requestAnimationFrame(() => jumpToMessage(focusedMessageId));
  }, [focusedMessageId, jumpToMessage, messageCount]);

  return {
    feedRef,
    canScrollToBottom,
    hasPositionedCurrentFeed: positionedFeedKey === feedKey,
    isNearBottom: !canScrollToBottom,
    highlightedMessageId,
    jumpToMessage,
    scrollMessagesToBottom,
    stickToBottom,
    updateScrollState
  };
}
