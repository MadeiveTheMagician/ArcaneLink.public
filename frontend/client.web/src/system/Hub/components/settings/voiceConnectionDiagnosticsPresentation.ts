import type { VoiceConnectionDiagnostics } from '../../../Server/hooks/voice/voiceChannelTypes';
import type { VoiceConnectionQualityState } from '../../../Server/hooks/voice/voiceConnectionQualityModel';
import { resolveVoiceTransmissionQualityPlan } from '../../../Server/hooks/voice/voiceTransmissionQualityModel';
import { settingsCopy } from '../../../shared/copy';
import type { VoiceTransmissionQualityProfile } from '../../../shared/voice/voiceSettings';

const compactNumberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1
});

const diagnosticDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'medium'
});

const earliestPlausibleSampleTimestamp = Date.UTC(2020, 0, 1);

export function getVoiceDiagnosticsQualityLabel(
  qualityState: VoiceConnectionQualityState
) {
  switch (qualityState) {
    case 'connecting':
      return settingsCopy.voice.diagnosticsQualityConnecting;
    case 'good':
      return settingsCopy.voice.diagnosticsQualityGood;
    case 'degraded':
      return settingsCopy.voice.diagnosticsQualityDegraded;
    case 'poor':
      return settingsCopy.voice.diagnosticsQualityPoor;
    case 'reconnecting':
      return settingsCopy.voice.diagnosticsQualityReconnecting;
    case 'disconnected':
      return settingsCopy.voice.diagnosticsQualityDisconnected;
    case 'unknown':
      return settingsCopy.voice.diagnosticsQualityMeasuring;
  }
}

export function getVoiceDiagnosticsQualityDescription(
  qualityState: VoiceConnectionQualityState
) {
  switch (qualityState) {
    case 'connecting':
    case 'unknown':
      return settingsCopy.voice.diagnosticsQualityMeasuringDescription;
    case 'good':
      return settingsCopy.voice.diagnosticsQualityGoodDescription;
    case 'degraded':
      return settingsCopy.voice.diagnosticsQualityDegradedDescription;
    case 'poor':
      return settingsCopy.voice.diagnosticsQualityPoorDescription;
    case 'reconnecting':
      return settingsCopy.voice.diagnosticsQualityReconnectingDescription;
    case 'disconnected':
      return settingsCopy.voice.diagnosticsQualityDisconnectedDescription;
  }
}

/**
 * Converts the ICE route into a deliberately small display value. Arbitrary
 * candidate strings never leave this function, so IP addresses, ports and
 * candidate identifiers cannot appear in the UI or copied report.
 */
export function formatPrivacySafeVoiceRoute(route: string | null | undefined) {
  const normalized = route?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return null;
  }

  const routeLabel = normalized.includes('relay')
    ? settingsCopy.voice.diagnosticsRouteRelay
    : ['host', 'srflx', 'prflx', 'direct'].some((token) =>
          normalized.includes(token)
        )
      ? settingsCopy.voice.diagnosticsRouteDirect
      : null;

  const protocol = ['udp', 'tcp', 'tls'].find((token) =>
    new RegExp(`(^|[^a-z])${token}([^a-z]|$)`, 'i').test(normalized)
  );

  if (!routeLabel) {
    return protocol?.toUpperCase() ?? null;
  }

  return protocol ? `${routeLabel} · ${protocol.toUpperCase()}` : routeLabel;
}

/** Only known audio codec names are shown; untrusted stats labels are dropped. */
export function formatPrivacySafeVoiceCodec(codec: string | null | undefined) {
  const normalized = codec?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return null;
  }

  const knownCodecs: ReadonlyArray<readonly [RegExp, string]> = [
    [/(^|[^a-z])opus([^a-z]|$)/i, 'Opus'],
    [/(^|[^a-z])g722([^a-z]|$)/i, 'G.722'],
    [/(^|[^a-z])pcmu([^a-z]|$)/i, 'PCMU'],
    [/(^|[^a-z])pcma([^a-z]|$)/i, 'PCMA'],
    [/(^|[^a-z])red([^a-z]|$)/i, 'RED']
  ];

  return knownCodecs.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

export function formatVoiceDiagnosticsSampleTime(
  sampledAtMs: number | null | undefined
) {
  if (
    typeof sampledAtMs !== 'number' ||
    !Number.isFinite(sampledAtMs) ||
    sampledAtMs < earliestPlausibleSampleTimestamp
  ) {
    return null;
  }

  const sampledAt = new Date(sampledAtMs);
  return Number.isNaN(sampledAt.getTime())
    ? null
    : diagnosticDateFormatter.format(sampledAt);
}

export function formatVoiceDiagnosticsBitrate(
  bitrateBps: number | null | undefined
) {
  if (!isDiagnosticNumber(bitrateBps)) {
    return settingsCopy.voice.diagnosticsMetricUnavailable;
  }

  return settingsCopy.voice.diagnosticsKilobitsPerSecond(
    compactNumberFormatter.format(bitrateBps / 1_000)
  );
}

export type VoiceTransmissionLimitSummary = {
  minBitrateBps: number;
  maxBitrateBps: number;
  value: string;
  modeLabel: string;
  isIndividual: boolean;
};

