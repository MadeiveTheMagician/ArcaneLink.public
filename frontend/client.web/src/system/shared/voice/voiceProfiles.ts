import {
  defaultVoiceSettings,
  getVoiceSettings,
  normalizeVoiceSettings,
  saveVoiceSettings,
  subscribeVoiceSettings,
  type VoiceSettings,
} from './voiceSettings'
import { settingsCopy } from '../copy/settings.ru'

export const VOICE_PROFILES_VERSION = 1 as const
export const voiceProfilesStorageKey = 'arcanelink:voice-profiles:v1'
export const defaultVoiceProfileId = 'default'
export const voiceProfileLimit = 10
export const voiceProfileNameMaxLength = 40

export type VoiceProfile = {
  id: string
  name: string
  isBuiltIn: boolean
  settings: VoiceSettings
  createdAt: string
  updatedAt: string
}

export type VoiceProfilesSnapshot = {
  activeProfileId: string
  profiles: VoiceProfile[]
}

export type VoiceProfilesStorage = Pick<Storage, 'getItem' | 'setItem'>

type StoredVoiceProfiles = VoiceProfilesSnapshot & {
  version: typeof VOICE_PROFILES_VERSION
}

type VoiceProfilesListener = (snapshot: VoiceProfilesSnapshot) => void

const listeners = new Set<VoiceProfilesListener>()
let currentSnapshot: VoiceProfilesSnapshot | null = null
let isStorageListenerAttached = false
let isVoiceSettingsListenerAttached = false
let isApplyingProfile = false
let isProfilesInitialized = false
let hasUnpersistedProfileChanges = false

export function normalizeVoiceProfileName(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, voiceProfileNameMaxLength)
    : ''
}

export function parseVoiceProfiles(
  raw: string | null,
  fallbackSettings: VoiceSettings = getVoiceSettings(),
): VoiceProfilesSnapshot {
  if (!raw) {
    return createInitialVoiceProfiles(fallbackSettings)
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredVoiceProfiles> | null
    if (parsed?.version !== VOICE_PROFILES_VERSION) {
      return createInitialVoiceProfiles(fallbackSettings)
    }

    return normalizeVoiceProfilesSnapshot(parsed, fallbackSettings)
  } catch {
    return createInitialVoiceProfiles(fallbackSettings)
  }
}

export function loadVoiceProfiles(
  storage: VoiceProfilesStorage | null = getBrowserStorage(),
  fallbackSettings: VoiceSettings = getVoiceSettings(),
) {
  if (!storage) {
    return createInitialVoiceProfiles(fallbackSettings)
  }

  try {
    return parseVoiceProfiles(
      storage.getItem(voiceProfilesStorageKey),
      fallbackSettings,
    )
  } catch {
    return createInitialVoiceProfiles(fallbackSettings)
  }
}

export function getVoiceProfilesSnapshot() {
  if (!currentSnapshot) {
    currentSnapshot = loadVoiceProfiles()
  }
  return currentSnapshot
}

export function subscribeVoiceProfiles(listener: VoiceProfilesListener) {
  attachStorageListener()
  const storage = getBrowserStorage()
  if (storage && !hasUnpersistedProfileChanges) {
    currentSnapshot = loadVoiceProfiles(storage)
  }
  initializeVoiceProfilesStore()
  reconcileActiveVoiceProfile(getVoiceProfilesSnapshot())
  listeners.add(listener)
  attachVoiceSettingsListener()

  return () => {
    listeners.delete(listener)
  }
}

export function activateVoiceProfile(profileId: string) {
  const current = getVoiceProfilesSnapshot()
  const profile = current.profiles.find((item) => item.id === profileId)
  if (!profile) {
    return false
  }

  if (current.activeProfileId !== profile.id) {
    persistVoiceProfiles({
      ...current,
      activeProfileId: profile.id,
    })
  }

  applyProfileSettings(profile.settings)
  return true
}

export function createVoiceProfile(
  name: string,
  sourceSettings: VoiceSettings = getVoiceSettings(),
) {
  const current = getVoiceProfilesSnapshot()
  const normalizedName = normalizeVoiceProfileName(name)
  if (!normalizedName || current.profiles.length >= voiceProfileLimit) {
    return null
  }

  const now = new Date().toISOString()
  const profile: VoiceProfile = {
    id: createVoiceProfileId(),
    name: normalizedName,
    isBuiltIn: false,
    settings: normalizeVoiceSettings(sourceSettings),
    createdAt: now,
    updatedAt: now,
  }

  persistVoiceProfiles({
    activeProfileId: profile.id,
    profiles: [...current.profiles, profile],
  })
  applyProfileSettings(profile.settings)
  return profile
}

