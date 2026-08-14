import type { SpaceMentionCandidatesResponse } from '../../../../../shared/types'

export const mentionCandidateDebounceMs = 180

const maximumCachedUsers = 100
const maximumCachedRoles = 100

type MentionCandidateRefresh = (
  query: string,
  signal: AbortSignal,
) => void | Promise<unknown>

export function scheduleMentionCandidateQuery(
  refresh: MentionCandidateRefresh,
  query: string,
  delayMs = mentionCandidateDebounceMs,
) {
  const controller = new AbortController()
  let hasStarted = false
  const timeoutId = setTimeout(() => {
    hasStarted = true
    void Promise.resolve(refresh(query, controller.signal)).catch(() => undefined)
  }, Math.max(0, delayMs))

  return () => {
    if (!hasStarted) {
      clearTimeout(timeoutId)
    }
    controller.abort()
  }
}

export function buildMentionCandidateRequestPath(
  serverId: string,
  spaceId: string,
  query: string,
) {
  const params = new URLSearchParams({ query })
  return `/api/servers/${serverId}/spaces/${spaceId}/messages/mention-candidates?${params.toString()}`
}

export function mergeMentionCandidateResponses(
  current: SpaceMentionCandidatesResponse,
  latest: SpaceMentionCandidatesResponse,
): SpaceMentionCandidatesResponse {
  return {
    users: mergeById(latest.users, current.users).slice(0, maximumCachedUsers),
    roles: mergeById(latest.roles, current.roles).slice(0, maximumCachedRoles),
  }
}

function mergeById<T extends { id: string }>(
  preferred: readonly T[],
  fallback: readonly T[],
) {
  const merged = new Map(preferred.map((candidate) => [candidate.id, candidate]))
  for (const candidate of fallback) {
    if (!merged.has(candidate.id)) {
      merged.set(candidate.id, candidate)
    }
  }
  return [...merged.values()]
}
