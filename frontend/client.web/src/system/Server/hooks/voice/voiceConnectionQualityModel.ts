export type VoiceConnectionQualityState =
  | 'connecting'
  | 'good'
  | 'degraded'
  | 'poor'
  | 'reconnecting'
  | 'disconnected'
  | 'unknown';

export type NormalizedVoiceRtcStatsSample = {
  timestampMs: number;
  inboundBytes: number | null;
  outboundBytes: number | null;
  inboundPacketsReceived: number | null;
  inboundPacketsLost: number | null;
  remoteInboundPacketsReceived: number | null;
  remoteInboundPacketsLost: number | null;
  reportedOutboundPacketLossPercent: number | null;
  roundTripTimeMs: number | null;
  jitterMs: number | null;
};

export type VoiceConnectionMetrics = {
  sampledAtMs: number;
  intervalMs: number | null;
  inboundBitrateBps: number | null;
  outboundBitrateBps: number | null;
  inboundPacketLossPercent: number | null;
  outboundPacketLossPercent: number | null;
  packetLossPercent: number | null;
  roundTripTimeMs: number | null;
  jitterMs: number | null;
};

export type VoiceConnectionLifecycleSnapshot = {
  lifecycleState?: string | null;
  connectionState?: string | null;
  iceConnectionState?: string | null;
  isReconnecting?: boolean;
};

export type VoiceConnectionDiagnostics = VoiceConnectionMetrics & {
  qualityState: VoiceConnectionQualityState;
};

export const voiceConnectionQualityThresholds = {
  degraded: {
    packetLossPercent: 3,
    roundTripTimeMs: 200,
    jitterMs: 30
  },
  poor: {
    packetLossPercent: 10,
    roundTripTimeMs: 500,
    jitterMs: 80
  }
} as const;

type StatsRecord = Record<string, unknown>;

type CounterAccumulator = {
  value: number;
  hasValue: boolean;
};

type CandidatePairRoundTripTime = {
  valueMs: number;
  priority: number;
};

/**
 * Converts an RTCStatsReport-like collection into a small, serializable audio
 * sample. Maps, arrays, RTCStatsReport.forEach() collections and plain objects
 * are accepted so the calculation can stay independent from browser globals.
 */
