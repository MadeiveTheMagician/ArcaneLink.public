import { expect, test } from '@playwright/test'
import {
  getVoiceProcessingCapabilities,
  refineVoiceProcessingCapabilities,
} from '../../src/system/shared/voice/voiceProcessingCapabilities'

test.describe('voice processing capabilities', () => {
  test('reads each processing constraint independently', () => {
    expect(
      getVoiceProcessingCapabilities({
        getSupportedConstraints: () => ({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        }),
      }),
    ).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    })
  })

  test('does not claim unsupported processing when capability API is absent', () => {
    expect(getVoiceProcessingCapabilities(null)).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    })
  })

  test('keeps only settings that the captured track actually reports', () => {
    expect(
      refineVoiceProcessingCapabilities(
        {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        {
          echoCancellation: true,
          noiseSuppression: false,
        },
      ),
    ).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    })
  })
})
