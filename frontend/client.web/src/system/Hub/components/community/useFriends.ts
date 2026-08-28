import { useEffect, useMemo, useState } from 'react';

import { apiJson, apiNoContent } from '../../../../shared/api/api';
import {
  readUserDataCache,
  writeUserDataCache
} from '../../../../shared/cache/clientCache';
import type {
  FriendRequestResponse,
  UserFriendResponse
} from '../../../../shared/types';
import { useUserPresenceChanged } from '../../../shared/hooks/useUserPresenceChanged';
import {
  captureUserPresenceEventBoundary,
  reconcileFriendRequestsWithLatestPresence,
  reconcileUserFriendsWithLatestPresence
} from '../../../shared/presence/presenceEventStore';
import {
  patchFriendRequestsPresence,
  patchUserFriendsPresence
} from '../../../shared/presence/presenceModel';

export function useFriends(accessToken: string, userId: string) {
  const [friends, setFriends] = useState<UserFriendResponse[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<
    FriendRequestResponse[]
  >([]);
  const [outgoingRequests, setOutgoingRequests] = useState<
    FriendRequestResponse[]
  >([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const isSearchingUsers = false;
  const [isMutatingFriends, setIsMutatingFriends] = useState(false);
  const [friendNotice, setFriendNotice] = useState<string | null>(null);

  const pendingOutgoingUserIds = useMemo(
    () => new Set(outgoingRequests.map((request) => request.toUserId)),
    [outgoingRequests]
  );
  const friendUserIds = useMemo(
    () => new Set(friends.map((friend) => friend.friendUserId)),
    [friends]
  );

  useUserPresenceChanged((payload) => {
    setFriends((current) => patchUserFriendsPresence(current, payload));
    setIncomingRequests((current) =>
      patchFriendRequestsPresence(current, payload)
    );
    setOutgoingRequests((current) =>
      patchFriendRequestsPresence(current, payload)
    );
  });

  async function loadFriends(silent = false) {
    if (!silent) {
      setIsLoadingFriends(true);
    }

    try {
      const presenceBoundary = captureUserPresenceEventBoundary(userId);
      const [rawFriendsResponse, rawIncomingResponse, rawOutgoingResponse] =
        await Promise.all([
          apiJson<UserFriendResponse[]>('/api/friends', { accessToken }),
          apiJson<FriendRequestResponse[]>('/api/friends/requests/incoming', {
            accessToken
          }),
          apiJson<FriendRequestResponse[]>('/api/friends/requests/outgoing', {
            accessToken
          })
        ]);
      const friendsResponse = reconcileUserFriendsWithLatestPresence(
        rawFriendsResponse,
        presenceBoundary
      );
      const incomingResponse = reconcileFriendRequestsWithLatestPresence(
        rawIncomingResponse,
        presenceBoundary
      );
      const outgoingResponse = reconcileFriendRequestsWithLatestPresence(
        rawOutgoingResponse,
        presenceBoundary
      );

      setFriends(friendsResponse);
      setIncomingRequests(incomingResponse);
      setOutgoingRequests(outgoingResponse);
      void writeUserDataCache(userId, 'friends', {
        friends: friendsResponse,
        incomingRequests: incomingResponse,
        outgoingRequests: outgoingResponse
      });
    } finally {
      if (!silent) {
        setIsLoadingFriends(false);
      }
    }
  }

  useEffect(() => {
    let isDisposed = false;

    void readUserDataCache(userId, 'friends').then((snapshot) => {
      if (!isDisposed && snapshot) {
        setFriends(reconcileUserFriendsWithLatestPresence(snapshot.friends));
        setIncomingRequests(
          reconcileFriendRequestsWithLatestPresence(snapshot.incomingRequests)
        );
        setOutgoingRequests(
          reconcileFriendRequestsWithLatestPresence(snapshot.outgoingRequests)
        );
      }
    });

    void loadFriends();
    return () => {
      isDisposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, userId]);

  async function sendFriendRequest(toUserId: string) {
    setIsMutatingFriends(true);
    setFriendNotice(null);

    try {
      await apiJson<FriendRequestResponse>('/api/friends/requests', {
        method: 'POST',
        accessToken,
        body: { toUserId }
      });
      setFriendNotice('Friend request sent.');
      await loadFriends();
    } finally {
      setIsMutatingFriends(false);
    }
  }

  async function acceptFriendRequest(requestId: string) {
    await mutateRequest(
      `/api/friends/requests/${requestId}/accept`,
      'accepted'
    );
  }

  async function declineFriendRequest(requestId: string) {
    await mutateRequest(
      `/api/friends/requests/${requestId}/decline`,
      'declined'
    );
  }

  async function cancelFriendRequest(requestId: string) {
    await mutateRequest(
      `/api/friends/requests/${requestId}/cancel`,
      'canceled'
    );
  }

  async function removeFriend(friendUserId: string) {
    setIsMutatingFriends(true);
    setFriendNotice(null);

    try {
      await apiNoContent(`/api/friends/${friendUserId}`, {
        method: 'DELETE',
        accessToken
      });

      setFriendNotice('Friend removed.');
      await loadFriends();
    } finally {
      setIsMutatingFriends(false);
    }
  }

  async function mutateRequest(url: string, action: string) {
    setIsMutatingFriends(true);
    setFriendNotice(null);

    try {
      await apiJson<FriendRequestResponse>(url, {
        method: 'POST',
        accessToken
      });
      setFriendNotice(`Request ${action}.`);
      await loadFriends();
    } finally {
      setIsMutatingFriends(false);
    }
  }

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    searchQuery,
    isLoadingFriends,
    isSearchingUsers,
    isMutatingFriends,
    friendNotice,
    pendingOutgoingUserIds,
    friendUserIds,
    setSearchQuery,
    loadFriends,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    removeFriend
  };
}
