import { expect, test } from '@playwright/test';

import {
  createPrivacySafeVoiceDiagnosticsReport,
  createVoiceTransmissionLimitSummary,
  formatPrivacySafeVoiceCodec,
  formatPrivacySafeVoiceRoute,
  formatVoiceDiagnosticsSampleTime
} from '../../src/system/Hub/components/settings/voiceConnectionDiagnosticsPresentation';
import type { VoiceConnectionDiagnostics } from '../../src/system/Server/hooks/voice/voiceChannelTypes';

const diagnostics: VoiceConnectionDiagnostics = {
  sampledAtMs: Date.UTC(2026, 7, 1, 9, 30, 0),
  intervalMs: 2_000,
  inboundBitrateBps: 51_200,
  outboundBitrateBps: 47_800,
  packetLossPercent: 1.2,
  roundTripTimeMs: 42.5,
  jitterMs: 7.4,
  qualityState: 'good',
  codec: 'audio/opus; 203.0.113.12:49160',
  route: 'relay / udp / 203.0.113.12:49160',
  peerCount: 3,
  connectedPeerCount: 2,
  peersByParticipantId: {}
};

test.describe('voice diagnostics presentation', () => {
  test('reduces routes and codecs to a privacy-safe allowlist', () => {
    expect(
      formatPrivacySafeVoiceRoute('relay / udp / 203.0.113.12:49160')
    ).toBe('Через ретранслятор · UDP');
    expect(formatPrivacySafeVoiceRoute('host tcp 10.0.0.2:51122')).toBe(
      'Прямое соединение · TCP'
    );
    expect(formatPrivacySafeVoiceRoute('203.0.113.12:49160')).toBeNull();

    expect(formatPrivacySafeVoiceCodec('audio/opus; payload=111')).toBe('Opus');
    expect(formatPrivacySafeVoiceCodec('unknown/203.0.113.12')).toBeNull();
  });

  test('copies useful metrics without addresses, ports, or candidates', () => {
    const report = createPrivacySafeVoiceDiagnosticsReport({
      diagnostics,
      qualityProfile: 'automatic',
      adaptiveQuality: true
    });

    expect(report).toContain('Хорошее соединение');
    expect(report).toContain('2 из 3');
    expect(report).toContain('Через ретранслятор · UDP');
    expect(report).toContain('Opus');
    expect(report).toContain('64 Кбит/с');
    expect(report).not.toContain('203.0.113.12');
    expect(report).not.toContain('49160');
    expect(report.toLowerCase()).not.toContain('candidate');
  });

  test('shows an anonymous per-peer bitrate range for adaptive mesh calls', () => {
    const meshDiagnostics: VoiceConnectionDiagnostics = {
      ...diagnostics,
      peersByParticipantId: {
        'participant-secret-a': createPeerDiagnostics('good'),
        'participant-secret-b': createPeerDiagnostics('poor'),
        'participant-secret-c': createPeerDiagnostics('degraded')
      }
    };
    const summary = createVoiceTransmissionLimitSummary({
      diagnostics: meshDiagnostics,
      qualityProfile: 'automatic',
      adaptiveQuality: true
    });
    const report = createPrivacySafeVoiceDiagnosticsReport({
      diagnostics: meshDiagnostics,
      qualityProfile: 'automatic',
      adaptiveQuality: true
    });

    expect(summary.value).toBe('24–64 Кбит/с');
    expect(summary.modeLabel).toBe('Индивидуально');
    expect(report).toContain('24–64 Кбит/с');
    expect(report).toContain('Индивидуально');
    expect(report).not.toContain('participant-secret');
  });

  test('keeps explicit quality profiles fixed for every peer', () => {
    const fixedSummary = createVoiceTransmissionLimitSummary({
      diagnostics: {
        ...diagnostics,
        peersByParticipantId: {
          a: createPeerDiagnostics('good'),
          b: createPeerDiagnostics('poor')
        }
      },
      qualityProfile: 'high',
      adaptiveQuality: true
    });

    expect(fixedSummary.value).toBe('96 Кбит/с');
    expect(fixedSummary.modeLabel).toBe('Фиксированный');
    expect(fixedSummary.isIndividual).toBe(false);
  });

  test('does not display non-epoch WebRTC timestamps as calendar dates', () => {
    expect(formatVoiceDiagnosticsSampleTime(124_500)).toBeNull();
    expect(
      formatVoiceDiagnosticsSampleTime(Date.UTC(2026, 7, 1, 9, 30, 0))
    ).not.toBeNull();
  });
});

function createPeerDiagnostics(
  qualityState: VoiceConnectionDiagnostics['qualityState']
): VoiceConnectionDiagnostics['peersByParticipantId'][string] {
  return {
    participantId: 'not-rendered',
    sampledAtMs: diagnostics.sampledAtMs,
    intervalMs: diagnostics.intervalMs,
    inboundBitrateBps: diagnostics.inboundBitrateBps,
    outboundBitrateBps: diagnostics.outboundBitrateBps,
    inboundPacketLossPercent: diagnostics.packetLossPercent,
    outboundPacketLossPercent: diagnostics.packetLossPercent,
    packetLossPercent: diagnostics.packetLossPercent,
    roundTripTimeMs: diagnostics.roundTripTimeMs,
    jitterMs: diagnostics.jitterMs,
    qualityState,
    connectionState: 'connected',
    iceConnectionState: 'connected',
    codec: diagnostics.codec,
    route: diagnostics.route
  };
}
