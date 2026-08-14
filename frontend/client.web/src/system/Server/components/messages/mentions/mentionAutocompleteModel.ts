import type {
  ActiveMentionQuery,
  DraftMention,
  MentionOption,
  MentionRoleCandidate,
  MentionUserCandidate,
} from './messageMentionTypes'

export type MentionSuggestions = {
  readonly everyone: MentionOption | null
  readonly users: readonly MentionOption[]
  readonly roles: readonly MentionOption[]
}

export type MentionInsertion = {
  readonly text: string
  readonly caret: number
  readonly mention: DraftMention
}

const mentionQueryTerminatorPattern = /[\r\n\t,;:!?()[\]{}<>/\\"“”«»]/u
const mentionTriggerPrefixPattern = /[\p{L}\p{N}\p{M}_.%+@-]/u

const everyoneOption: MentionOption = {
  key: 'everyone',
  kind: 'everyone',
  targetId: null,
  token: '@everyone',
  label: 'everyone',
}

export function findActiveMentionQuery(
  text: string,
  caret: number,
): ActiveMentionQuery | null {
  if (!Number.isInteger(caret) || caret <= 0 || caret > text.length) {
    return null
  }

  const start = text.lastIndexOf('@', caret - 1)
  if (start < 0) {
    return null
  }

  const prefix = start > 0 ? text[start - 1] : undefined
  if (prefix && mentionTriggerPrefixPattern.test(prefix)) {
    return null
  }

  const query = text.slice(start + 1, caret)
  if (query.startsWith(' ') || mentionQueryTerminatorPattern.test(query)) {
    return null
  }

  return { start, end: caret, query }
}

export function hasPotentialMentionToken(text: string) {
  let index = text.indexOf('@')
  while (index >= 0) {
    const prefix = index > 0 ? text[index - 1] : ''
    if (!prefix || !mentionTriggerPrefixPattern.test(prefix)) {
      return true
    }
    index = text.indexOf('@', index + 1)
  }

  return false
}

export function buildMentionSuggestions({
  query,
  users,
  roles,
  maximumUsers = 5,
}: {
  query: string
  users: readonly MentionUserCandidate[]
  roles: readonly MentionRoleCandidate[]
  maximumUsers?: number
}): MentionSuggestions {
  const normalizedQuery = normalizeSearchValue(query.replace(/^@/u, ''))
  const safeMaximumUsers = Math.max(0, Math.floor(maximumUsers))

  const matchingUsers = rankCandidates(
    users,
    (user) => [user.displayName, user.login],
    normalizedQuery,
  )
    .slice(0, safeMaximumUsers)
    .map(({ candidate: user }): MentionOption => ({
      key: `user:${user.id}`,
      kind: 'user',
      targetId: user.id,
      token: `@${user.login}`,
      label: user.displayName,
      secondaryLabel: `@${user.login}`,
      avatarAssetId: user.avatarAssetId ?? null,
      avatarCropOffsetX: user.avatarCropOffsetX ?? 0,
      avatarCropOffsetY: user.avatarCropOffsetY ?? 0,
      avatarCropZoom: user.avatarCropZoom ?? 1,
    }))

  const matchingRoles = rankCandidates(
    roles,
    (role) => [role.title],
    normalizedQuery,
  ).map(({ candidate: role }): MentionOption => ({
    key: `role:${role.id}`,
    kind: 'role',
    targetId: role.id,
    token: `@${role.title}`,
    label: role.title,
  }))

  return {
    everyone: getMatchRank(everyoneOption.label, normalizedQuery) == null
      ? null
      : everyoneOption,
    users: matchingUsers,
    roles: matchingRoles,
  }
}

export function insertMentionOption(
  text: string,
  query: ActiveMentionQuery,
  option: MentionOption,
): MentionInsertion | null {
  if (
    query.start < 0 ||
    query.end < query.start ||
    query.end > text.length ||
    text[query.start] !== '@' ||
    !isUsableMentionOption(option)
  ) {
    return null
  }

  const nextCharacter = text[query.end]
  const separator = nextCharacter == null || isMentionWordCharacter(nextCharacter)
    ? ' '
    : ''
  const replacement = `${option.token}${separator}`

  return {
    text: `${text.slice(0, query.start)}${replacement}${text.slice(query.end)}`,
    caret: query.start + replacement.length,
    mention: {
      kind: option.kind,
      targetId: option.targetId,
      token: option.token,
      start: query.start,
      length: option.token.length,
    },
  }
}

export function normalizeMentionSearchValue(value: string) {
  return normalizeSearchValue(value)
}

function normalizeSearchValue(value: string) {
  return value.normalize('NFKC').trim().toLowerCase()
}

function getMatchRank(value: string, normalizedQuery: string) {
  const normalizedValue = normalizeSearchValue(value)
  if (normalizedQuery.length === 0) {
    return 0
  }
  if (normalizedValue === normalizedQuery) {
    return 0
  }
  if (normalizedValue.startsWith(normalizedQuery)) {
    return 1
  }
  if (normalizedValue.includes(normalizedQuery)) {
    return 2
  }
  return null
}

function rankCandidates<T>(
  candidates: readonly T[],
  getSearchValues: (candidate: T) => readonly string[],
  normalizedQuery: string,
) {
  return candidates
    .map((candidate, originalIndex) => {
      const rank = getSearchValues(candidate).reduce<number | null>(
        (bestRank, value) => {
          const currentRank = getMatchRank(value, normalizedQuery)
          if (currentRank == null) {
            return bestRank
          }
          return bestRank == null
            ? currentRank
            : Math.min(bestRank, currentRank)
        },
        null,
      )

      return rank == null
        ? null
        : { candidate, originalIndex, rank }
    })
    .filter(
      (item): item is { candidate: T; originalIndex: number; rank: number } =>
        item != null,
    )
    .sort((left, right) =>
      left.rank - right.rank || left.originalIndex - right.originalIndex,
    )
}

function isUsableMentionOption(option: MentionOption) {
  if (!option.token.startsWith('@') || option.token.length <= 1) {
    return false
  }

  if (option.kind === 'everyone') {
    return option.targetId == null && option.token === '@everyone'
  }

  return typeof option.targetId === 'string' && option.targetId.length > 0
}

function isMentionWordCharacter(value: string) {
  return /[\p{L}\p{N}\p{M}_@-]/u.test(value)
}
