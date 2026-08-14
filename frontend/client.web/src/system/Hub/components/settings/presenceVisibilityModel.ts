import type {
  PresenceCustomVisibility,
  PresenceVisibility,
} from '../../../../shared/types'

export const defaultPresenceVisibility: PresenceVisibility = 'everyone'

export type PresenceVisibilityMode = 'everyone' | 'custom' | 'nobody'
export type PresenceVisibilityCategory =
  | 'friends'
  | 'friends_of_friends'
  | 'shared_servers'

export type PresenceVisibilityDraft = {
  mode: PresenceVisibilityMode
  friends: boolean
  friendsOfFriends: boolean
  sharedServers: boolean
}

const customPrefix = 'custom:'
const customCategoryOrder: PresenceVisibilityCategory[] = [
  'friends',
  'friends_of_friends',
  'shared_servers',
]
const legacyVisibilities = new Set<PresenceVisibility>([
  'everyone',
  'friends',
  'nobody',
])

export function normalizePresenceVisibility(
  value: unknown,
): PresenceVisibility {
  if (typeof value !== 'string') {
    return defaultPresenceVisibility
  }

  const normalized = value.trim().toLowerCase()
  if (legacyVisibilities.has(normalized as PresenceVisibility)) {
    return normalized as PresenceVisibility
  }

  const categories = parseCustomCategories(normalized)
  return categories == null
    ? defaultPresenceVisibility
    : encodeCustomVisibility(categories)
}

export function isCanonicalPresenceVisibility(
  value: unknown,
): value is PresenceVisibility {
  return (
    typeof value === 'string' &&
    normalizePresenceVisibility(value) === value
  )
}

export function toPresenceVisibilityDraft(
  value: unknown,
): PresenceVisibilityDraft {
  const visibility = normalizePresenceVisibility(value)
  if (visibility === 'everyone') {
    return emptyDraft('everyone')
  }
  if (visibility === 'nobody') {
    return emptyDraft('nobody')
  }
  if (visibility === 'friends') {
    return {
      ...emptyDraft('custom'),
      friends: true,
    }
  }

  return categoriesToDraft(
    parseCustomCategories(visibility) ?? new Set(),
  )
}

export function serializePresenceVisibility(
  draft: PresenceVisibilityDraft,
): PresenceVisibility {
  if (draft.mode === 'everyone') {
    return 'everyone'
  }
  if (draft.mode === 'nobody') {
    return 'nobody'
  }

  const categories = new Set<PresenceVisibilityCategory>()
  if (draft.friends) categories.add('friends')
  if (draft.friendsOfFriends) categories.add('friends_of_friends')
  if (draft.sharedServers) categories.add('shared_servers')

  return categories.size === 0
    ? 'nobody'
    : encodeCustomVisibility(categories)
}

export function selectPresenceVisibilityGlobal(
  mode: Exclude<PresenceVisibilityMode, 'custom'>,
): PresenceVisibilityDraft {
  return emptyDraft(mode)
}

export function togglePresenceVisibilityCategory(
  draft: PresenceVisibilityDraft,
  category: PresenceVisibilityCategory,
  checked: boolean,
): PresenceVisibilityDraft {
  const next = {
    ...draft,
    mode: 'custom' as const,
    friends:
      category === 'friends' ? checked : draft.friends,
    friendsOfFriends:
      category === 'friends_of_friends'
        ? checked
        : draft.friendsOfFriends,
    sharedServers:
      category === 'shared_servers' ? checked : draft.sharedServers,
  }

  return next.friends ||
    next.friendsOfFriends ||
    next.sharedServers
    ? next
    : emptyDraft('nobody')
}

function parseCustomCategories(
  value: string,
): Set<PresenceVisibilityCategory> | null {
  if (!value.startsWith(customPrefix)) {
    return null
  }

  const tokens = value
    .slice(customPrefix.length)
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
  const categories = new Set(tokens)
  if (
    tokens.length === 0 ||
    categories.size !== tokens.length ||
    [...categories].some(
      (category) =>
        !customCategoryOrder.includes(
          category as PresenceVisibilityCategory,
        ),
    )
  ) {
    return null
  }

  return categories as Set<PresenceVisibilityCategory>
}

function encodeCustomVisibility(
  categories: ReadonlySet<PresenceVisibilityCategory>,
): PresenceCustomVisibility {
  return `${customPrefix}${customCategoryOrder
    .filter((category) => categories.has(category))
    .join(',')}` as PresenceCustomVisibility
}

function categoriesToDraft(
  categories: ReadonlySet<PresenceVisibilityCategory>,
): PresenceVisibilityDraft {
  return {
    mode: 'custom',
    friends: categories.has('friends'),
    friendsOfFriends: categories.has('friends_of_friends'),
    sharedServers: categories.has('shared_servers'),
  }
}

function emptyDraft(
  mode: Exclude<PresenceVisibilityMode, 'custom'> | 'custom',
): PresenceVisibilityDraft {
  return {
    mode,
    friends: false,
    friendsOfFriends: false,
    sharedServers: false,
  }
}
