import type {
  FriendRequestResponse,
  FriendUserResponse,
  PrivateSpaceResponse,
  PublicUserProfileResponse,
  ServerMemberDetailsResponse,
  UserFriendResponse,
  UserResponse,
} from '../../../shared/types'
import {
  isUserPresenceChangedPayload,
  normalizePresenceUserId,
  reconcileFriendRequestsPresence,
  reconcileFriendUsersPresence,
  reconcilePresenceUser,
  reconcilePrivateSpacesPresence,
  reconcileServerMembersPresence,
  reconcileUserFriendsPresence,
  type UserPresenceChangedPayload,
} from './presenceModel'

export const userPresenceEventStoreLimit = 512

type StoredPresence = {
  changedAtTicks: bigint
  acceptedSequence: bigint
  payload: UserPresenceChangedPayload
}

let activeSessionUserId: string | null = null
let acceptedEventSequence = 0n
const latestPresenceByUserId = new Map<string, StoredPresence>()

export type UserPresenceEventBoundary = Readonly<{
  sessionUserId: string | null
  acceptedSequence: bigint
}>

export function beginUserPresenceEventSession(currentUserId: string) {
  const normalizedUserId = normalizePresenceUserId(currentUserId)

  if (activeSessionUserId === normalizedUserId) {
    return
  }

  latestPresenceByUserId.clear()
  activeSessionUserId = normalizedUserId
}

export function clearUserPresenceEventStore(currentUserId?: string) {
  if (
    currentUserId &&
    activeSessionUserId !== normalizePresenceUserId(currentUserId)
  ) {
    return
  }

  latestPresenceByUserId.clear()
  activeSessionUserId = null
}

export function captureUserPresenceEventBoundary(
  currentUserId?: string,
): UserPresenceEventBoundary {
  if (currentUserId) {
    beginUserPresenceEventSession(currentUserId)
  }

  return {
    sessionUserId: activeSessionUserId,
    acceptedSequence: acceptedEventSequence,
  }
}

export function acceptUserPresenceChangedPayload(
  value: unknown,
): value is UserPresenceChangedPayload {
  if (!activeSessionUserId || !isUserPresenceChangedPayload(value)) {
    return false
  }

  const userId = normalizePresenceUserId(value.userId)
  const changedAtTicks = parseSystemTextJsonUtcTicks(value.changedAt)
  if (changedAtTicks === null) {
    return false
  }

  const current = latestPresenceByUserId.get(userId)

  if (current && changedAtTicks <= current.changedAtTicks) {
    return false
  }

  acceptedEventSequence += 1n
  latestPresenceByUserId.delete(userId)
  latestPresenceByUserId.set(userId, {
    changedAtTicks,
    acceptedSequence: acceptedEventSequence,
    payload: value,
  })
  trimPresenceEventStore()

  return true
}

export function getLatestUserPresence(
  userId: string,
  boundary?: UserPresenceEventBoundary,
) {
  if (boundary?.sessionUserId !== undefined) {
    if (boundary.sessionUserId !== activeSessionUserId) {
      return undefined
    }
  }

  const stored = latestPresenceByUserId.get(normalizePresenceUserId(userId))

  return stored &&
    (!boundary || stored.acceptedSequence > boundary.acceptedSequence)
    ? stored.payload
    : undefined
}

export function reconcileCurrentUserWithLatestPresence(
  user: UserResponse,
  boundary?: UserPresenceEventBoundary,
) {
  return reconcilePresenceUser(user, (userId) =>
    getLatestUserPresence(userId, boundary),
  )
}

export function reconcilePublicProfileWithLatestPresence<
  TProfile extends PublicUserProfileResponse,
>(
  profile: TProfile,
  boundary?: UserPresenceEventBoundary,
): TProfile {
  return reconcilePresenceUser(profile, (userId) =>
    getLatestUserPresence(userId, boundary),
  )
}

export function reconcileFriendUsersWithLatestPresence(
  users: FriendUserResponse[],
  boundary?: UserPresenceEventBoundary,
) {
  return reconcileFriendUsersPresence(users, (userId) =>
    getLatestUserPresence(userId, boundary),
  )
}

export function reconcileUserFriendsWithLatestPresence(
  friends: UserFriendResponse[],
  boundary?: UserPresenceEventBoundary,
) {
  return reconcileUserFriendsPresence(friends, (userId) =>
    getLatestUserPresence(userId, boundary),
  )
}

export function reconcileFriendRequestsWithLatestPresence(
  requests: FriendRequestResponse[],
  boundary?: UserPresenceEventBoundary,
) {
  return reconcileFriendRequestsPresence(requests, (userId) =>
    getLatestUserPresence(userId, boundary),
  )
}

export function reconcilePrivateSpacesWithLatestPresence(
  spaces: PrivateSpaceResponse[],
  boundary?: UserPresenceEventBoundary,
) {
  return reconcilePrivateSpacesPresence(spaces, (userId) =>
    getLatestUserPresence(userId, boundary),
  )
}

export function reconcilePrivateSpaceWithLatestPresence(
  space: PrivateSpaceResponse,
  boundary?: UserPresenceEventBoundary,
) {
  return reconcilePrivateSpacesWithLatestPresence([space], boundary)[0]
}

export function reconcileServerMembersWithLatestPresence(
  members: ServerMemberDetailsResponse[],
  boundary?: UserPresenceEventBoundary,
) {
  return reconcileServerMembersPresence(members, (userId) =>
    getLatestUserPresence(userId, boundary),
  )
}

export function parseSystemTextJsonUtcTicks(value: string): bigint | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?Z$/.exec(
    value,
  )

  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute, second, fraction = ''] = match
  const wholeSecond = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
  const epochMilliseconds = Date.parse(wholeSecond)

  if (!Number.isFinite(epochMilliseconds)) {
    return null
  }

  const canonicalWholeSecond = new Date(epochMilliseconds)
    .toISOString()
    .slice(0, 19)
  if (canonicalWholeSecond !== wholeSecond.slice(0, 19)) {
    return null
  }

  const fractionalTicks = BigInt(fraction.padEnd(7, '0') || '0')
  return BigInt(epochMilliseconds) * 10_000n + fractionalTicks
}

function trimPresenceEventStore() {
  while (latestPresenceByUserId.size > userPresenceEventStoreLimit) {
    const oldestUserId = latestPresenceByUserId.keys().next().value

    if (typeof oldestUserId !== 'string') {
      break
    }

    latestPresenceByUserId.delete(oldestUserId)
  }
}
