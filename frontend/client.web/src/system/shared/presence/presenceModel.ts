import type {
  FriendRequestResponse,
  FriendUserResponse,
  PresenceStatus,
  PrivateSpaceResponse,
  PublicUserProfileResponse,
  ServerMemberDetailsResponse,
  UserFriendResponse,
  UserResponse
} from '../../../shared/types';

export type UserPresenceChangedPayload = {
  userId: string;
  presenceStatus: PresenceStatus;
  lastSeenAt: string | null;
  changedAt: string;
};

type PresenceUserSnapshot = {
  id: string;
  presenceStatus: PresenceStatus;
  lastSeenAt: string | null;
};

export type UserPresenceLookup = (
  userId: string
) => UserPresenceChangedPayload | undefined;

export function isUserPresenceChangedPayload(
  value: unknown
): value is UserPresenceChangedPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<UserPresenceChangedPayload>;

  return (
    typeof payload.userId === 'string' &&
    payload.userId.trim().length > 0 &&
    (payload.presenceStatus === 'online' ||
      payload.presenceStatus === 'offline') &&
    (payload.lastSeenAt === null || typeof payload.lastSeenAt === 'string') &&
    typeof payload.changedAt === 'string' &&
    payload.changedAt.trim().length > 0 &&
    Number.isFinite(Date.parse(payload.changedAt))
  );
}

export function isPresenceOnline(status: PresenceStatus) {
  return status === 'online';
}

export function patchPresenceUser<T extends PresenceUserSnapshot>(
  user: T,
  payload: UserPresenceChangedPayload
): T {
  if (!sameUserId(user.id, payload.userId)) {
    return user;
  }

  if (
    user.presenceStatus === payload.presenceStatus &&
    user.lastSeenAt === payload.lastSeenAt
  ) {
    return user;
  }

  return {
    ...user,
    presenceStatus: payload.presenceStatus,
    lastSeenAt: payload.lastSeenAt
  };
}

export function patchCurrentUserPresence(
  user: UserResponse,
  payload: UserPresenceChangedPayload
) {
  return patchPresenceUser(user, payload);
}

export function patchPublicProfilePresence<
  TProfile extends PublicUserProfileResponse
>(profile: TProfile, payload: UserPresenceChangedPayload): TProfile {
  return patchPresenceUser(profile, payload);
}

export function patchFriendUsersPresence(
  users: FriendUserResponse[],
  payload: UserPresenceChangedPayload
) {
  return mapPreservingIdentity(users, (user) =>
    patchPresenceUser(user, payload)
  );
}

export function patchUserFriendsPresence(
  friends: UserFriendResponse[],
  payload: UserPresenceChangedPayload
) {
  return mapPreservingIdentity(friends, (friend) => {
    const nextFriend = patchPresenceUser(friend.friend, payload);

    return nextFriend === friend.friend
      ? friend
      : { ...friend, friend: nextFriend };
  });
}

export function patchFriendRequestsPresence(
  requests: FriendRequestResponse[],
  payload: UserPresenceChangedPayload
) {
  return mapPreservingIdentity(requests, (request) => {
    const fromUser = patchPresenceUser(request.fromUser, payload);
    const toUser = patchPresenceUser(request.toUser, payload);

    return fromUser === request.fromUser && toUser === request.toUser
      ? request
      : { ...request, fromUser, toUser };
  });
}

export function patchPrivateSpacesPresence(
  spaces: PrivateSpaceResponse[],
  payload: UserPresenceChangedPayload
) {
  return mapPreservingIdentity(spaces, (space) => {
    const members = mapPreservingIdentity(space.members, (member) => {
      const user = patchPresenceUser(member.user, payload);

      return user === member.user ? member : { ...member, user };
    });

    return members === space.members ? space : { ...space, members };
  });
}

export function patchServerMembersPresence(
  members: ServerMemberDetailsResponse[],
  payload: UserPresenceChangedPayload
) {
  return mapPreservingIdentity(members, (member) => {
    const user = patchPresenceUser(member.user, payload);

    return user === member.user ? member : { ...member, user };
  });
}

export function reconcilePresenceUser<T extends PresenceUserSnapshot>(
  user: T,
  getLatestPresence: UserPresenceLookup
) {
  const payload = getLatestPresence(user.id);

  return payload ? patchPresenceUser(user, payload) : user;
}

export function reconcileFriendUsersPresence(
  users: FriendUserResponse[],
  getLatestPresence: UserPresenceLookup
) {
  return mapPreservingIdentity(users, (user) =>
    reconcilePresenceUser(user, getLatestPresence)
  );
}

export function reconcileUserFriendsPresence(
  friends: UserFriendResponse[],
  getLatestPresence: UserPresenceLookup
) {
  return mapPreservingIdentity(friends, (friend) => {
    const nextFriend = reconcilePresenceUser(friend.friend, getLatestPresence);

    return nextFriend === friend.friend
      ? friend
      : { ...friend, friend: nextFriend };
  });
}

export function reconcileFriendRequestsPresence(
  requests: FriendRequestResponse[],
  getLatestPresence: UserPresenceLookup
) {
  return mapPreservingIdentity(requests, (request) => {
    const fromUser = reconcilePresenceUser(request.fromUser, getLatestPresence);
    const toUser = reconcilePresenceUser(request.toUser, getLatestPresence);

    return fromUser === request.fromUser && toUser === request.toUser
      ? request
      : { ...request, fromUser, toUser };
  });
}

export function reconcilePrivateSpacesPresence(
  spaces: PrivateSpaceResponse[],
  getLatestPresence: UserPresenceLookup
) {
  return mapPreservingIdentity(spaces, (space) => {
    const members = mapPreservingIdentity(space.members, (member) => {
      const user = reconcilePresenceUser(member.user, getLatestPresence);

      return user === member.user ? member : { ...member, user };
    });

    return members === space.members ? space : { ...space, members };
  });
}

export function reconcileServerMembersPresence(
  members: ServerMemberDetailsResponse[],
  getLatestPresence: UserPresenceLookup
) {
  return mapPreservingIdentity(members, (member) => {
    const user = reconcilePresenceUser(member.user, getLatestPresence);

    return user === member.user ? member : { ...member, user };
  });
}

function mapPreservingIdentity<T>(items: T[], patch: (item: T) => T) {
  let didChange = false;
  const nextItems = items.map((item) => {
    const nextItem = patch(item);
    didChange ||= nextItem !== item;
    return nextItem;
  });

  return didChange ? nextItems : items;
}

export function normalizePresenceUserId(value: string) {
  return value.trim().toLowerCase();
}

function sameUserId(first: string, second: string) {
  return normalizePresenceUserId(first) === normalizePresenceUserId(second);
}
