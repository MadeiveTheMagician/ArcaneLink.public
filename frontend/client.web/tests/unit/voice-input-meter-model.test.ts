import { expect, test } from '@playwright/test'
import {
  getVoiceInputThresholdTrackRatio,
  normalizeVoiceInputMeterDb,
} from '../../src/system/Hub/components/settings/voiceInputMeterModel'

test.describe('voice input meter model', () => {
  test('maps the dBFS meter floor and ceiling to the full track', () => {
    expect(normalizeVoiceInputMeterDb(-80)).toBe(0)
    expect(normalizeVoiceInputMeterDb(-40)).toBe(0.5)
    expect(normalizeVoiceInputMeterDb(0)).toBe(1)
  })

  test('clamps invalid and out-of-range samples', () => {
    expect(normalizeVoiceInputMeterDb(Number.NaN)).toBe(0)
    expect(normalizeVoiceInputMeterDb(-120)).toBe(0)
    expect(normalizeVoiceInputMeterDb(12)).toBe(1)
  })

  test('keeps the editable threshold range aligned with the meter', () => {
    expect(getVoiceInputThresholdTrackRatio()).toBe(0.75)
  })
})