export function normalizeVoiceRtcStatsSample(
  statsLike: unknown,
  capturedAtMs?: number
): NormalizedVoiceRtcStatsSample {
  const records = collectStatsRecords(statsLike);
  const inboundBytes = createCounterAccumulator();
  const outboundBytes = createCounterAccumulator();
  const inboundPacketsReceived = createCounterAccumulator();
  const inboundPacketsLost = createCounterAccumulator();
  const remoteInboundPacketsReceived = createCounterAccumulator();
  const remoteInboundPacketsLost = createCounterAccumulator();
  const selectedCandidatePairIds = new Set<string>();
  const candidatePairRoundTripTimes: CandidatePairRoundTripTime[] = [];
  const remoteRoundTripTimesMs: number[] = [];
  const jitterValuesMs: number[] = [];
  const reportedOutboundLossValues: number[] = [];

  let statsTimestampMs: number | null = null;

  for (const record of records) {
    const timestamp = readFiniteNumber(record.timestamp);
    if (timestamp !== null) {
      statsTimestampMs = Math.max(statsTimestampMs ?? timestamp, timestamp);
    }

    if (record.type === 'transport') {
      const selectedCandidatePairId = readNonEmptyString(
        record.selectedCandidatePairId
      );
      if (selectedCandidatePairId !== null) {
        selectedCandidatePairIds.add(selectedCandidatePairId);
      }
    }
  }

  for (const record of records) {
    if (record.type === 'inbound-rtp' && isAudioRtpRecord(record)) {
      addCounter(inboundBytes, record.bytesReceived);
      addCounter(inboundPacketsReceived, record.packetsReceived);
      addCounter(inboundPacketsLost, record.packetsLost);

      const jitterSeconds = readNonNegativeNumber(record.jitter);
      if (jitterSeconds !== null) {
        jitterValuesMs.push(jitterSeconds * 1_000);
      }
      continue;
    }

    if (record.type === 'outbound-rtp' && isAudioRtpRecord(record)) {
      addCounter(outboundBytes, record.bytesSent);
      continue;
    }

    if (record.type === 'remote-inbound-rtp' && isAudioRtpRecord(record)) {
      addCounter(remoteInboundPacketsReceived, record.packetsReceived);
      addCounter(remoteInboundPacketsLost, record.packetsLost);

      const fractionLost = readFiniteNumber(record.fractionLost);
      if (fractionLost !== null) {
        reportedOutboundLossValues.push(clamp(fractionLost * 100, 0, 100));
      }

      const roundTripTimeSeconds = readNonNegativeNumber(record.roundTripTime);
      if (roundTripTimeSeconds !== null) {
        remoteRoundTripTimesMs.push(roundTripTimeSeconds * 1_000);
      }
      continue;
    }

    if (record.type === 'candidate-pair') {
      const roundTripTimeSeconds = resolveCandidatePairRoundTripTime(record);
      if (roundTripTimeSeconds === null) {
        continue;
      }

      const id = readNonEmptyString(record.id);
      candidatePairRoundTripTimes.push({
        valueMs: roundTripTimeSeconds * 1_000,
        priority: candidatePairPriority(
          record,
          id !== null && selectedCandidatePairIds.has(id)
        )
      });
    }
  }

  const explicitTimestampMs = readNonNegativeNumber(capturedAtMs);

  return {
    timestampMs: explicitTimestampMs ?? statsTimestampMs ?? 0,
    inboundBytes: counterValue(inboundBytes),
    outboundBytes: counterValue(outboundBytes),
    inboundPacketsReceived: counterValue(inboundPacketsReceived),
    inboundPacketsLost: counterValue(inboundPacketsLost),
    remoteInboundPacketsReceived: counterValue(remoteInboundPacketsReceived),
    remoteInboundPacketsLost: counterValue(remoteInboundPacketsLost),
    reportedOutboundPacketLossPercent: maximumOrNull(
      reportedOutboundLossValues
    ),
    roundTripTimeMs:
      bestCandidatePairRoundTripTime(candidatePairRoundTripTimes) ??
      maximumOrNull(remoteRoundTripTimesMs),
    jitterMs: maximumOrNull(jitterValuesMs)
  };
}

/**
 * Calculates interval metrics. Cumulative byte and packet counters are only
 * compared when a valid older sample exists; a counter reset produces null
 * instead of an artificial bitrate or loss spike.
 */
export function calculateVoiceConnectionMetrics(
  current: NormalizedVoiceRtcStatsSample,
  previous?: NormalizedVoiceRtcStatsSample | null
): VoiceConnectionMetrics {
  const intervalMs = resolveIntervalMs(current, previous);
  const inboundPacketLossPercent = calculatePacketLossPercent(
    current.inboundPacketsReceived,
    current.inboundPacketsLost,
    previous?.inboundPacketsReceived ?? null,
    previous?.inboundPacketsLost ?? null,
    intervalMs
  );
  const outboundPacketLossPercent =
    calculatePacketLossPercent(
      current.remoteInboundPacketsReceived,
      current.remoteInboundPacketsLost,
      previous?.remoteInboundPacketsReceived ?? null,
      previous?.remoteInboundPacketsLost ?? null,
      intervalMs
    ) ?? current.reportedOutboundPacketLossPercent;

  return {
    sampledAtMs: current.timestampMs,
    intervalMs,
    inboundBitrateBps: calculateBitrate(
      current.inboundBytes,
      previous?.inboundBytes ?? null,
      intervalMs
    ),
    outboundBitrateBps: calculateBitrate(
      current.outboundBytes,
      previous?.outboundBytes ?? null,
      intervalMs
    ),
    inboundPacketLossPercent,
    outboundPacketLossPercent,
    packetLossPercent: maximumNullable(
      inboundPacketLossPercent,
      outboundPacketLossPercent
    ),
    roundTripTimeMs: roundMetric(current.roundTripTimeMs),
    jitterMs: roundMetric(current.jitterMs)
  };
}

