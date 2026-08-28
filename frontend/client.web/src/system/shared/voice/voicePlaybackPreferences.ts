import type { VoiceUserAudioSettings } from '../types/voicePlayback';
import {
  clampVoiceParticipantVolume,
  defaultVoiceParticipantVolume
} from './voiceParticipantVolume';

export const VOICE_PLAYBACK_PREFERENCES_VERSION = 1 as const;
export const voicePlaybackPreferencesStorageKey =
  'arcanelink:voice-playback-preferences:v1';
export const maxVoicePlaybackPreferenceEntries = 500;

export const defaultVoiceUserAudioSettings: Readonly<VoiceUserAudioSettings> =
  Object.freeze({
    volume: defaultVoiceParticipantVolume,
    isMuted: false,
    isVideoHidden: false
  });

export type VoicePlaybackPreferencesSnapshot = Record<
  string,
  VoiceUserAudioSettings
>;

export type VoicePlaybackPreferencesStorage = Pick<
  Storage,
  'getItem' | 'setItem'
>;

type StoredVoicePlaybackPreferences = {
  version: typeof VOICE_PLAYBACK_PREFERENCES_VERSION;
  settingsByUserId: VoicePlaybackPreferencesSnapshot;
};

type VoicePlaybackPreferencesListener = (
  snapshot: VoicePlaybackPreferencesSnapshot
) => void;

const listenersByOwner = new Map<
  string,
  Set<VoicePlaybackPreferencesListener>
>();
const snapshotsByOwner = new Map<string, VoicePlaybackPreferencesSnapshot>();
const ownersWithUnpersistedChanges = new Set<string>();
let isStorageListenerAttached = false;

export function normalizeVoiceUserId(userId: string) {
  return userId.trim().toLowerCase();
}

export function getVoicePlaybackPreferencesStorageKey(
  ownerUserId?: string | null
) {
  const ownerKey = normalizeVoiceOwnerId(ownerUserId);
  return ownerKey
    ? `${voicePlaybackPreferencesStorageKey}:${encodeURIComponent(ownerKey)}`
    : voicePlaybackPreferencesStorageKey;
}

export function normalizeVoiceUserAudioSettings(
  value: unknown
): VoiceUserAudioSettings {
  if (!value || typeof value !== 'object') {
    return { ...defaultVoiceUserAudioSettings };
  }

  const candidate = value as Partial<VoiceUserAudioSettings>;
  return {
    volume:
      typeof candidate.volume === 'number'
        ? clampVoiceParticipantVolume(candidate.volume)
        : defaultVoiceUserAudioSettings.volume,
    isMuted:
      typeof candidate.isMuted === 'boolean'
        ? candidate.isMuted
        : defaultVoiceUserAudioSettings.isMuted,
    isVideoHidden:
      typeof candidate.isVideoHidden === 'boolean'
        ? candidate.isVideoHidden
        : defaultVoiceUserAudioSettings.isVideoHidden
  };
}

export function parseVoicePlaybackPreferences(
  raw: string | null
): VoicePlaybackPreferencesSnapshot {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredVoicePlaybackPreferences>;
    if (
      parsed.version !== VOICE_PLAYBACK_PREFERENCES_VERSION ||
      !parsed.settingsByUserId ||
      typeof parsed.settingsByUserId !== 'object'
    ) {
      return {};
    }

    return normalizeVoicePlaybackPreferences(parsed.settingsByUserId);
  } catch {
    return {};
  }
}

export function loadVoicePlaybackPreferences(
  storage: VoicePlaybackPreferencesStorage | null = getBrowserStorage(),
  ownerUserId?: string | null
) {
  if (!storage) {
    return {};
  }

  try {
    return parseVoicePlaybackPreferences(
      storage.getItem(getVoicePlaybackPreferencesStorageKey(ownerUserId))
    );
  } catch {
    return {};
  }
}

export function getVoicePlaybackPreferencesSnapshot(
  ownerUserId?: string | null
) {
  const ownerKey = normalizeVoiceOwnerId(ownerUserId);
  let snapshot = snapshotsByOwner.get(ownerKey);
  if (!snapshot) {
    snapshot = loadVoicePlaybackPreferences(undefined, ownerKey);
    snapshotsByOwner.set(ownerKey, snapshot);
  }
  return snapshot;
}

export function subscribeVoicePlaybackPreferences(
  listener: VoicePlaybackPreferencesListener,
  ownerUserId?: string | null
) {
  const ownerKey = normalizeVoiceOwnerId(ownerUserId);
  const storage = getBrowserStorage();
  if (storage && !ownersWithUnpersistedChanges.has(ownerKey)) {
    snapshotsByOwner.set(
      ownerKey,
      loadVoicePlaybackPreferences(storage, ownerKey)
    );
  }
  const listeners = getOwnerListeners(ownerKey);
  listeners.add(listener);
  attachStorageListener();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      listenersByOwner.delete(ownerKey);
    }
  };
}

