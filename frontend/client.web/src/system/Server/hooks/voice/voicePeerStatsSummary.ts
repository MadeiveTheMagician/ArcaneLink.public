type StatsRecord = Record<string, unknown>;

export type VoicePeerStatsTrackInput = {
  kind?: string | null;
  enabled?: boolean;
  muted?: boolean;
  readyState?: string;
};

export type VoicePeerStatsTransceiverInput = {
  direction?: string;
  currentDirection?: string | null;
  senderTrack?: VoicePeerStatsTrackInput | null;
  receiverTrack?: VoicePeerStatsTrackInput | null;
};

export type VoicePeerStatsSummaryInput = {
  sample?: string;
  connectionState?: string;
  iceConnectionState?: string;
  signalingState?: string;
  stats: readonly unknown[];
  transceivers: readonly VoicePeerStatsTransceiverInput[];
};

const peerConnectionStates = new Set([
  'new',
  'connecting',
  'connected',
  'disconnected',
  'failed',
  'closed'
]);
const iceConnectionStates = new Set([
  'new',
  'checking',
  'connected',
  'completed',
  'disconnected',
  'failed',
  'closed'
]);
const signalingStates = new Set([
  'stable',
  'have-local-offer',
  'have-remote-offer',
  'have-local-pranswer',
  'have-remote-pranswer',
  'closed'
]);
const transceiverDirections = new Set([
  'sendrecv',
  'sendonly',
  'recvonly',
  'inactive',
  'stopped'
]);
const safeSamplePattern = /^[a-z0-9+_-]{1,40}$/i;

export function createSafeVoicePeerStatsSummary(
  input: VoicePeerStatsSummaryInput
) {
  const inboundAudio: ReturnType<typeof summarizeInboundAudio>[] = [];
  const outboundAudio: ReturnType<typeof summarizeOutboundAudio>[] = [];
  const remoteInboundAudio: ReturnType<typeof summarizeRemoteInboundAudio>[] =
    [];

  for (const candidate of input.stats) {
    if (!isStatsRecord(candidate) || !isAudioRtpRecord(candidate)) {
      continue;
    }

    if (candidate.type === 'inbound-rtp') {
      inboundAudio.push(summarizeInboundAudio(candidate));
    } else if (candidate.type === 'outbound-rtp') {
      outboundAudio.push(summarizeOutboundAudio(candidate));
    } else if (candidate.type === 'remote-inbound-rtp') {
      remoteInboundAudio.push(summarizeRemoteInboundAudio(candidate));
    }
  }

  return {
    sample: normalizeSample(input.sample),
    connectionState: normalizeEnum(input.connectionState, peerConnectionStates),
    iceConnectionState: normalizeEnum(
      input.iceConnectionState,
      iceConnectionStates
    ),
    signalingState: normalizeEnum(input.signalingState, signalingStates),
    audioTransceivers: input.transceivers
      .filter(isAudioTransceiver)
      .map((transceiver) => ({
        direction: normalizeEnum(transceiver.direction, transceiverDirections),
        currentDirection: normalizeEnum(
          transceiver.currentDirection,
          transceiverDirections
        ),
        sender: summarizeTrack(transceiver.senderTrack),
        receiver: summarizeTrack(transceiver.receiverTrack)
      })),
    inboundAudio,
    outboundAudio,
    remoteInboundAudio
  };
}

export function serializeSafeVoicePeerStatsSummary(
  summary: ReturnType<typeof createSafeVoicePeerStatsSummary>
) {
  return JSON.stringify(summary);
}

function summarizeInboundAudio(record: StatsRecord) {
  return {
    packetsReceived: readFiniteNumber(record.packetsReceived),
    packetsLost: readFiniteNumber(record.packetsLost),
    bytesReceived: readFiniteNumber(record.bytesReceived),
    totalAudioEnergy: readFiniteNumber(record.totalAudioEnergy)
  };
}

function summarizeOutboundAudio(record: StatsRecord) {
  return {
    packetsSent: readFiniteNumber(record.packetsSent),
    bytesSent: readFiniteNumber(record.bytesSent),
    totalAudioEnergy: readFiniteNumber(record.totalAudioEnergy)
  };
}

function summarizeRemoteInboundAudio(record: StatsRecord) {
  return {
    packetsReceived: readFiniteNumber(record.packetsReceived),
    packetsLost: readFiniteNumber(record.packetsLost),
    bytesReceived: readFiniteNumber(record.bytesReceived),
    totalAudioEnergy: readFiniteNumber(record.totalAudioEnergy),
    fractionLost: readFiniteNumber(record.fractionLost),
    roundTripTime: readFiniteNumber(record.roundTripTime)
  };
}

function summarizeTrack(track: VoicePeerStatsTrackInput | null | undefined) {
  if (!track) {
    return null;
  }

  return {
    enabled: typeof track.enabled === 'boolean' ? track.enabled : null,
    muted: typeof track.muted === 'boolean' ? track.muted : null,
    readyState:
      track.readyState === 'live' || track.readyState === 'ended'
        ? track.readyState
        : null
  };
}

function isAudioTransceiver(transceiver: VoicePeerStatsTransceiverInput) {
  return (
    transceiver.senderTrack?.kind === 'audio' ||
    transceiver.receiverTrack?.kind === 'audio'
  );
}

function isAudioRtpRecord(record: StatsRecord) {
  if (
    record.type !== 'inbound-rtp' &&
    record.type !== 'outbound-rtp' &&
    record.type !== 'remote-inbound-rtp'
  ) {
    return false;
  }

  return record.kind === 'audio' || record.mediaType === 'audio';
}

function isStatsRecord(value: unknown): value is StatsRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeEnum(value: unknown, allowed: ReadonlySet<string>) {
  return typeof value === 'string' && allowed.has(value) ? value : null;
}

function normalizeSample(value: unknown) {
  return typeof value === 'string' && safeSamplePattern.test(value)
    ? value
    : 'event';
}
