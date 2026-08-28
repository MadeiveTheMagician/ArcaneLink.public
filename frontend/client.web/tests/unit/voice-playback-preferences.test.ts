import { expect, test } from '@playwright/test'
import {
  normalizeVoiceUserAudioSettings,
  parseVoicePlaybackPreferences,
  getVoicePlaybackPreferencesStorageKey,
  updateVoiceUserAudioSettings,
  voicePlaybackPreferencesStorageKey,
} from '../../src/system/shared/voice/voicePlaybackPreferences'

test.describe('voice playback preferences', () => {
  test('normalizes individual gain to 0-400 percent', () => {
    expect(normalizeVoiceUserAudioSettings({ volume: 5, isMuted: true })).toEqual({
      volume: 4,
      isMuted: true,
      isVideoHidden: false,
    })
    expect(normalizeVoiceUserAudioSettings({ volume: 2 })).toEqual({
      volume: 2,
      isMuted: false,
      isVideoHidden: false,
    })
    expect(normalizeVoiceUserAudioSettings({ volume: -1 })).toEqual({
      volume: 0,
      isMuted: false,
      isVideoHidden: false,
    })
    expect(normalizeVoiceUserAudioSettings(null)).toEqual({
      volume: 1,
      isMuted: false,
      isVideoHidden: false,
    })
  })

  test('rejects unknown versions and canonicalizes stable user ids', () => {
    expect(parseVoicePlaybackPreferences(JSON.stringify({
      version: 2,
      settingsByUserId: { user: { volume: 0.5, isMuted: true } },
    }))).toEqual({})

    expect(parseVoicePlaybackPreferences(JSON.stringify({
      version: 1,
      settingsByUserId: {
        ' USER-42 ': { volume: 1.75, isMuted: true },
      },
    }))).toEqual({
      'user-42': {
        volume: 1.75,
        isMuted: true,
        isVideoHidden: false,
      },
    })
  })

  test('persists live updates by account id instead of connection id', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    const snapshot = updateVoiceUserAudioSettings(
      ' User-77 ',
      { volume: 1.6, isMuted: true },
      storage,
      ' Owner-12 ',
    )

    expect(snapshot['user-77']).toEqual({
      volume: 1.6,
      isMuted: true,
      isVideoHidden: false,
    })
    expect(parseVoicePlaybackPreferences(
      values.get(getVoicePlaybackPreferencesStorageKey('owner-12')) ?? null,
    )['user-77']).toEqual({
      volume: 1.6,
      isMuted: true,
      isVideoHidden: false,
    })
    expect(values.has(voicePlaybackPreferencesStorageKey)).toBe(false)
  })
})
