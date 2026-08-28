export const VOICE_SETTINGS_VERSION = 1 as const
export const voiceSettingsStorageKey = 'arcanelink:voice-settings:v1'
export const voiceSettingsChangedEventName =
  'arcanelink:voice-settings-changed'

export type VoiceInputMode = 'voice-activity' | 'push-to-talk'
export type VoiceThresholdMode = 'automatic' | 'manual'
export type VoiceSpatialAudioMode = 'off' | 'balanced' | 'immersive'
export const isVoiceSpatialAudioAvailable = false

export function resolveEffectiveVoiceSpatialAudioMode(
  mode: VoiceSpatialAudioMode,
): VoiceSpatialAudioMode {
  return isVoiceSpatialAudioAvailable ? mode : 'off'
}

export type VoiceTransmissionQualityProfile =
  | 'automatic'
  | 'data-saver'
  | 'balanced'
  | 'high'

export type VoiceSettings = {
  inputDeviceId: string
  outputDeviceId: string
  microphoneGainPercent: number
  outputVolumePercent: number
  echoCancellation: boolean
  noiseSuppression: boolean
  mlNoiseSuppression: boolean
  autoGainControl: boolean
  spatialAudioMode: VoiceSpatialAudioMode
  inputMode: VoiceInputMode
  pushToTalkKeyCode: string | null
  thresholdMode: VoiceThresholdMode
  manualThresholdDb: number
  warnInputUnavailable: boolean
  warnSpeakingWhileMuted: boolean
  qualityProfile: VoiceTransmissionQualityProfile
  adaptiveQuality: boolean
}

export type VoiceSettingsStorage = Pick<Storage, 'getItem' | 'setItem'>
export type VoiceSettingsListener = (settings: VoiceSettings) => void

type StoredVoiceSettings = {
  version: typeof VOICE_SETTINGS_VERSION
  settings: VoiceSettings
}

const inputModeValues: readonly VoiceInputMode[] = [
  'voice-activity',
  'push-to-talk',
]
const thresholdModeValues: readonly VoiceThresholdMode[] = [
  'automatic',
  'manual',
]
const spatialAudioModeValues: readonly VoiceSpatialAudioMode[] = [
  'off',
  'balanced',
  'immersive',
]
const qualityProfileValues: readonly VoiceTransmissionQualityProfile[] = [
  'automatic',
  'data-saver',
  'balanced',
  'high',
]
const listeners = new Set<VoiceSettingsListener>()
let currentSnapshot: VoiceSettings | null = null
let isStorageListenerAttached = false

export const defaultVoiceSettings: Readonly<VoiceSettings> = Object.freeze({
  inputDeviceId: 'default',
  outputDeviceId: 'default',
  microphoneGainPercent: 100,
  outputVolumePercent: 100,
  echoCancellation: true,
  noiseSuppression: true,
  mlNoiseSuppression: false,
  autoGainControl: false,
  spatialAudioMode: 'off',
  inputMode: 'voice-activity',
  pushToTalkKeyCode: null,
  thresholdMode: 'manual',
  manualThresholdDb: -45,
  warnInputUnavailable: true,
  warnSpeakingWhileMuted: false,
  qualityProfile: 'automatic',
  adaptiveQuality: true,
})