export function resolveVoiceConnectionQualityState(
  lifecycle: VoiceConnectionLifecycleSnapshot,
  metrics?: VoiceConnectionMetrics | null
): VoiceConnectionQualityState {
  const lifecycleState = normalizeState(lifecycle.lifecycleState);
  const connectionState = normalizeState(lifecycle.connectionState);
  const iceConnectionState = normalizeState(lifecycle.iceConnectionState);

  if (
    lifecycleState === 'error' ||
    lifecycleState === 'idle' ||
    lifecycleState === 'leaving' ||
    connectionState === 'failed' ||
    connectionState === 'closed' ||
    iceConnectionState === 'failed' ||
    iceConnectionState === 'closed'
  ) {
    return 'disconnected';
  }

  if (
    lifecycle.isReconnecting === true ||
    lifecycleState === 'reconnecting' ||
    connectionState === 'disconnected' ||
    iceConnectionState === 'disconnected'
  ) {
    return 'reconnecting';
  }

  if (
    lifecycleState === 'joining' ||
    lifecycleState === 'switching' ||
    connectionState === 'new' ||
    connectionState === 'connecting' ||
    iceConnectionState === 'new' ||
    iceConnectionState === 'checking'
  ) {
    return 'connecting';
  }

  if (
    !isConnectedLifecycle(lifecycleState, connectionState, iceConnectionState)
  ) {
    return 'unknown';
  }

  if (
    metrics === null ||
    metrics === undefined ||
    !hasQualityMetrics(metrics)
  ) {
    return 'unknown';
  }

  if (
    reachesThreshold(metrics.packetLossPercent, 'packetLossPercent', 'poor') ||
    reachesThreshold(metrics.roundTripTimeMs, 'roundTripTimeMs', 'poor') ||
    reachesThreshold(metrics.jitterMs, 'jitterMs', 'poor')
  ) {
    return 'poor';
  }

  if (
    reachesThreshold(
      metrics.packetLossPercent,
      'packetLossPercent',
      'degraded'
    ) ||
    reachesThreshold(metrics.roundTripTimeMs, 'roundTripTimeMs', 'degraded') ||
    reachesThreshold(metrics.jitterMs, 'jitterMs', 'degraded')
  ) {
    return 'degraded';
  }

  return 'good';
}

export function createVoiceConnectionDiagnostics(
  current: NormalizedVoiceRtcStatsSample,
  previous: NormalizedVoiceRtcStatsSample | null | undefined,
  lifecycle: VoiceConnectionLifecycleSnapshot
): VoiceConnectionDiagnostics {
  const metrics = calculateVoiceConnectionMetrics(current, previous);

  return {
    ...metrics,
    qualityState: resolveVoiceConnectionQualityState(lifecycle, metrics)
  };
}

function collectStatsRecords(statsLike: unknown): StatsRecord[] {
  if (statsLike === null || statsLike === undefined) {
    return [];
  }

  if (isStatsRecord(statsLike) && typeof statsLike.type === 'string') {
    return [statsLike];
  }

  const values: unknown[] = [];

  if (isIterable(statsLike)) {
    for (const value of statsLike) {
      values.push(value);
    }
  } else if (hasForEach(statsLike)) {
    statsLike.forEach((value) => values.push(value));
  } else if (isStatsRecord(statsLike)) {
    values.push(...Object.values(statsLike));
  }

  return values
    .map(unwrapStatsRecord)
    .filter((record): record is StatsRecord => record !== null);
}

function unwrapStatsRecord(value: unknown): StatsRecord | null {
  if (Array.isArray(value) && value.length >= 2 && isStatsRecord(value[1])) {
    return value[1];
  }

  return isStatsRecord(value) ? value : null;
}

function isStatsRecord(value: unknown): value is StatsRecord {
  return typeof value === 'object' && value !== null;
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Symbol.iterator in value &&
    typeof value[Symbol.iterator] === 'function'
  );
}

function hasForEach(
  value: unknown
): value is { forEach(callback: (item: unknown) => void): void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'forEach' in value &&
    typeof value.forEach === 'function'
  );
}

function isAudioRtpRecord(record: StatsRecord) {
  const kind = readNonEmptyString(record.kind)?.toLowerCase() ?? null;
  const mediaType = readNonEmptyString(record.mediaType)?.toLowerCase() ?? null;

  return (
    (kind === null || kind === 'audio') &&
    (mediaType === null || mediaType === 'audio')
  );
}

function createCounterAccumulator(): CounterAccumulator {
  return { value: 0, hasValue: false };
}

function addCounter(accumulator: CounterAccumulator, value: unknown) {
  const numericValue = readNonNegativeNumber(value);
  if (numericValue === null) {
    return;
  }

  accumulator.value += numericValue;
  accumulator.hasValue = true;
}

