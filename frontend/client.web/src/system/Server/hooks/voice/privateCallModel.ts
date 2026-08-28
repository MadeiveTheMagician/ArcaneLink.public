import type { PrivateCallState } from './voiceChannelTypes'
import { normalizeUserId } from './voiceChannelUtils'
import type { PrivateCallAudioMode } from '../../../shared/voice/privateCallRingtone'

const phaseRank = {
  ringing: 0,
  active: 1,
  ended: 2,
} as const

export function mergePrivateCallState(
  current: PrivateCallState | undefined,
  incoming: PrivateCallState,
) {
  if (!current) return incoming
  if (normalizeUserId(current.callId) !== normalizeUserId(incoming.callId)) {
    return incoming
  }

  const currentRank = phaseRank[current.phase]
  const incomingRank = phaseRank[incoming.phase]
  if (incomingRank < currentRank) return current
  if (incoming.revision <= current.revision) return current

  if (incomingRank === currentRank && incoming.phase === 'ringing') {
    const stillRinging = new Set(
      incoming.ringingUserIds.map(normalizeUserId),
    )
    return {
      ...incoming,
      ringingUserIds: current.ringingUserIds.filter((userId) =>
        stillRinging.has(normalizeUserId(userId)),
      ),
      declinedUserIds: uniqueUserIds([
        ...current.declinedUserIds,
        ...incoming.declinedUserIds,
      ]),
    }
  }

  return incoming
}

export function shouldDisconnectForPrivateCallState(
  call: PrivateCallState,
  connectedPrivateSpaceId: string | null,
) {
  return Boolean(
    call.phase === 'ended' &&
      connectedPrivateSpaceId &&
      normalizeUserId(call.spaceId) ===
        normalizeUserId(connectedPrivateSpaceId),
  )
}

export function selectIncomingPrivateCalls(
  calls: readonly PrivateCallState[],
  currentUserId: string,
  dismissedCallIds: ReadonlySet<string> = new Set(),
) {
  const normalizedCurrentUserId = normalizeUserId(currentUserId)
  const normalizedDismissedIds = new Set(
    [...dismissedCallIds].map(normalizeUserId),
  )

  return calls
    .filter(
      (call) =>
        call.phase === 'ringing' &&
        !normalizedDismissedIds.has(normalizeUserId(call.callId)) &&
        call.ringingUserIds.some(
          (userId) => normalizeUserId(userId) === normalizedCurrentUserId,
        ),
    )
    .sort(
      (left, right) =>
        Date.parse(left.startedAt) - Date.parse(right.startedAt),
    )
}

export function resolvePrivateCallAudioMode(
  calls: readonly PrivateCallState[],
  currentUserId: string,
  dismissedCallIds: ReadonlySet<string> = new Set(),
): PrivateCallAudioMode | null {
  if (selectIncomingPrivateCalls(calls, currentUserId, dismissedCallIds).length) {
    return 'incoming'
  }

  const normalizedCurrentUserId = normalizeUserId(currentUserId)
  return calls.some(
    (call) =>
      call.phase === 'ringing' &&
      normalizeUserId(call.caller.userId) === normalizedCurrentUserId &&
      call.ringingUserIds.length > 0 &&
      ![...dismissedCallIds].some(
        (callId) => normalizeUserId(callId) === normalizeUserId(call.callId),
      ),
  )
    ? 'outgoing'
    : null
}

function uniqueUserIds(userIds: readonly string[]) {
  const seen = new Set<string>()
  return userIds.filter((userId) => {
    const normalized = normalizeUserId(userId)
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}