export function normalizeVoiceSettings(value: unknown): VoiceSettings {
  if (!value || typeof value !== 'object') {
    return { ...defaultVoiceSettings }
  }

  const candidate = value as Partial<VoiceSettings>

  return {
    inputDeviceId: readDeviceId(
      candidate.inputDeviceId,
      defaultVoiceSettings.inputDeviceId,
    ),
    outputDeviceId: readDeviceId(
      candidate.outputDeviceId,
      defaultVoiceSettings.outputDeviceId,
    ),
    microphoneGainPercent: readNumberInRange(
      candidate.microphoneGainPercent,
      0,
      200,
      defaultVoiceSettings.microphoneGainPercent,
    ),
    outputVolumePercent: readNumberInRange(
      candidate.outputVolumePercent,
      0,
      100,
      defaultVoiceSettings.outputVolumePercent,
    ),
    echoCancellation: readBoolean(
      candidate.echoCancellation,
      defaultVoiceSettings.echoCancellation,
    ),
    noiseSuppression: readBoolean(
      candidate.noiseSuppression,
      defaultVoiceSettings.noiseSuppression,
    ),
    mlNoiseSuppression: readBoolean(
      candidate.mlNoiseSuppression,
      defaultVoiceSettings.mlNoiseSuppression,
    ),
    autoGainControl: readBoolean(
      candidate.autoGainControl,
      defaultVoiceSettings.autoGainControl,
    ),
    spatialAudioMode: spatialAudioModeValues.includes(
      candidate.spatialAudioMode as VoiceSpatialAudioMode,
    )
      ? (candidate.spatialAudioMode as VoiceSpatialAudioMode)
      : defaultVoiceSettings.spatialAudioMode,
    inputMode: inputModeValues.includes(candidate.inputMode as VoiceInputMode)
      ? (candidate.inputMode as VoiceInputMode)
      : defaultVoiceSettings.inputMode,
    pushToTalkKeyCode: readPushToTalkKeyCode(
      candidate.pushToTalkKeyCode,
    ),
    thresholdMode: thresholdModeValues.includes(
      candidate.thresholdMode as VoiceThresholdMode,
    )
      ? (candidate.thresholdMode as VoiceThresholdMode)
      : defaultVoiceSettings.thresholdMode,
    manualThresholdDb: readNumberInRange(
      candidate.manualThresholdDb,
      -80,
      -20,
      defaultVoiceSettings.manualThresholdDb,
    ),
    warnInputUnavailable: readBoolean(
      candidate.warnInputUnavailable,
      defaultVoiceSettings.warnInputUnavailable,
    ),
    warnSpeakingWhileMuted: readBoolean(
      candidate.warnSpeakingWhileMuted,
      defaultVoiceSettings.warnSpeakingWhileMuted,
    ),
    qualityProfile: qualityProfileValues.includes(
      candidate.qualityProfile as VoiceTransmissionQualityProfile,
    )
      ? (candidate.qualityProfile as VoiceTransmissionQualityProfile)
      : defaultVoiceSettings.qualityProfile,
    adaptiveQuality: readBoolean(
      candidate.adaptiveQuality,
      defaultVoiceSettings.adaptiveQuality,
    ),
  }
}

export function parseVoiceSettings(raw: string | null): VoiceSettings {
  if (!raw) {
    return { ...defaultVoiceSettings }
  }

  try {
    const parsed = JSON.parse(raw) as
      | Partial<StoredVoiceSettings>
      | Partial<VoiceSettings>
      | null

    if (
      parsed &&
      typeof parsed === 'object' &&
      'version' in parsed &&
      'settings' in parsed
    ) {
      if (parsed.version !== VOICE_SETTINGS_VERSION) {
        return { ...defaultVoiceSettings }
      }

      return normalizeVoiceSettings(parsed.settings)
    }

    return normalizeVoiceSettings(parsed)
  } catch {
    return { ...defaultVoiceSettings }
  }
}

export function loadVoiceSettings(
  storage: VoiceSettingsStorage | null = getBrowserStorage(),
): VoiceSettings {
  if (!storage) {
    return { ...defaultVoiceSettings }
  }

  try {
    return parseVoiceSettings(storage.getItem(voiceSettingsStorageKey))
  } catch {
    return { ...defaultVoiceSettings }
  }
}

export function getVoiceSettings(): VoiceSettings {
  if (!currentSnapshot) {
    currentSnapshot = loadVoiceSettings()
  }

  return currentSnapshot
}