function counterValue(accumulator: CounterAccumulator) {
  return accumulator.hasValue ? accumulator.value : null;
}

function resolveCandidatePairRoundTripTime(record: StatsRecord) {
  const currentRoundTripTime = readNonNegativeNumber(
    record.currentRoundTripTime
  );
  if (currentRoundTripTime !== null) {
    return currentRoundTripTime;
  }

  const totalRoundTripTime = readNonNegativeNumber(record.totalRoundTripTime);
  const responsesReceived = readNonNegativeNumber(record.responsesReceived);
  if (
    totalRoundTripTime === null ||
    responsesReceived === null ||
    responsesReceived <= 0
  ) {
    return null;
  }

  return totalRoundTripTime / responsesReceived;
}

function candidatePairPriority(
  record: StatsRecord,
  isTransportSelected: boolean
) {
  let priority = isTransportSelected ? 100 : 0;
  if (record.selected === true) {
    priority += 50;
  }
  if (record.nominated === true) {
    priority += 20;
  }
  if (record.state === 'succeeded') {
    priority += 10;
  }

  return priority;
}

function bestCandidatePairRoundTripTime(values: CandidatePairRoundTripTime[]) {
  if (values.length === 0) {
    return null;
  }

  return (
    [...values].sort(
      (left, right) =>
        right.priority - left.priority || right.valueMs - left.valueMs
    )[0]?.valueMs ?? null
  );
}

function resolveIntervalMs(
  current: NormalizedVoiceRtcStatsSample,
  previous?: NormalizedVoiceRtcStatsSample | null
) {
  if (previous === null || previous === undefined) {
    return null;
  }

  const intervalMs = current.timestampMs - previous.timestampMs;
  return Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : null;
}

function calculateBitrate(
  currentBytes: number | null,
  previousBytes: number | null,
  intervalMs: number | null
) {
  if (
    currentBytes === null ||
    previousBytes === null ||
    intervalMs === null ||
    currentBytes < previousBytes
  ) {
    return null;
  }

  return Math.round(((currentBytes - previousBytes) * 8 * 1_000) / intervalMs);
}

function calculatePacketLossPercent(
  currentReceived: number | null,
  currentLost: number | null,
  previousReceived: number | null,
  previousLost: number | null,
  intervalMs: number | null
) {
  if (
    intervalMs === null ||
    currentReceived === null ||
    currentLost === null ||
    previousReceived === null ||
    previousLost === null ||
    currentReceived < previousReceived ||
    currentLost < previousLost
  ) {
    return null;
  }

  const receivedDelta = currentReceived - previousReceived;
  const lostDelta = currentLost - previousLost;
  const expectedPacketCount = receivedDelta + lostDelta;

  if (expectedPacketCount <= 0) {
    return null;
  }

  return roundMetric(clamp((lostDelta / expectedPacketCount) * 100, 0, 100));
}

function isConnectedLifecycle(
  lifecycleState: string,
  connectionState: string,
  iceConnectionState: string
) {
  return (
    lifecycleState === 'connected' ||
    connectionState === 'connected' ||
    iceConnectionState === 'connected' ||
    iceConnectionState === 'completed'
  );
}

function hasQualityMetrics(metrics: VoiceConnectionMetrics) {
  return [
    metrics.inboundBitrateBps,
    metrics.outboundBitrateBps,
    metrics.packetLossPercent,
    metrics.roundTripTimeMs,
    metrics.jitterMs
  ].some((value) => value !== null);
}

function reachesThreshold(
  value: number | null,
  metric: keyof (typeof voiceConnectionQualityThresholds)['degraded'],
  quality: keyof typeof voiceConnectionQualityThresholds
) {
  return (
    value !== null && value >= voiceConnectionQualityThresholds[quality][metric]
  );
}

function maximumNullable(left: number | null, right: number | null) {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }

  return Math.max(left, right);
}

function maximumOrNull(values: number[]) {
  return values.length > 0 ? Math.max(...values) : null;
}

function roundMetric(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function normalizeState(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function readNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function readFiniteNumber(value: unknown) {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numericValue) ? numericValue : null;
}

function readNonNegativeNumber(value: unknown) {
  const numericValue = readFiniteNumber(value);
  return numericValue !== null && numericValue >= 0 ? numericValue : null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
