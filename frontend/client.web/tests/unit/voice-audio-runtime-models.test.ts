import { expect, test } from '@playwright/test'
import {
  createVoiceNoiseSuppressionBaseTelemetry,
  createVoiceNoiseSuppressionFallbackTelemetry,
  detectVoiceMlNoiseSuppressionSupport,
  normalizeVoiceNoiseSuppressionProcessorTelemetry,
  resolveVoiceNoiseSuppressionRequest,
} from '../../src/system/Server/hooks/voice/voiceNoiseSuppressionModel'
import {
  clampVoiceParticipantVolume,
  createVoiceSpatialAudioEngine,
  resolveVoiceSpatialAudioMode,
  resolveVoiceSpatialPosition,
  resolveVoiceSpatialLayout,
} from '../../src/system/shared/voice/voiceSpatialAudio'
import {
  indexVoiceUserIdsByParticipantId,
  resolveVoicePlaybackUserId,
} from '../../src/system/shared/voice/voicePlaybackParticipantModel'

test.describe('voice noise suppression runtime model', () => {
  test('keeps native suppression independent from the ML request', () => {
    expect(
      resolveVoiceNoiseSuppressionRequest({
        mlNoiseSuppression: true,
        nativeNoiseSuppression: true,
        nativeNoiseSuppressionActive: true,
      }),
    ).toEqual({
      requestedMode: 'ml',
      fallbackMode: 'native',
      nativeNoiseSuppressionActive: true,
    })

    expect(
      resolveVoiceNoiseSuppressionRequest({
        mlNoiseSuppression: false,
        nativeNoiseSuppression: false,
        nativeNoiseSuppressionActive: false,
      }),
    ).toEqual({
      requestedMode: 'disabled',
      fallbackMode: 'disabled',
      nativeNoiseSuppressionActive: false,
    })
  })

  test('reports exact feature-detection failures', () => {
    const supportedEnvironment = {
      webAssembly: true,
      audioWorklet: true,
      audioWorkletNode: true,
      worker: true,
      messageChannel: true,
      sampleRate: 48_000,
    }

    expect(
      detectVoiceMlNoiseSuppressionSupport(supportedEnvironment),
    ).toEqual({ supported: true, reason: null })
    expect(
      detectVoiceMlNoiseSuppressionSupport({
        ...supportedEnvironment,
        audioWorklet: false,
      }),
    ).toEqual({
      supported: false,
      reason: 'audio-worklet-unavailable',
    })
    expect(
      detectVoiceMlNoiseSuppressionSupport({
        ...supportedEnvironment,
        sampleRate: 44_100,
      }),
    ).toEqual({
      supported: false,
      reason: 'unsupported-sample-rate',
    })
  })

  test('keeps fallback mode and the original ML failure visible', () => {
    const telemetry = createVoiceNoiseSuppressionFallbackTelemetry({
      requestedMode: 'ml',
      fallbackMode: 'native',
      nativeNoiseSuppressionActive: true,
      reason: 'audio-worklet-unavailable',
      providerId: 'rnnoise',
      sampledAtMs: 100,
    })

    expect(telemetry).toMatchObject({
      requestedMode: 'ml',
      activeMode: 'native',
      lifecycle: 'fallback',
      health: 'unavailable',
      fallbackReason: 'audio-worklet-unavailable',
      providerId: 'rnnoise',
      sampledAtMs: 100,
    })
  })

  test('derives CPU load and degrades health on dropped audio', () => {
    const initializing = createVoiceNoiseSuppressionBaseTelemetry({
      requestedMode: 'ml',
      nativeNoiseSuppressionActive: true,
      providerId: 'rnnoise',
      sampledAtMs: 100,
    })
    const healthy = normalizeVoiceNoiseSuppressionProcessorTelemetry(
      initializing,
      {
        averageProcessingTimeMs: 2,
        frameDurationMs: 10,
        algorithmicLatencyMs: 20,
        processedFrames: 100,
        droppedFrames: 0,
        outputUnderruns: 0,
      },
      200,
    )

    expect(healthy).toMatchObject({
      activeMode: 'ml',
      lifecycle: 'active',
      health: 'healthy',
      latencyMs: 20,
      cpuLoadPercent: 20,
      processedFrames: 100,
      sampledAtMs: 200,
    })

    expect(
      normalizeVoiceNoiseSuppressionProcessorTelemetry(
        healthy,
        {
          averageProcessingTimeMs: 8.5,
          frameDurationMs: 10,
          algorithmicLatencyMs: 20,
          droppedFrames: 1,
          outputUnderruns: 0,
        },
      ).health,
    ).toBe('degraded')
  })
})

