import { expect, test } from '@playwright/test'
import {
  VOICE_SETTINGS_VERSION,
  createVoiceAudioConstraints,
  defaultVoiceSettings,
  isPushToTalkKeyCodeAllowed,
  normalizeVoiceSettings,
  parseVoiceSettings,
  resolveEffectiveVoiceSpatialAudioMode,
  saveVoiceSettings,
  voiceSettingsStorageKey,
} from '../../src/system/shared/voice/voiceSettings'

test.describe('voice settings model', () => {
  test('uses voice-safe defaults for missing or malformed storage', () => {
    expect(parseVoiceSettings(null)).toEqual(defaultVoiceSettings)
    expect(parseVoiceSettings('{broken')).toEqual(defaultVoiceSettings)
    expect(
      parseVoiceSettings(
        JSON.stringify({
          version: VOICE_SETTINGS_VERSION + 1,
          settings: {
            autoGainControl: true,
          },
        }),
      ),
    ).toEqual(defaultVoiceSettings)
  })

  test('normalizes persisted settings and clamps numeric values', () => {
    expect(
      normalizeVoiceSettings({
        inputDeviceId: ' microphone-1 ',
        outputDeviceId: '',
        microphoneGainPercent: 500,
        outputVolumePercent: -20,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
        inputMode: 'push-to-talk',
        pushToTalkKeyCode: 'KeyV',
        thresholdMode: 'manual',
        manualThresholdDb: -100,
        warnInputUnavailable: false,
        warnSpeakingWhileMuted: true,
        qualityProfile: 'high',
        adaptiveQuality: false,
      }),
    ).toEqual({
      inputDeviceId: 'microphone-1',
      outputDeviceId: 'default',
      microphoneGainPercent: 200,
      outputVolumePercent: 0,
      echoCancellation: false,
      noiseSuppression: false,
      mlNoiseSuppression: false,
      autoGainControl: true,
      spatialAudioMode: 'off',
      inputMode: 'push-to-talk',
      pushToTalkKeyCode: 'KeyV',
      thresholdMode: 'manual',
      manualThresholdDb: -80,
      warnInputUnavailable: false,
      warnSpeakingWhileMuted: true,
      qualityProfile: 'high',
      adaptiveQuality: false,
    })
  })

  test('preserves a spatial preference while the effective mode is disabled', () => {
    expect(
      normalizeVoiceSettings({ spatialAudioMode: 'immersive' })
        .spatialAudioMode,
    ).toBe('immersive')
    expect(resolveEffectiveVoiceSpatialAudioMode('immersive')).toBe('off')
  })

  test('adds quality defaults to old settings without losing their values', () => {
    expect(
      parseVoiceSettings(
        JSON.stringify({
          version: VOICE_SETTINGS_VERSION,
          settings: {
            inputDeviceId: 'legacy-microphone',
            outputVolumePercent: 64,
            inputMode: 'push-to-talk',
            pushToTalkKeyCode: 'KeyC',
          },
        }),
      ),
    ).toMatchObject({
      inputDeviceId: 'legacy-microphone',
      outputVolumePercent: 64,
      inputMode: 'push-to-talk',
      pushToTalkKeyCode: 'KeyC',
      qualityProfile: 'automatic',
      adaptiveQuality: true,
    })
  })

  test('normalizes invalid quality settings independently', () => {
    expect(
      normalizeVoiceSettings({
        qualityProfile: 'studio',
        adaptiveQuality: 'yes',
      }),
    ).toMatchObject({
      qualityProfile: 'automatic',
      adaptiveQuality: true,
    })
    expect(
      normalizeVoiceSettings({
        qualityProfile: 'data-saver',
        adaptiveQuality: false,
      }),
    ).toMatchObject({
      qualityProfile: 'data-saver',
      adaptiveQuality: false,
    })
  })

  test('reads legacy unwrapped settings and writes a versioned envelope', () => {
    expect(
      parseVoiceSettings(
        JSON.stringify({
          autoGainControl: true,
          manualThresholdDb: -42,
        }),
      ),
    ).toMatchObject({
      autoGainControl: true,
      manualThresholdDb: -42,
    })

    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const saved = saveVoiceSettings(
      {
        ...defaultVoiceSettings,
        outputVolumePercent: 65,
      },
      storage,
    )

    expect(saved.outputVolumePercent).toBe(65)
    expect(JSON.parse(values.get(voiceSettingsStorageKey) ?? '{}')).toEqual({
      version: VOICE_SETTINGS_VERSION,
      settings: saved,
    })
  })

  test('builds capture constraints for system and explicit microphones', () => {
    expect(createVoiceAudioConstraints({ ...defaultVoiceSettings })).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    })

    expect(
      createVoiceAudioConstraints({
        ...defaultVoiceSettings,
        inputDeviceId: 'microphone-2',
        echoCancellation: false,
        autoGainControl: true,
      }),
    ).toEqual({
      deviceId: { exact: 'microphone-2' },
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: true,
    })
  })

  test('allows ordinary push-to-talk keys but rejects navigation and modifiers', () => {
    expect(isPushToTalkKeyCodeAllowed('KeyV')).toBe(true)
    expect(isPushToTalkKeyCodeAllowed('Space')).toBe(true)
    expect(isPushToTalkKeyCodeAllowed('Numpad5')).toBe(true)
    expect(isPushToTalkKeyCodeAllowed('Slash')).toBe(true)
    expect(isPushToTalkKeyCodeAllowed('Escape')).toBe(false)
    expect(isPushToTalkKeyCodeAllowed('ControlLeft')).toBe(false)
    expect(isPushToTalkKeyCodeAllowed('ArrowUp')).toBe(false)
    expect(isPushToTalkKeyCodeAllowed('PageDown')).toBe(false)
    expect(isPushToTalkKeyCodeAllowed('F5')).toBe(false)
    expect(
      isPushToTalkKeyCodeAllowed('KeyV', { ctrlKey: true }),
    ).toBe(false)
    expect(
      isPushToTalkKeyCodeAllowed('Space', { isComposing: true }),
    ).toBe(false)
    expect(isPushToTalkKeyCodeAllowed('')).toBe(false)
  })
})
