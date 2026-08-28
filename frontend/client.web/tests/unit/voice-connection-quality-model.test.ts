import { expect, test } from '@playwright/test';

import {
  type VoiceConnectionMetrics,
  calculateVoiceConnectionMetrics,
  createVoiceConnectionDiagnostics,
  normalizeVoiceRtcStatsSample,
  resolveVoiceConnectionQualityState
} from '../../src/system/Server/hooks/voice/voiceConnectionQualityModel';

test.describe('voice connection quality model', () => {
  test('normalizes and aggregates audio RTC stats while ignoring video', () => {
    const report = new Map<string, Record<string, unknown>>([
      [
        'audio-in-1',
        {
          id: 'audio-in-1',
          type: 'inbound-rtp',
          kind: 'audio',
          timestamp: 1_950,
          bytesReceived: 1_000,
          packetsReceived: 90,
          packetsLost: 4,
          jitter: 0.018
        }
      ],
      [
        'audio-in-2',
        {
          id: 'audio-in-2',
          type: 'inbound-rtp',
          mediaType: 'audio',
          timestamp: 2_000,
          bytesReceived: 500,
          packetsReceived: 40,
          packetsLost: 1,
          jitter: 0.025
        }
      ],
      [
        'video-in',
        {
          id: 'video-in',
          type: 'inbound-rtp',
          kind: 'video',
          bytesReceived: 900_000,
          packetsReceived: 8_000,
          packetsLost: 800,
          jitter: 2
        }
      ],
      [
        'audio-out',
        {
          id: 'audio-out',
          type: 'outbound-rtp',
          kind: 'audio',
          bytesSent: 2_400
        }
      ],
      [
        'remote-audio-in',
        {
          id: 'remote-audio-in',
          type: 'remote-inbound-rtp',
          kind: 'audio',
          packetsReceived: 70,
          packetsLost: 3,
          fractionLost: 0.04,
          roundTripTime: 0.3
        }
      ],
      [
        'transport',
        {
          id: 'transport',
          type: 'transport',
          selectedCandidatePairId: 'selected-pair'
        }
      ],
      [
        'unused-pair',
        {
          id: 'unused-pair',
          type: 'candidate-pair',
          state: 'succeeded',
          nominated: true,
          currentRoundTripTime: 0.9
        }
      ],
      [
        'selected-pair',
        {
          id: 'selected-pair',
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.12
        }
      ]
    ]);

    expect(normalizeVoiceRtcStatsSample(report)).toEqual({
      timestampMs: 2_000,
      inboundBytes: 1_500,
      outboundBytes: 2_400,
      inboundPacketsReceived: 130,
      inboundPacketsLost: 5,
      remoteInboundPacketsReceived: 70,
      remoteInboundPacketsLost: 3,
      reportedOutboundPacketLossPercent: 4,
      roundTripTimeMs: 120,
      jitterMs: 25
    });
  });

  test('accepts a forEach collection and an explicit capture timestamp', () => {
    const records = [
      {
        type: 'inbound-rtp',
        kind: 'audio',
        timestamp: 300,
        bytesReceived: '1200'
      }
    ];
    const report = {
      forEach(callback: (value: unknown) => void) {
        records.forEach(callback);
      }
    };

    const sample = normalizeVoiceRtcStatsSample(report, 900);

    expect(sample.timestampMs).toBe(900);
    expect(sample.inboundBytes).toBe(1_200);
  });

  test('calculates bitrate and packet loss from cumulative counter deltas', () => {
    const previous = normalizeVoiceRtcStatsSample(
      [
        {
          type: 'inbound-rtp',
          kind: 'audio',
          bytesReceived: 1_000,
          packetsReceived: 90,
          packetsLost: 10,
          jitter: 0.01
        },
        {
          type: 'outbound-rtp',
          kind: 'audio',
          bytesSent: 2_000
        },
        {
          type: 'remote-inbound-rtp',
          kind: 'audio',
          packetsReceived: 95,
          packetsLost: 5
        }
      ],
      1_000
    );
    const current = normalizeVoiceRtcStatsSample(
      [
        {
          type: 'inbound-rtp',
          kind: 'audio',
          bytesReceived: 3_000,
          packetsReceived: 185,
          packetsLost: 15,
          jitter: 0.02456
        },
        {
          type: 'outbound-rtp',
          kind: 'audio',
          bytesSent: 5_000
        },
        {
          type: 'remote-inbound-rtp',
          kind: 'audio',
          packetsReceived: 185,
          packetsLost: 10,
          roundTripTime: 0.15678
        }
      ],
      2_000
    );

    expect(calculateVoiceConnectionMetrics(current, previous)).toEqual({
      sampledAtMs: 2_000,
      intervalMs: 1_000,
      inboundBitrateBps: 16_000,
      outboundBitrateBps: 24_000,
      inboundPacketLossPercent: 5,
      outboundPacketLossPercent: 5.3,
      packetLossPercent: 5.3,
      roundTripTimeMs: 156.8,
      jitterMs: 24.6
    });
  });

  test('does not create spikes from missing baselines or reset counters', () => {
    const current = normalizeVoiceRtcStatsSample(
      [
        {
          type: 'inbound-rtp',
          kind: 'audio',
          bytesReceived: 100,
          packetsReceived: 10,
          packetsLost: 0
        }
      ],
      2_000
    );
    const firstMetrics = calculateVoiceConnectionMetrics(current);

    expect(firstMetrics.intervalMs).toBeNull();
    expect(firstMetrics.inboundBitrateBps).toBeNull();
    expect(firstMetrics.inboundPacketLossPercent).toBeNull();

    const olderLargerCounters = normalizeVoiceRtcStatsSample(
      [
        {
          type: 'inbound-rtp',
          kind: 'audio',
          bytesReceived: 900,
          packetsReceived: 90,
          packetsLost: 5
        }
      ],
      1_000
    );
    const afterReset = calculateVoiceConnectionMetrics(
      current,
      olderLargerCounters
    );

    expect(afterReset.inboundBitrateBps).toBeNull();
    expect(afterReset.inboundPacketLossPercent).toBeNull();
  });

  test('maps connection lifecycle states before evaluating quality', () => {
    const goodMetrics = metrics({
      packetLossPercent: 0.5,
      roundTripTimeMs: 80,
      jitterMs: 10
    });

    expect(
      resolveVoiceConnectionQualityState(
        { lifecycleState: 'joining' },
        goodMetrics
      )
    ).toBe('connecting');
    expect(
      resolveVoiceConnectionQualityState(
        { connectionState: 'disconnected' },
        goodMetrics
      )
    ).toBe('reconnecting');
    expect(
      resolveVoiceConnectionQualityState(
        { lifecycleState: 'reconnecting', connectionState: 'connected' },
        goodMetrics
      )
    ).toBe('reconnecting');
    expect(
      resolveVoiceConnectionQualityState(
        { connectionState: 'failed' },
        goodMetrics
      )
    ).toBe('disconnected');
    expect(resolveVoiceConnectionQualityState({}, goodMetrics)).toBe('unknown');
    expect(
      resolveVoiceConnectionQualityState({ connectionState: 'connected' }, null)
    ).toBe('unknown');
  });

  test('classifies connected metrics using loss, RTT and jitter thresholds', () => {
    const lifecycle = { connectionState: 'connected' };

    expect(
      resolveVoiceConnectionQualityState(
        lifecycle,
        metrics({
          packetLossPercent: 1,
          roundTripTimeMs: 100,
          jitterMs: 15
        })
      )
    ).toBe('good');
    expect(
      resolveVoiceConnectionQualityState(
        lifecycle,
        metrics({
          packetLossPercent: 3,
          roundTripTimeMs: 100,
          jitterMs: 15
        })
      )
    ).toBe('degraded');
    expect(
      resolveVoiceConnectionQualityState(
        lifecycle,
        metrics({
          packetLossPercent: 0,
          roundTripTimeMs: 500,
          jitterMs: 5
        })
      )
    ).toBe('poor');
  });

  test('creates one diagnostics value for consumers', () => {
    const previous = normalizeVoiceRtcStatsSample(
      [{ type: 'outbound-rtp', kind: 'audio', bytesSent: 1_000 }],
      1_000
    );
    const current = normalizeVoiceRtcStatsSample(
      [{ type: 'outbound-rtp', kind: 'audio', bytesSent: 3_000 }],
      2_000
    );

    expect(
      createVoiceConnectionDiagnostics(current, previous, {
        connectionState: 'connected'
      })
    ).toMatchObject({
      sampledAtMs: 2_000,
      outboundBitrateBps: 16_000,
      qualityState: 'good'
    });
  });
});

function metrics(
  overrides: Partial<VoiceConnectionMetrics>
): VoiceConnectionMetrics {
  return {
    sampledAtMs: 1_000,
    intervalMs: 1_000,
    inboundBitrateBps: 32_000,
    outboundBitrateBps: 24_000,
    inboundPacketLossPercent: null,
    outboundPacketLossPercent: null,
    packetLossPercent: null,
    roundTripTimeMs: null,
    jitterMs: null,
    ...overrides
  };
}
