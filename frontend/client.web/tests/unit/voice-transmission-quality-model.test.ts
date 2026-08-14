import { expect, test } from '@playwright/test'
import {
  resolveVoiceTransmissionMaxBitrateBps,
  resolveVoiceTransmissionQualityPlan,
  voiceTransmissionProfileMaxBitrateBps,
} from '../../src/system/Server/hooks/voice/voiceTransmissionQualityModel'
import type { VoiceConnectionQualityState } from '../../src/system/Server/hooks/voice/voiceConnectionQualityModel'

test.describe('voice transmission quality model', () => {
  test('uses stable bitrate ceilings for explicit profiles', () => {
    expect(voiceTransmissionProfileMaxBitrateBps).toEqual({
      automatic: 64_000,
      'data-saver': 24_000,
      balanced: 48_000,
      high: 96_000,
    })

    for (const [qualityProfile, expectedBitrate] of [
      ['data-saver', 24_000],
      ['balanced', 48_000],
      ['high', 96_000],
    ] as const) {
      expect(
        resolveVoiceTransmissionQualityPlan({
          qualityProfile,
          adaptiveQuality: true,
          diagnosticsQualityState: 'poor',
        }),
      ).toEqual({
        requestedProfile: qualityProfile,
        maxBitrateBps: expectedBitrate,
        isAdaptive: false,
        reason: 'fixed-profile',
      })
    }
  })

  test('adapts the automatic profile to diagnostics quality', () => {
    const expectations: ReadonlyArray<
      readonly [VoiceConnectionQualityState, number, string]
    > = [
      ['good', 64_000, 'adaptive-good'],
      ['degraded', 40_000, 'adaptive-degraded'],
      ['poor', 24_000, 'adaptive-poor'],
      ['connecting', 48_000, 'adaptive-transitional'],
      ['reconnecting', 24_000, 'adaptive-transitional'],
      ['disconnected', 24_000, 'adaptive-transitional'],
      ['unknown', 48_000, 'adaptive-transitional'],
    ]

    for (const [diagnosticsQualityState, expectedBitrate, reason] of expectations) {
      expect(
        resolveVoiceTransmissionQualityPlan({
          qualityProfile: 'automatic',
          adaptiveQuality: true,
          diagnosticsQualityState,
        }),
      ).toEqual({
        requestedProfile: 'automatic',
        maxBitrateBps: expectedBitrate,
        isAdaptive: true,
        reason,
      })
    }
  })

  test('makes adaptiveQuality an opt-out for automatic mode only', () => {
    expect(
      resolveVoiceTransmissionQualityPlan({
        qualityProfile: 'automatic',
        adaptiveQuality: false,
        diagnosticsQualityState: 'poor',
      }),
    ).toEqual({
      requestedProfile: 'automatic',
      maxBitrateBps: 64_000,
      isAdaptive: false,
      reason: 'adaptation-disabled',
    })

    expect(
      resolveVoiceTransmissionMaxBitrateBps({
        qualityProfile: 'high',
        adaptiveQuality: false,
        diagnosticsQualityState: 'poor',
      }),
    ).toBe(96_000)
  })
})