export function duplicateVoiceProfile(profileId: string) {
  const current = getVoiceProfilesSnapshot()
  const source = current.profiles.find((profile) => profile.id === profileId)
  if (!source) {
    return null
  }

  const copySuffix = settingsCopy.voice.profileCopySuffix
  const availableNameLength = voiceProfileNameMaxLength - copySuffix.length
  return createVoiceProfile(
    `${source.name.slice(0, availableNameLength)}${copySuffix}`,
    source.settings,
  )
}

export function renameVoiceProfile(profileId: string, name: string) {
  const current = getVoiceProfilesSnapshot()
  const normalizedName = normalizeVoiceProfileName(name)
  if (!normalizedName) {
    return false
  }

  let didRename = false
  const profiles = current.profiles.map((profile) => {
    if (profile.id !== profileId || profile.isBuiltIn) {
      return profile
    }

    didRename = true
    return {
      ...profile,
      name: normalizedName,
      updatedAt: new Date().toISOString(),
    }
  })

  if (didRename) {
    persistVoiceProfiles({ ...current, profiles })
  }
  return didRename
}

export function deleteVoiceProfile(profileId: string) {
  const current = getVoiceProfilesSnapshot()
  const profile = current.profiles.find((item) => item.id === profileId)
  if (!profile || profile.isBuiltIn) {
    return false
  }

  const profiles = current.profiles.filter((item) => item.id !== profileId)
  const activeProfileId =
    current.activeProfileId === profileId
      ? defaultVoiceProfileId
      : current.activeProfileId

  persistVoiceProfiles({ activeProfileId, profiles })
  if (current.activeProfileId === profileId) {
    const fallback = profiles.find((item) => item.id === defaultVoiceProfileId)
    if (fallback) {
      applyProfileSettings(fallback.settings)
    }
  }
  return true
}

export function resetActiveVoiceProfile() {
  const current = getVoiceProfilesSnapshot()
  const settings = { ...defaultVoiceSettings }
  const next = updateProfileSettings(current, current.activeProfileId, settings)
  persistVoiceProfiles(next)
  applyProfileSettings(settings)
  return settings
}

export function syncActiveVoiceProfileSettings(settings: VoiceSettings) {
  const current = getVoiceProfilesSnapshot()
  const normalizedSettings = normalizeVoiceSettings(settings)
  const activeProfile = current.profiles.find(
    (profile) => profile.id === current.activeProfileId,
  )
  if (
    !activeProfile ||
    areVoiceSettingsEqual(activeProfile.settings, normalizedSettings)
  ) {
    return current
  }

  const next = updateProfileSettings(
    current,
    activeProfile.id,
    normalizedSettings,
  )
  persistVoiceProfiles(next)
  return next
}

