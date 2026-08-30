import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiJson, apiNoContent } from '../../../../shared/api/api';
import type {
  DirectMessageBlockedUserPageResponse,
  DirectMessageBlockedUserResponse,
  FriendUserResponse
} from '../../../../shared/types';
import {
  dispatchUserBlockChanged,
  isUserBlockChangedEvent,
  userBlockChangedEventName
} from '../../../shared';

const userSearchDelayMs = 250;
const minimumSearchLength = 2;

export function useDirectMessageBlocklist(accessToken: string) {
  const [blockedUsers, setBlockedUsers] = useState<
    DirectMessageBlockedUserResponse[]
  >([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [mutatingUserId, setMutatingUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const localMutationUserIdsRef = useRef(new Set<string>());

  const blockedUserIds = useMemo(
    () => new Set(blockedUsers.map((user) => user.userId)),
    [blockedUsers]
  );

  const loadBlockedUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await apiJson<DirectMessageBlockedUserPageResponse>(
        '/api/users/me/direct-message-blocks?limit=100',
        { accessToken }
      );
      setBlockedUsers(response.items);
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (error) {
      setLoadError(readErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadBlockedUsers();
  }, [loadBlockedUsers]);

  useEffect(() => {
    function syncBlockChange(event: Event) {
      if (!isUserBlockChangedEvent(event)) return;
      if (localMutationUserIdsRef.current.delete(event.detail.userId)) return;

      if (!event.detail.isBlocked) {
        setBlockedUsers((current) =>
          current.filter((user) => user.userId !== event.detail.userId)
        );
        setTotalCount((current) => Math.max(0, current - 1));
        return;
      }

      if (!blockedUserIds.has(event.detail.userId)) {
        void loadBlockedUsers();
        return;
      }

      setBlockedUsers((current) =>
        current.map((user) =>
          user.userId === event.detail.userId
            ? { ...user, comment: event.detail.comment }
            : user
        )
      );
    }

    window.addEventListener(userBlockChangedEventName, syncBlockChange);
    return () =>
      window.removeEventListener(userBlockChangedEventName, syncBlockChange);
  }, [blockedUserIds, loadBlockedUsers]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length < minimumSearchLength) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      setSearchError(null);

      void apiJson<FriendUserResponse[]>(
        `/api/users/search?query=${encodeURIComponent(normalizedQuery)}`,
        {
          accessToken,
          signal: controller.signal
        }
      )
        .then((response) => {
          if (!controller.signal.aborted) {
            setSearchResults(response);
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setSearchResults([]);
            setSearchError(readErrorMessage(error));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        });
    }, userSearchDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [accessToken, searchQuery]);

  const loadMoreBlockedUsers = useCallback(async () => {
    if (!nextCursor || isLoading || isLoadingMore) return;

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const response = await apiJson<DirectMessageBlockedUserPageResponse>(
        `/api/users/me/direct-message-blocks?limit=100&cursor=${encodeURIComponent(
          nextCursor
        )}`,
        { accessToken }
      );
      setBlockedUsers((current) => {
        const knownIds = new Set(current.map((user) => user.userId));
        return [
          ...current,
          ...response.items.filter((user) => !knownIds.has(user.userId))
        ];
      });
      setNextCursor(response.nextCursor);
      setTotalCount(response.totalCount);
    } catch (error) {
      setLoadError(readErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  }, [accessToken, isLoading, isLoadingMore, nextCursor]);

  async function blockUser(userId: string, comment: string | null = null) {
    setMutatingUserId(userId);
    setMutationError(null);

    try {
      const blockedUser = await apiJson<DirectMessageBlockedUserResponse>(
        `/api/users/me/direct-message-blocks/${userId}`,
        {
          method: 'PUT',
          accessToken,
          body: { comment }
        }
      );
      setBlockedUsers((current) => [
        blockedUser,
        ...current.filter((user) => user.userId !== blockedUser.userId)
      ]);
      setTotalCount((current) =>
        blockedUserIds.has(blockedUser.userId) ? current : current + 1
      );
      localMutationUserIdsRef.current.add(blockedUser.userId);
      dispatchUserBlockChanged({
        userId: blockedUser.userId,
        isBlocked: true,
        comment: blockedUser.comment
      });
      return blockedUser;
    } catch (error) {
      setMutationError(readErrorMessage(error));
      throw error;
    } finally {
      setMutatingUserId(null);
    }
  }

  async function unblockUser(userId: string) {
    setMutatingUserId(userId);
    setMutationError(null);

    try {
      await apiNoContent(`/api/users/me/direct-message-blocks/${userId}`, {
        method: 'DELETE',
        accessToken
      });
      setBlockedUsers((current) =>
        current.filter((user) => user.userId !== userId)
      );
      setTotalCount((current) => Math.max(0, current - 1));
      localMutationUserIdsRef.current.add(userId);
      dispatchUserBlockChanged({
        userId,
        isBlocked: false,
        comment: null
      });
    } catch (error) {
      setMutationError(readErrorMessage(error));
      throw error;
    } finally {
      setMutatingUserId(null);
    }
  }

  return {
    blockedUsers,
    blockedUserIds,
    searchQuery,
    searchResults,
    isLoading,
    isLoadingMore,
    isSearching,
    hasMore: nextCursor != null,
    totalCount,
    mutatingUserId,
    loadError,
    searchError,
    mutationError,
    setSearchQuery,
    loadBlockedUsers,
    loadMoreBlockedUsers,
    blockUser,
    unblockUser
  };
}

function readErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Не удалось выполнить запрос.';
}
