import { expect, test } from '@playwright/test'
import {
  advanceVoiceQualityHysteresis,
  applyAudioSenderMaxBitrate,
  aggregateVoiceConnectionDiagnostics,
  createVoiceQualityHysteresisState,
  extractVoicePeerMetadata,
  resolveVoicePeerTransmissionMaxBitrates,
  settlePromiseWithin,
} from '../../src/system/Server/hooks/voice/useVoiceConnectionDiagnostics'
import type { VoicePeerConnectionDiagnostics } from '../../src/system/Server/hooks/voice/voiceChannelTypes'

test.describe('voice connection runtime diagnostics', () => {
  test('extracts the selected audio codec and a privacy-safe relay route', () => {
    const stats = new Map<string, Record<string, unknown>>([
      [
        'audio-out',
        {
          id: 'audio-out',
          type: 'outbound-rtp',
          kind: 'audio',
          transportId: 'audio-transport',
          codecId: 'audio-codec',
        },
      ],
      [
        'video-out',
        {
          id: 'video-out',
          type: 'outbound-rtp',
          kind: 'video',
          codecId: 'video-codec',
        },
      ],
      [
        'audio-codec',
        {
          id: 'audio-codec',
          type: 'codec',
          mimeType: 'audio/opus',
          clockRate: 48_000,
          channels: 2,
        },
      ],
      [
        'video-codec',
        {
          id: 'video-codec',
          type: 'codec',
          mimeType: 'video/VP9',
        },
      ],
      [
        'audio-transport',
        {
          id: 'audio-transport',
          type: 'transport',
          selectedCandidatePairId: 'selected-pair',
        },
      ],
      [
        'selected-pair',
        {
          id: 'selected-pair',
          type: 'candidate-pair',
          state: 'succeeded',
          localCandidateId: 'local-candidate',
          remoteCandidateId: 'remote-candidate',
        },
      ],
      [
        'local-candidate',
        {
          id: 'local-candidate',
          type: 'local-candidate',
          candidateType: 'relay',
          protocol: 'udp',
          address: '192.0.2.1',
          port: 50_000,
        },
      ],
      [
        'remote-candidate',
        {
          id: 'remote-candidate',
          type: 'remote-candidate',
          candidateType: 'srflx',
          protocol: 'udp',
          address: '198.51.100.2',
          port: 50_001,
        },
      ],
    ])

    const metadata = extractVoicePeerMetadata(stats)

    expect(metadata).toEqual({
      codec: 'Opus · 48 kHz · 2 ch',
      route: 'relay/udp',
    })
    expect(JSON.stringify(metadata)).not.toContain('192.0.2.1')
    expect(JSON.stringify(metadata)).not.toContain('50000')
  })

  test('does not label a route direct without candidate records', () => {
    const metadata = extractVoicePeerMetadata([
      {
        id: 'transport',
        type: 'transport',
        selectedCandidatePairId: 'pair',
      },
      {
        id: 'pair',
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
      },
    ])

    expect(metadata.route).toBe('unknown/unknown')
  })

  test('aggregates peer metrics and keeps the first sample measuring', () => {
    const firstSample = aggregateVoiceConnectionDiagnostics(
      [peerDiagnostics({ intervalMs: null, roundTripTimeMs: 700 })],
      'connected',
    )

    expect(firstSample.qualityState).toBe('unknown')
    expect(firstSample.roundTripTimeMs).toBe(700)

    const aggregate = aggregateVoiceConnectionDiagnostics(
      [
        peerDiagnostics({
          participantId: 'one',
          inboundBitrateBps: 16_000,
          outboundBitrateBps: 20_000,
          packetLossPercent: 1,
          roundTripTimeMs: 100,
          jitterMs: 12,
          codec: 'Opus · 48 kHz',
          route: 'direct/udp',
        }),
        peerDiagnostics({
          participantId: 'two',
          inboundBitrateBps: 12_000,
          outboundBitrateBps: 18_000,
          packetLossPercent: 12,
          roundTripTimeMs: 550,
          jitterMs: 90,
          codec: 'Opus · 48 kHz',
          route: 'relay/tcp',
        }),
      ],
      'connected',
    )

    expect(aggregate.inboundBitrateBps).toBe(28_000)
    expect(aggregate.outboundBitrateBps).toBe(38_000)
    expect(aggregate.packetLossPercent).toBe(12)
    expect(aggregate.roundTripTimeMs).toBe(550)
    expect(aggregate.jitterMs).toBe(90)
    expect(aggregate.qualityState).toBe('poor')
    expect(aggregate.codec).toBe('Opus · 48 kHz')
    expect(aggregate.route).toBe('direct/udp + relay/tcp')
    expect(aggregate.peerCount).toBe(2)
    expect(aggregate.connectedPeerCount).toBe(2)
  })

  test('adds hysteresis only to measured quality transitions', () => {
    let state = createVoiceQualityHysteresisState()

    let transition = advanceVoiceQualityHysteresis(state, 'good')
    expect(transition.qualityState).toBe('good')
    state = transition.state

    transition = advanceVoiceQualityHysteresis(state, 'degraded')
    expect(transition.qualityState).toBe('good')
    state = transition.state

    transition = advanceVoiceQualityHysteresis(state, 'degraded')
    expect(transition.qualityState).toBe('degraded')
    state = transition.state

    for (let sample = 0; sample < 2; sample += 1) {
      transition = advanceVoiceQualityHysteresis(state, 'good')
      expect(transition.qualityState).toBe('degraded')
      state = transition.state
    }

    transition = advanceVoiceQualityHysteresis(state, 'good')
    expect(transition.qualityState).toBe('good')

    transition = advanceVoiceQualityHysteresis(
      transition.state,
      'reconnecting',
    )
    expect(transition.qualityState).toBe('reconnecting')
  })

  test('waits for a negotiated encoding before applying audio bitrate', async () => {
    const parameters = {
      encodings: [],
      codecs: [],
      headerExtensions: [],
      rtcp: {},
      transactionId: 'test',
    } as unknown as RTCRtpSendParameters
    let appliedParameters: RTCRtpSendParameters | null = null
    const sender = {
      getParameters: () => parameters,
      setParameters: async (next: RTCRtpSendParameters) => {
        appliedParameters = next
      },
    }

    const didApply = await applyAudioSenderMaxBitrate(sender, 48_000)

    expect(didApply).toBe(false)
    expect(appliedParameters).toBeNull()
    expect(parameters.encodings).toEqual([])
  })

  test('applies audio bitrate without changing negotiated encoding count', async () => {
    const parameters = {
      encodings: [{ active: true }],
      codecs: [],
      headerExtensions: [],
      rtcp: {},
      transactionId: 'test',
    } as unknown as RTCRtpSendParameters
    let appliedParameters: RTCRtpSendParameters | null = null
    const sender = {
      getParameters: () => parameters,
      setParameters: async (next: RTCRtpSendParameters) => {
        appliedParameters = next
      },
    }

    const didApply = await applyAudioSenderMaxBitrate(sender, 48_000)

    expect(didApply).toBe(true)
    expect(appliedParameters?.encodings).toEqual([
      { active: true, maxBitrate: 48_000 },
    ])
  })

  test('adapts automatic transmission per peer without penalizing healthy peers', () => {
    const automatic = resolveVoicePeerTransmissionMaxBitrates(
      {
        healthy: 'good',
        unstable: 'degraded',
        failing: 'poor',
      },
      { qualityProfile: 'automatic', adaptiveQuality: true },
    )

    expect(automatic).toEqual({
      healthy: 64_000,
      unstable: 40_000,
      failing: 24_000,
    })

    const fixed = resolveVoicePeerTransmissionMaxBitrates(
      { healthy: 'good', failing: 'poor' },
      { qualityProfile: 'high', adaptiveQuality: true },
    )

    expect(fixed).toEqual({ healthy: 96_000, failing: 96_000 })
  })

  test('bounds a stalled stats request without delaying settled peers', async () => {
    const neverSettles = new Promise<string>(() => undefined)
    const results = await Promise.allSettled([
      settlePromiseWithin(Promise.resolve('ready'), 25),
      settlePromiseWithin(neverSettles, 5),
    ])

    expect(results[0]).toEqual({ status: 'fulfilled', value: 'ready' })
    expect(results[1]?.status).toBe('rejected')
  })
})

function peerDiagnostics(
  patch: Partial<VoicePeerConnectionDiagnostics> = {},
): VoicePeerConnectionDiagnostics {
  return {
    participantId: 'peer',
    sampledAtMs: 2_000,
    intervalMs: 2_000,
    inboundBitrateBps: 0,
    outboundBitrateBps: 0,
    inboundPacketLossPercent: 0,
    outboundPacketLossPercent: 0,
    packetLossPercent: 0,
    roundTripTimeMs: 80,
    jitterMs: 10,
    qualityState: 'good',
    connectionState: 'connected',
    iceConnectionState: 'connected',
    codec: null,
    route: null,
    ...patch,
  }
}
