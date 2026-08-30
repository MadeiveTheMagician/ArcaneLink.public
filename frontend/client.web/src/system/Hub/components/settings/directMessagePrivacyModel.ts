import type {
  DirectMessageCustomPermission,
  DirectMessagePermission
} from '../../../../shared/types';
import type { ProfileSettingsDraft } from '../../../Profile/hooks/useProfileSettings';

export const defaultDirectMessagePermission: DirectMessagePermission =
  'everyone';

export type DirectMessagePrivacyMode = 'everyone' | 'custom' | 'nobody';
export type DirectMessagePrivacyCategory =
  'friends' | 'friends_of_friends' | 'shared_servers';

export type DirectMessagePrivacyDraft = {
  mode: DirectMessagePrivacyMode;
  friends: boolean;
  friendsOfFriends: boolean;
  sharedServers: boolean;
};

const customPrefix = 'custom:';
const customCategoryOrder: DirectMessagePrivacyCategory[] = [
  'friends',
  'friends_of_friends',
  'shared_servers'
];
const legacyPermissions = new Set<DirectMessagePermission>([
  'everyone',
  'friends',
  'shared_servers',
  'nobody'
]);

export function normalizeDirectMessagePermission(
  value: unknown
): DirectMessagePermission {
  if (typeof value !== 'string') {
    return defaultDirectMessagePermission;
  }

  const normalized = value.trim().toLowerCase();
  if (legacyPermissions.has(normalized as DirectMessagePermission)) {
    return normalized as DirectMessagePermission;
  }

  const categories = parseCustomCategories(normalized);
  return categories == null
    ? defaultDirectMessagePermission
    : encodeCustomPermission(categories);
}

export function toDirectMessagePrivacyDraft(
  value: unknown
): DirectMessagePrivacyDraft {
  const permission = normalizeDirectMessagePermission(value);
  if (permission === 'everyone') {
    return emptyDraft('everyone');
  }
  if (permission === 'nobody') {
    return emptyDraft('nobody');
  }
  if (permission === 'friends') {
    return {
      ...emptyDraft('custom'),
      friends: true
    };
  }
  if (permission === 'shared_servers') {
    return {
      ...emptyDraft('custom'),
      sharedServers: true
    };
  }

  return categoriesToDraft(parseCustomCategories(permission) ?? new Set());
}

export function serializeDirectMessagePrivacy(
  draft: DirectMessagePrivacyDraft
): DirectMessagePermission {
  if (draft.mode === 'everyone') {
    return 'everyone';
  }
  if (draft.mode === 'nobody') {
    return 'nobody';
  }

  const categories = new Set<DirectMessagePrivacyCategory>();
  if (draft.friends) categories.add('friends');
  if (draft.friendsOfFriends) categories.add('friends_of_friends');
  if (draft.sharedServers) categories.add('shared_servers');

  return categories.size === 0 ? 'nobody' : encodeCustomPermission(categories);
}

export function selectDirectMessageGlobal(
  mode: Exclude<DirectMessagePrivacyMode, 'custom'>
): DirectMessagePrivacyDraft {
  return emptyDraft(mode);
}

export function toggleDirectMessageCategory(
  draft: DirectMessagePrivacyDraft,
  category: DirectMessagePrivacyCategory,
  checked: boolean
): DirectMessagePrivacyDraft {
  const next = {
    ...draft,
    mode: 'custom' as const,
    friends: category === 'friends' ? checked : draft.friends,
    friendsOfFriends:
      category === 'friends_of_friends' ? checked : draft.friendsOfFriends,
    sharedServers: category === 'shared_servers' ? checked : draft.sharedServers
  };

  return next.friends || next.friendsOfFriends || next.sharedServers
    ? next
    : emptyDraft('nobody');
}

export function mergeDirectMessagePermission(
  settings: ProfileSettingsDraft,
  permission: DirectMessagePermission | DirectMessagePrivacyDraft
): ProfileSettingsDraft {
  return {
    ...settings,
    directMessagePermission:
      typeof permission === 'string'
        ? normalizeDirectMessagePermission(permission)
        : serializeDirectMessagePrivacy(permission)
  };
}

function parseCustomCategories(
  value: string
): Set<DirectMessagePrivacyCategory> | null {
  if (!value.startsWith(customPrefix)) {
    return null;
  }

  const tokens = value
    .slice(customPrefix.length)
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  const categories = new Set(tokens);
  if (
    tokens.length === 0 ||
    categories.size !== tokens.length ||
    [...categories].some(
      (category) =>
        !customCategoryOrder.includes(category as DirectMessagePrivacyCategory)
    )
  ) {
    return null;
  }

  return categories as Set<DirectMessagePrivacyCategory>;
}

function encodeCustomPermission(
  categories: ReadonlySet<DirectMessagePrivacyCategory>
): DirectMessageCustomPermission {
  return `${customPrefix}${customCategoryOrder
    .filter((category) => categories.has(category))
    .join(',')}` as DirectMessageCustomPermission;
}

function categoriesToDraft(
  categories: ReadonlySet<DirectMessagePrivacyCategory>
): DirectMessagePrivacyDraft {
  return {
    mode: 'custom',
    friends: categories.has('friends'),
    friendsOfFriends: categories.has('friends_of_friends'),
    sharedServers: categories.has('shared_servers')
  };
}

function emptyDraft(
  mode: Exclude<DirectMessagePrivacyMode, 'custom'> | 'custom'
): DirectMessagePrivacyDraft {
  return {
    mode,
    friends: false,
    friendsOfFriends: false,
    sharedServers: false
  };
}