test.describe('voice spatial audio model', () => {
  test('does not create a Web Audio graph when spatial audio is off', () => {
    let createAudioContextCalls = 0
    const engine = createVoiceSpatialAudioEngine('off', () => {
      createAudioContextCalls += 1
      throw new Error('The off mode must bypass Web Audio.')
    })

    expect(engine).toBeNull()
    expect(createAudioContextCalls).toBe(0)
  })

  test('maps ephemeral participant ids to persistent user preferences', () => {
    const index = indexVoiceUserIdsByParticipantId([
      { participantId: ' RTC-Participant-1 ', userId: ' User-42 ' },
    ])

    expect(resolveVoicePlaybackUserId('rtc-participant-1', index)).toBe(
      'user-42',
    )
    expect(resolveVoicePlaybackUserId('unknown', index)).toBeNull()
  })

  test('keeps a single participant stable and audibly off-centre', () => {
    const first = resolveVoiceSpatialPosition(' Participant-A ')
    const repeated = resolveVoiceSpatialPosition('participant-a')
    const another = resolveVoiceSpatialPosition('participant-b')

    expect(first).toEqual(repeated)
    expect(first).not.toEqual(another)
    expect(Math.abs(first.pan)).toBe(0.32)
    expect(Math.abs(first.x)).toBeGreaterThan(0.35)
    expect(first.z).toBeLessThan(0)
  })

  test('distributes an active group across both sides independent of input order', () => {
    const participantIds = ['participant-a', 'participant-b', 'participant-c']
    const layout = resolveVoiceSpatialLayout(participantIds)
    const reversedLayout = resolveVoiceSpatialLayout(
      participantIds.toReversed(),
    )
    const pans = Array.from(layout.values(), (position) => position.pan).sort(
      (left, right) => left - right,
    )

    expect(pans).toEqual([-0.72, 0, 0.72])
    expect(Array.from(layout.entries())).toEqual(
      Array.from(reversedLayout.entries()),
    )
  })

  test('keeps formerly centred hashes audible for a single remote voice', () => {
    const almostCentredParticipantId =
      '1c43fde9-32e8-4bd2-aaa4-95ac1ee0e10a'
    const position = resolveVoiceSpatialPosition(almostCentredParticipantId)

    expect(Math.abs(position.pan)).toBe(0.32)
    expect(Math.abs(position.x)).toBeGreaterThan(0.35)
    expect(position.z).toBeLessThan(0)
  })

  test('falls back without pretending a missing panner exists', () => {
    const baseCapabilities = {
      audioContext: true,
      mediaStreamSource: true,
      mediaStreamDestination: true,
      stereoPanner: true,
      panner: true,
    }

    expect(
      resolveVoiceSpatialAudioMode('balanced', baseCapabilities),
    ).toEqual({ activeMode: 'balanced', fallbackReason: null })
    expect(
      resolveVoiceSpatialAudioMode('immersive', {
        ...baseCapabilities,
        panner: false,
      }),
    ).toEqual({
      activeMode: 'off',
      fallbackReason: 'panner-unavailable',
    })
  })

  test('supports individual participant gain up to two hundred percent', () => {
    expect(clampVoiceParticipantVolume(1.75)).toBe(1.75)
    expect(clampVoiceParticipantVolume(3)).toBe(2)
    expect(clampVoiceParticipantVolume(-1)).toBe(0)
    expect(clampVoiceParticipantVolume(Number.NaN)).toBe(1)
  })
})