export function createVoiceTransmissionLimitSummary({
  diagnostics,
  qualityProfile,
  adaptiveQuality
}: {
  diagnostics: VoiceConnectionDiagnostics | null;
  qualityProfile: VoiceTransmissionQualityProfile;
  adaptiveQuality: boolean;
}): VoiceTransmissionLimitSummary {
  const fallbackPlan = resolveVoiceTransmissionQualityPlan({
    qualityProfile,
    adaptiveQuality,
    diagnosticsQualityState: diagnostics?.qualityState ?? 'unknown'
  });
  const usesPerPeerLimits =
    qualityProfile === 'automatic' && adaptiveQuality && diagnostics !== null;
  const peerQualityStates = usesPerPeerLimits
    ? Object.values(diagnostics.peersByParticipantId)
        .filter((peer) => peer.connectionState !== 'closed')
        .map((peer) => peer.qualityState)
    : [];
  const bitrateLimits = peerQualityStates.map(
    (diagnosticsQualityState) =>
      resolveVoiceTransmissionQualityPlan({
        qualityProfile,
        adaptiveQuality,
        diagnosticsQualityState
      }).maxBitrateBps
  );

  if (bitrateLimits.length === 0) {
    return {
      minBitrateBps: fallbackPlan.maxBitrateBps,
      maxBitrateBps: fallbackPlan.maxBitrateBps,
      value: formatVoiceDiagnosticsBitrate(fallbackPlan.maxBitrateBps),
      modeLabel: fallbackPlan.isAdaptive
        ? settingsCopy.voice.diagnosticsTransmissionAdaptive
        : settingsCopy.voice.diagnosticsTransmissionFixed,
      isIndividual: false
    };
  }

  const minBitrateBps = Math.min(...bitrateLimits);
  const maxBitrateBps = Math.max(...bitrateLimits);

  return {
    minBitrateBps,
    maxBitrateBps,
    value:
      minBitrateBps === maxBitrateBps
        ? formatVoiceDiagnosticsBitrate(minBitrateBps)
        : formatVoiceDiagnosticsBitrateRange(minBitrateBps, maxBitrateBps),
    modeLabel: settingsCopy.voice.diagnosticsTransmissionIndividual,
    isIndividual: true
  };
}

export function createPrivacySafeVoiceDiagnosticsReport({
  diagnostics,
  qualityProfile,
  adaptiveQuality
}: {
  diagnostics: VoiceConnectionDiagnostics | null;
  qualityProfile: VoiceTransmissionQualityProfile;
  adaptiveQuality: boolean;
}) {
  const qualityState = diagnostics?.qualityState ?? 'disconnected';
  const transmissionSummary = createVoiceTransmissionLimitSummary({
    diagnostics,
    qualityProfile,
    adaptiveQuality
  });
  const sampleTime = formatVoiceDiagnosticsSampleTime(diagnostics?.sampledAtMs);
  const codec = formatPrivacySafeVoiceCodec(diagnostics?.codec);
  const route = formatPrivacySafeVoiceRoute(diagnostics?.route);
  const peers = diagnostics
    ? settingsCopy.voice.diagnosticsConnectedPeersValue(
        diagnostics.connectedPeerCount,
        diagnostics.peerCount
      )
    : settingsCopy.voice.diagnosticsMetricUnavailable;

  return [
    settingsCopy.voice.diagnosticsReportTitle,
    `${settingsCopy.voice.diagnosticsReportQuality}: ${getVoiceDiagnosticsQualityLabel(qualityState)}`,
    `${settingsCopy.voice.diagnosticsConnectedPeers}: ${peers}`,
    `${settingsCopy.voice.diagnosticsRoundTripTime}: ${formatMilliseconds(diagnostics?.roundTripTimeMs)}`,
    `${settingsCopy.voice.diagnosticsJitter}: ${formatMilliseconds(diagnostics?.jitterMs)}`,
    `${settingsCopy.voice.diagnosticsPacketLoss}: ${formatPercent(diagnostics?.packetLossPercent)}`,
    `${settingsCopy.voice.diagnosticsInboundBitrate}: ${formatVoiceDiagnosticsBitrate(diagnostics?.inboundBitrateBps)}`,
    `${settingsCopy.voice.diagnosticsOutboundBitrate}: ${formatVoiceDiagnosticsBitrate(diagnostics?.outboundBitrateBps)}`,
    `${settingsCopy.voice.diagnosticsCodec}: ${codec ?? settingsCopy.voice.diagnosticsMetricUnavailable}`,
    `${settingsCopy.voice.diagnosticsRoute}: ${route ?? settingsCopy.voice.diagnosticsMetricUnavailable}`,
    `${settingsCopy.voice.diagnosticsTransmissionTarget}: ${transmissionSummary.value}`,
    `${settingsCopy.voice.diagnosticsTransmissionMode}: ${transmissionSummary.modeLabel}`,
    `${settingsCopy.voice.diagnosticsLastSample}: ${sampleTime ?? settingsCopy.voice.diagnosticsMetricUnavailable}`,
    settingsCopy.voice.diagnosticsReportPrivacyNote
  ].join('\n');
}

function formatVoiceDiagnosticsBitrateRange(
  minBitrateBps: number,
  maxBitrateBps: number
) {
  return settingsCopy.voice.diagnosticsKilobitsPerSecond(
    `${compactNumberFormatter.format(minBitrateBps / 1_000)}–${compactNumberFormatter.format(maxBitrateBps / 1_000)}`
  );
}

function formatMilliseconds(value: number | null | undefined) {
  return isDiagnosticNumber(value)
    ? settingsCopy.voice.diagnosticsMilliseconds(
        compactNumberFormatter.format(value)
      )
    : settingsCopy.voice.diagnosticsMetricUnavailable;
}

function formatPercent(value: number | null | undefined) {
  return isDiagnosticNumber(value)
    ? `${compactNumberFormatter.format(value)}%`
    : settingsCopy.voice.diagnosticsMetricUnavailable;
}

function isDiagnosticNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