function createInitialVoiceProfiles(
  settings: VoiceSettings,
): VoiceProfilesSnapshot {
  const now = new Date().toISOString()
  return {
    activeProfileId: defaultVoiceProfileId,
    profiles: [
      {
        id: defaultVoiceProfileId,
        name: settingsCopy.voice.profileDefaultName,
        isBuiltIn: true,
        settings: normalizeVoiceSettings(settings),
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}

function normalizeVoiceProfilesSnapshot(
  value: Partial<StoredVoiceProfiles>,
  fallbackSettings: VoiceSettings,
) {
  const now = new Date().toISOString()
  const candidates = Array.isArray(value.profiles) ? value.profiles : []
  let builtInProfile: VoiceProfile | null = null
  const customProfiles: VoiceProfile[] = []
  const seenIds = new Set<string>()

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }

    const id = normalizeVoiceProfileId((candidate as VoiceProfile).id)
    const name = id === defaultVoiceProfileId
      ? settingsCopy.voice.profileDefaultName
      : normalizeVoiceProfileName((candidate as VoiceProfile).name)
    if (!id || !name || seenIds.has(id)) {
      continue
    }

    const profile: VoiceProfile = {
      id,
      name,
      isBuiltIn: id === defaultVoiceProfileId,
      settings: normalizeVoiceSettings((candidate as VoiceProfile).settings),
      createdAt: readIsoTimestamp((candidate as VoiceProfile).createdAt, now),
      updatedAt: readIsoTimestamp((candidate as VoiceProfile).updatedAt, now),
    }
    seenIds.add(id)
    if (id === defaultVoiceProfileId) {
      builtInProfile = profile
    } else if (customProfiles.length < voiceProfileLimit - 1) {
      customProfiles.push(profile)
    }
  }

  const profiles = [
    builtInProfile ?? createInitialVoiceProfiles(fallbackSettings).profiles[0],
    ...customProfiles,
  ]

  const requestedActiveProfileId = normalizeVoiceProfileId(
    value.activeProfileId,
  )
  const activeProfileId = profiles.some(
    (profile) => profile.id === requestedActiveProfileId,
  )
    ? requestedActiveProfileId
    : defaultVoiceProfileId

  return { activeProfileId, profiles }
}

function updateProfileSettings(
  current: VoiceProfilesSnapshot,
  profileId: string,
  settings: VoiceSettings,
): VoiceProfilesSnapshot {
  const now = new Date().toISOString()
  return {
    ...current,
    profiles: current.profiles.map((profile) =>
      profile.id === profileId
        ? {
            ...profile,
            settings: normalizeVoiceSettings(settings),
            updatedAt: now,
          }
        : profile,
    ),
  }
}

function persistVoiceProfiles(
  snapshot: VoiceProfilesSnapshot,
  storage: VoiceProfilesStorage | null = getBrowserStorage(),
) {
  const normalized = normalizeVoiceProfilesSnapshot(
    {
      version: VOICE_PROFILES_VERSION,
      ...snapshot,
    },
    getVoiceSettings(),
  )
  const stored: StoredVoiceProfiles = {
    version: VOICE_PROFILES_VERSION,
    ...normalized,
  }

  if (storage) {
    try {
      storage.setItem(voiceProfilesStorageKey, JSON.stringify(stored))
      hasUnpersistedProfileChanges = false
    } catch {
      // The in-memory profiles remain active when browser storage is blocked.
      hasUnpersistedProfileChanges = true
    }
  } else {
    hasUnpersistedProfileChanges = true
  }

  currentSnapshot = normalized
  listeners.forEach((listener) => listener(normalized))
  return normalized
}

function applyProfileSettings(settings: VoiceSettings) {
  isApplyingProfile = true
  try {
    saveVoiceSettings(settings)
  } finally {
    isApplyingProfile = false
  }
}

function attachVoiceSettingsListener() {
  if (isVoiceSettingsListenerAttached) {
    return
  }

  isVoiceSettingsListenerAttached = true
  subscribeVoiceSettings((settings) => {
    if (!isApplyingProfile) {
      syncActiveVoiceProfileSettings(settings)
    }
  })
}

function initializeVoiceProfilesStore() {
  if (isProfilesInitialized) {
    return
  }

  isProfilesInitialized = true
  reconcileActiveVoiceProfile(getVoiceProfilesSnapshot())
}

function reconcileActiveVoiceProfile(snapshot: VoiceProfilesSnapshot) {
  const activeProfile = snapshot.profiles.find(
    (profile) => profile.id === snapshot.activeProfileId,
  )
  if (
    activeProfile &&
    !areVoiceSettingsEqual(activeProfile.settings, getVoiceSettings())
  ) {
    applyProfileSettings(activeProfile.settings)
  }
}

function attachStorageListener() {
  if (
    typeof window === 'undefined' ||
    typeof window.addEventListener !== 'function' ||
    isStorageListenerAttached
  ) {
    return
  }

  isStorageListenerAttached = true
  window.addEventListener('storage', (event) => {
    if (event.key !== voiceProfilesStorageKey) {
      return
    }

    const next = parseVoiceProfiles(event.newValue, getVoiceSettings())
    hasUnpersistedProfileChanges = false
    currentSnapshot = next
    listeners.forEach((listener) => listener(next))
    const activeProfile = next.profiles.find(
      (profile) => profile.id === next.activeProfileId,
    )
    if (activeProfile) {
      applyProfileSettings(activeProfile.settings)
    }
  })
}

function areVoiceSettingsEqual(left: VoiceSettings, right: VoiceSettings) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function createVoiceProfileId() {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `voice-${randomId}`.slice(0, 64)
}

function normalizeVoiceProfileId(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  const normalized = value.trim().slice(0, 64)
  return /^[a-zA-Z0-9_-]+$/.test(normalized) ? normalized : ''
}

function readIsoTimestamp(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback
}

function getBrowserStorage(): VoiceProfilesStorage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return typeof window.localStorage?.getItem === 'function' &&
      typeof window.localStorage?.setItem === 'function'
      ? window.localStorage
      : null
  } catch {
    return null
  }
}