export function saveVoiceSettings(
  settings: VoiceSettings,
  storage: VoiceSettingsStorage | null = getBrowserStorage(),
): VoiceSettings {
  const normalizedSettings = normalizeVoiceSettings(settings)
  const storedValue: StoredVoiceSettings = {
    version: VOICE_SETTINGS_VERSION,
    settings: normalizedSettings,
  }

  if (storage) {
    try {
      storage.setItem(voiceSettingsStorageKey, JSON.stringify(storedValue))
    } catch {
      // The in-memory settings remain active when browser storage is blocked.
    }
  }

  currentSnapshot = normalizedSettings
  emitVoiceSettingsChanged(normalizedSettings)
  return normalizedSettings
}

export function updateVoiceSettings(
  patch: Partial<VoiceSettings>,
): VoiceSettings {
  return saveVoiceSettings({
    ...getVoiceSettings(),
    ...patch,
  })
}

export function resetVoiceSettings(): VoiceSettings {
  return saveVoiceSettings({ ...defaultVoiceSettings })
}

export function subscribeVoiceSettings(
  listener: VoiceSettingsListener,
): () => void {
  listeners.add(listener)
  attachStorageListener()

  return () => {
    listeners.delete(listener)
  }
}

export function createVoiceAudioConstraints(
  settings: VoiceSettings = getVoiceSettings(),
): MediaTrackConstraints {
  const normalizedSettings = normalizeVoiceSettings(settings)

  return {
    ...(normalizedSettings.inputDeviceId === 'default'
      ? {}
      : { deviceId: { exact: normalizedSettings.inputDeviceId } }),
    echoCancellation: normalizedSettings.echoCancellation,
    noiseSuppression: normalizedSettings.noiseSuppression,
    autoGainControl: normalizedSettings.autoGainControl,
  }
}

export type PushToTalkKeyModifiers = {
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  isComposing?: boolean
}

const allowedPushToTalkCodes = new Set([
  'Backquote',
  'Backslash',
  'BracketLeft',
  'BracketRight',
  'Comma',
  'Equal',
  'IntlBackslash',
  'IntlRo',
  'IntlYen',
  'Minus',
  'NumpadAdd',
  'NumpadDecimal',
  'NumpadDivide',
  'NumpadMultiply',
  'NumpadSubtract',
  'Period',
  'Quote',
  'Semicolon',
  'Slash',
  'Space',
])

export function isPushToTalkKeyCodeAllowed(
  code: string,
  modifiers: PushToTalkKeyModifiers = {},
) {
  if (
    modifiers.altKey ||
    modifiers.ctrlKey ||
    modifiers.metaKey ||
    modifiers.shiftKey ||
    modifiers.isComposing
  ) {
    return false
  }

  return (
    /^Key[A-Z]$/.test(code) ||
    /^Digit[0-9]$/.test(code) ||
    /^Numpad[0-9]$/.test(code) ||
    allowedPushToTalkCodes.has(code)
  )
}

function emitVoiceSettingsChanged(settings: VoiceSettings) {
  listeners.forEach((listener) => listener(settings))

  if (
    typeof window !== 'undefined' &&
    typeof window.dispatchEvent === 'function' &&
    typeof CustomEvent === 'function'
  ) {
    window.dispatchEvent(
      new CustomEvent<VoiceSettings>(voiceSettingsChangedEventName, {
        detail: settings,
      }),
    )
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
    if (event.key !== voiceSettingsStorageKey) {
      return
    }

    currentSnapshot = parseVoiceSettings(event.newValue)
    listeners.forEach((listener) => listener(currentSnapshot as VoiceSettings))
  })
}

function getBrowserStorage(): VoiceSettingsStorage | null {
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

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function readDeviceId(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : fallback
}

function readNumberInRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function readPushToTalkKeyCode(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim().slice(0, 64)
  return isPushToTalkKeyCodeAllowed(normalizedValue)
    ? normalizedValue
    : null
}