export function updateVoiceUserAudioSettings(
  userId: string,
  patch: Partial<VoiceUserAudioSettings>,
  storage: VoicePlaybackPreferencesStorage | null = getBrowserStorage(),
  ownerUserId?: string | null
) {
  const normalizedUserId = normalizeVoiceUserId(userId);
  if (!normalizedUserId) {
    return getVoicePlaybackPreferencesSnapshot(ownerUserId);
  }

  const current = getVoicePlaybackPreferencesSnapshot(ownerUserId);
  const settings = normalizeVoiceUserAudioSettings({
    ...defaultVoiceUserAudioSettings,
    ...current[normalizedUserId],
    ...patch
  });
  const nextBase = { ...current };
  if (
    !(normalizedUserId in nextBase) &&
    Object.keys(nextBase).length >= maxVoicePlaybackPreferenceEntries
  ) {
    const oldestUserId = Object.keys(nextBase)[0];
    if (oldestUserId) {
      delete nextBase[oldestUserId];
    }
  }
  const next = {
    ...nextBase,
    [normalizedUserId]: settings
  };
  return persistVoicePlaybackPreferences(next, storage, ownerUserId);
}

function normalizeVoicePlaybackPreferences(
  value: Record<string, unknown>
): VoicePlaybackPreferencesSnapshot {
  const normalized: VoicePlaybackPreferencesSnapshot = {};

  for (const [userId, settings] of Object.entries(value).slice(
    0,
    maxVoicePlaybackPreferenceEntries
  )) {
    const normalizedUserId = normalizeVoiceUserId(userId);
    if (!normalizedUserId) {
      continue;
    }
    normalized[normalizedUserId] = normalizeVoiceUserAudioSettings(settings);
  }

  return normalized;
}

function persistVoicePlaybackPreferences(
  snapshot: VoicePlaybackPreferencesSnapshot,
  storage: VoicePlaybackPreferencesStorage | null,
  ownerUserId?: string | null
) {
  const ownerKey = normalizeVoiceOwnerId(ownerUserId);
  const normalized = normalizeVoicePlaybackPreferences(snapshot);
  const stored: StoredVoicePlaybackPreferences = {
    version: VOICE_PLAYBACK_PREFERENCES_VERSION,
    settingsByUserId: normalized
  };

  if (storage) {
    try {
      storage.setItem(
        getVoicePlaybackPreferencesStorageKey(ownerKey),
        JSON.stringify(stored)
      );
      ownersWithUnpersistedChanges.delete(ownerKey);
    } catch {
      // The in-memory preferences remain active when storage is unavailable.
      ownersWithUnpersistedChanges.add(ownerKey);
    }
  } else {
    ownersWithUnpersistedChanges.add(ownerKey);
  }

  snapshotsByOwner.set(ownerKey, normalized);
  listenersByOwner.get(ownerKey)?.forEach((listener) => listener(normalized));
  return normalized;
}

function attachStorageListener() {
  if (
    typeof window === 'undefined' ||
    typeof window.addEventListener !== 'function' ||
    isStorageListenerAttached
  ) {
    return;
  }

  isStorageListenerAttached = true;
  window.addEventListener('storage', (event) => {
    const ownerKey = resolveVoicePlaybackOwnerFromStorageKey(event.key);
    if (ownerKey === null) {
      return;
    }

    const snapshot = parseVoicePlaybackPreferences(event.newValue);
    ownersWithUnpersistedChanges.delete(ownerKey);
    snapshotsByOwner.set(ownerKey, snapshot);
    listenersByOwner.get(ownerKey)?.forEach((listener) => listener(snapshot));
  });
}

function resolveVoicePlaybackOwnerFromStorageKey(key: string | null) {
  if (key === voicePlaybackPreferencesStorageKey) {
    return '';
  }

  const prefix = `${voicePlaybackPreferencesStorageKey}:`;
  if (!key?.startsWith(prefix)) {
    return null;
  }

  try {
    return normalizeVoiceOwnerId(decodeURIComponent(key.slice(prefix.length)));
  } catch {
    return null;
  }
}

function normalizeVoiceOwnerId(ownerUserId?: string | null) {
  return normalizeVoiceUserId(ownerUserId ?? '');
}

function getOwnerListeners(ownerKey: string) {
  let listeners = listenersByOwner.get(ownerKey);
  if (!listeners) {
    listeners = new Set<VoicePlaybackPreferencesListener>();
    listenersByOwner.set(ownerKey, listeners);
  }

  return listeners;
}

function getBrowserStorage(): VoicePlaybackPreferencesStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return typeof window.localStorage?.getItem === 'function' &&
      typeof window.localStorage?.setItem === 'function'
      ? window.localStorage
      : null;
  } catch {
    return null;
  }
}
