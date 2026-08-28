import { expect, test } from '@playwright/test'
import {
  resolveVoiceInputTrackRecoveryDelayMs,
  shouldRecoverVoiceInputTrack,
  voiceInputTrackStabilityResetDelayMs,
} from '../../src/system/Server/hooks/voice/voiceInputTrackRecovery'

test.describe('mobile voice input track recovery', () => {
  test('uses bounded backoff for repeated hardware interruptions', () => {
    expect(resolveVoiceInputTrackRecoveryDelayMs(0)).toBe(1500)
    expect(resolveVoiceInputTrackRecoveryDelayMs(1)).toBe(5000)
    expect(resolveVoiceInputTrackRecoveryDelayMs(2)).toBe(15_000)
    expect(resolveVoiceInputTrackRecoveryDelayMs(3)).toBeNull()
    expect(resolveVoiceInputTrackRecoveryDelayMs(-1)).toBeNull()
    expect(voiceInputTrackStabilityResetDelayMs).toBeGreaterThan(
      resolveVoiceInputTrackRecoveryDelayMs(0) ?? 0,
    )
  })

  test('recovers an unexpectedly muted live microphone in the foreground', () => {
    expect(
      shouldRecoverVoiceInputTrack({
        documentVisibility: 'visible',
        isMuted: false,
        isDeafened: false,
        trackMuted: true,
        trackReadyState: 'live',
      }),
    ).toBe(true)
  })

  test('does not reopen capture for intentional mute or background suspension', () => {
    expect(
      shouldRecoverVoiceInputTrack({
        documentVisibility: 'visible',
        isMuted: true,
        isDeafened: false,
        trackMuted: true,
        trackReadyState: 'live',
      }),
    ).toBe(false)
    expect(
      shouldRecoverVoiceInputTrack({
        documentVisibility: 'hidden',
        isMuted: false,
        isDeafened: false,
        trackMuted: true,
        trackReadyState: 'live',
      }),
    ).toBe(false)
  })

  test('does not retry a healthy or already ended track', () => {
    expect(
      shouldRecoverVoiceInputTrack({
        documentVisibility: 'visible',
        isMuted: false,
        isDeafened: false,
        trackMuted: false,
        trackReadyState: 'live',
      }),
    ).toBe(false)
    expect(
      shouldRecoverVoiceInputTrack({
        documentVisibility: 'visible',
        isMuted: false,
        isDeafened: false,
        trackMuted: true,
        trackReadyState: 'ended',
      }),
    ).toBe(false)
  })
})
