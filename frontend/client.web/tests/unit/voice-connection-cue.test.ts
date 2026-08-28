import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  getVoiceConnectionCuePlaybackConfig,
  type VoiceConnectionCue,
} from '../../src/system/shared/voice/voiceConnectionCue'

const sampleUrls: Record<VoiceConnectionCue, URL> = {
  connected: new URL(
    '../../src/system/shared/voice/samples/voice-connected.wav',
    import.meta.url,
  ),
  disconnected: new URL(
    '../../src/system/shared/voice/samples/voice-disconnected.wav',
    import.meta.url,
  ),
}

test.describe('voice connection cue', () => {
  for (const cue of ['connected', 'disconnected'] as const) {
    test(`${cue} uses the fixed 48 kHz stereo sample`, () => {
      const metadata = readPcmWaveMetadata(sampleUrls[cue])
      const config = getVoiceConnectionCuePlaybackConfig(cue)

      expect(metadata.channelCount).toBe(2)
      expect(metadata.sampleRateHz).toBe(config.sampleRateHz)
      expect(metadata.bitsPerSample).toBe(16)
      expect(metadata.durationSeconds).toBeCloseTo(config.durationSeconds, 3)
      expect(metadata.finalFramePeak).toBe(0)
    })
  }

  test('applies a short fade to both extended samples', () => {
    const connected = getVoiceConnectionCuePlaybackConfig('connected')
    const disconnected = getVoiceConnectionCuePlaybackConfig('disconnected')

    expect(connected.fadeOutSeconds).toBe(0.08)
    expect(disconnected.fadeOutSeconds).toBe(0.08)
    expect(connected.durationSeconds).toBeGreaterThan(1.5)
    expect(disconnected.durationSeconds).toBeGreaterThan(1.2)
  })
})

function readPcmWaveMetadata(sampleUrl: URL) {
  const wave = readFileSync(sampleUrl)

  expect(wave.toString('ascii', 0, 4)).toBe('RIFF')
  expect(wave.toString('ascii', 8, 12)).toBe('WAVE')
  expect(wave.readUInt16LE(20)).toBe(1)

  const channelCount = wave.readUInt16LE(22)
  const sampleRateHz = wave.readUInt32LE(24)
  const bitsPerSample = wave.readUInt16LE(34)
  const dataByteCount = wave.readUInt32LE(40)
  const finalFrameOffset = 44 + dataByteCount - channelCount * 2
  let finalFramePeak = 0
  for (let channel = 0; channel < channelCount; channel += 1) {
    finalFramePeak = Math.max(
      finalFramePeak,
      Math.abs(wave.readInt16LE(finalFrameOffset + channel * 2)),
    )
  }

  return {
    bitsPerSample,
    channelCount,
    durationSeconds:
      dataByteCount / (sampleRateHz * channelCount * (bitsPerSample / 8)),
    finalFramePeak,
    sampleRateHz,
  }
}
