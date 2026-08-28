import { useCallback, useEffect, useState } from 'react';

export type NotificationPreferences = {
  enabled: boolean;
  privateMessages: boolean;
  mentions: boolean;
  serverInvites: boolean;
  privateSpaceInvites: boolean;
  system: boolean;
  placement: 'bottom-right' | 'bottom-left';
};

export const defaultNotificationPreferences: NotificationPreferences = {
  enabled: true,
  privateMessages: true,
  mentions: true,
  serverInvites: true,
  privateSpaceInvites: true,
  system: true,
  placement: 'bottom-right'
};

type NotificationPreferencesStorage = Pick<Storage, 'getItem' | 'setItem'> & {
  removeItem?: Storage['removeItem'];
};

type NotificationPreferencesChangedDetail = {
  userId: string;
  preferences: NotificationPreferences;
};

const legacyStorageKey = 'arcanelink:notification-preferences:v1';
const storageKeyPrefix = 'arcanelink:notification-preferences:v2';
const changedEventName = 'arcanelink:notification-preferences-changed';

export function getNotificationPreferencesStorageKey(userId: string) {
  return `${storageKeyPrefix}:${normalizeUserId(userId)}`;
}

export function loadNotificationPreferences(
  userId: string,
  storage: NotificationPreferencesStorage = window.localStorage
): NotificationPreferences {
  try {
    const userStorageKey = getNotificationPreferencesStorageKey(userId);
    const scopedRaw = storage.getItem(userStorageKey);
    if (scopedRaw) {
      return parseNotificationPreferences(scopedRaw);
    }

    const legacyRaw = storage.getItem(legacyStorageKey);
    if (!legacyRaw) {
      return defaultNotificationPreferences;
    }

    const migrated = parseNotificationPreferences(legacyRaw);
    storage.setItem(userStorageKey, JSON.stringify(migrated));
    storage.removeItem?.(legacyStorageKey);
    return migrated;
  } catch {
    return defaultNotificationPreferences;
  }
}

export function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
  storage: NotificationPreferencesStorage = window.localStorage
) {
  storage.setItem(
    getNotificationPreferencesStorageKey(userId),
    JSON.stringify(preferences)
  );
}

export function parseNotificationPreferences(
  raw: string
): NotificationPreferences {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      enabled: readBoolean(
        value.enabled,
        defaultNotificationPreferences.enabled
      ),
      privateMessages: readBoolean(
        value.privateMessages,
        defaultNotificationPreferences.privateMessages
      ),
      mentions: readBoolean(
        value.mentions,
        defaultNotificationPreferences.mentions
      ),
      serverInvites: readBoolean(
        value.serverInvites,
        defaultNotificationPreferences.serverInvites
      ),
      privateSpaceInvites: readBoolean(
        value.privateSpaceInvites,
        defaultNotificationPreferences.privateSpaceInvites
      ),
      system: readBoolean(value.system, defaultNotificationPreferences.system),
      placement:
        value.placement === 'bottom-left' || value.placement === 'bottom-right'
          ? value.placement
          : defaultNotificationPreferences.placement
    };
  } catch {
    return defaultNotificationPreferences;
  }
}

export function useNotificationPreferences(userId: string) {
  const normalizedUserId = normalizeUserId(userId);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    loadNotificationPreferences(normalizedUserId)
  );

  useEffect(() => {
    setPreferences(loadNotificationPreferences(normalizedUserId));
  }, [normalizedUserId]);

  useEffect(() => {
    function handleChange(event: Event) {
      const detail = (
        event as CustomEvent<NotificationPreferencesChangedDetail>
      ).detail;
      if (detail?.userId === normalizedUserId) {
        setPreferences(detail.preferences);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key === getNotificationPreferencesStorageKey(normalizedUserId)
      ) {
        setPreferences(loadNotificationPreferences(normalizedUserId));
      }
    }

    window.addEventListener(changedEventName, handleChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(changedEventName, handleChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [normalizedUserId]);

  const updatePreferences = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      const next = { ...preferences, ...patch };
      try {
        saveNotificationPreferences(normalizedUserId, next);
      } catch {
        // Keep the preference effective for this session if storage is blocked.
      }

      setPreferences(next);
      window.dispatchEvent(
        new CustomEvent<NotificationPreferencesChangedDetail>(
          changedEventName,
          {
            detail: {
              userId: normalizedUserId,
              preferences: next
            }
          }
        )
      );
    },
    [normalizedUserId, preferences]
  );

  return { preferences, updatePreferences };
}

function normalizeUserId(userId: string) {
  return userId.trim().toLowerCase();
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}
