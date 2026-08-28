import { expect, test } from '@playwright/test'
import {
  canStartVoiceAudioPlayback,
  resolveVoiceAudioTrackPlaybackState,
} from '../../src/system/shared/voice/voiceAudioPlaybackModel'

test.describe('voice audio playback model', () => {
  test('starts playback while a live remote track is still transport-muted', () => {
    const state = resolveVoiceAudioTrackPlaybackState([
      { readyState: 'live', muted: true },
    ])

    expect(state).toBe('pending')
    expect(canStartVoiceAudioPlayback(state)).toBe(true)
  })

  test('reports an unmuted live track as available', () => {
    const state = resolveVoiceAudioTrackPlaybackState([
      { readyState: 'live', muted: false },
    ])

    expect(state).toBe('available')
    expect(canStartVoiceAudioPlayback(state)).toBe(true)
  })

  test('does not start playback without a live track', () => {
    const state = resolveVoiceAudioTrackPlaybackState([
      { readyState: 'ended', muted: false },
    ])

    expect(state).toBe('missing')
    expect(canStartVoiceAudioPlayback(state)).toBe(false)
  })
})
