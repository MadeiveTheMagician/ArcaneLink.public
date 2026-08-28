import type {
  ConnectedVoiceChannel,
  VoiceAccessRevokedPayload,
  VoiceConnectionReplacedPayload
} from './voiceChannelTypes';
import { normalizeUserId } from './voiceChannelUtils';

export type VoiceConnectionReplacementState = {
  pending: VoiceConnectionReplacedPayload[];
  shouldDisconnect: boolean;
};

export type VoiceAccessRevocationState = {
  pending: VoiceAccessRevokedPayload[];
  shouldDisconnect: boolean;
};

export function applyVoiceConnectionReplacementEvent(
  pending: readonly VoiceConnectionReplacedPayload[],
  payload: VoiceConnectionReplacedPayload | undefined,
  localParticipantId: string | null
): VoiceConnectionReplacementState {
  const replacedParticipantId = normalizeUserId(payload?.participantId ?? '');
  if (!replacedParticipantId) {
    return { pending: [...pending], shouldDisconnect: false };
  }

  const currentParticipantId = normalizeUserId(localParticipantId ?? '');
  if (currentParticipantId) {
    return {
      pending: [],
      shouldDisconnect: replacedParticipantId === currentParticipantId
    };
  }

  if (
    pending.some(
      (item) =>
        normalizeUserId(item.participantId ?? '') === replacedParticipantId
    )
  ) {
    return { pending: [...pending], shouldDisconnect: false };
  }

  return {
    pending: [...pending, payload ?? {}],
    shouldDisconnect: false
  };
}

export function resolvePendingVoiceConnectionReplacements(
  pending: readonly VoiceConnectionReplacedPayload[],
  localParticipantId: string
) {
  const currentParticipantId = normalizeUserId(localParticipantId);
  return Boolean(
    currentParticipantId &&
    pending.some(
      (payload) =>
        normalizeUserId(payload.participantId ?? '') === currentParticipantId
    )
  );
}

export function isVoiceAccessRevocationForCurrentGeneration(
  payload: VoiceAccessRevokedPayload | undefined,
  channel: ConnectedVoiceChannel | null,
  localParticipantId: string | null
) {
  const revokedParticipantId = normalizeUserId(payload?.participantId ?? '');
  const currentParticipantId = normalizeUserId(localParticipantId ?? '');
  if (
    !revokedParticipantId ||
    !currentParticipantId ||
    revokedParticipantId !== currentParticipantId ||
    !channel ||
    channel.channelScope !== 'server'
  ) {
    return false;
  }

  const revokedServerId = normalizeUserId(payload?.serverId ?? '');
  const connectedServerId = normalizeUserId(channel.serverId ?? '');
  const revokedSpaceId = normalizeUserId(payload?.spaceId ?? '');
  const connectedSpaceId = normalizeUserId(channel.spaceId);
  return Boolean(
    revokedServerId &&
    connectedServerId &&
    revokedServerId === connectedServerId &&
    revokedSpaceId &&
    revokedSpaceId === connectedSpaceId &&
    (!payload?.channelScope || payload.channelScope === 'server')
  );
}

export function applyVoiceAccessRevocationEvent(
  pending: readonly VoiceAccessRevokedPayload[],
  payload: VoiceAccessRevokedPayload | undefined,
  channel: ConnectedVoiceChannel | null,
  localParticipantId: string | null
): VoiceAccessRevocationState {
  if (localParticipantId) {
    return {
      pending: [],
      shouldDisconnect: isVoiceAccessRevocationForCurrentGeneration(
        payload,
        channel,
        localParticipantId
      )
    };
  }

  const participantId = normalizeUserId(payload?.participantId ?? '');
  if (!participantId || !isVoiceAccessRevocationForChannel(payload, channel)) {
    return { pending: [...pending], shouldDisconnect: false };
  }
  if (
    pending.some(
      (item) => normalizeUserId(item.participantId ?? '') === participantId
    )
  ) {
    return { pending: [...pending], shouldDisconnect: false };
  }

  return {
    pending: [...pending, payload ?? {}],
    shouldDisconnect: false
  };
}

export function resolvePendingVoiceAccessRevocations(
  pending: readonly VoiceAccessRevokedPayload[],
  channel: ConnectedVoiceChannel | null,
  localParticipantId: string
) {
  return pending.some((payload) =>
    isVoiceAccessRevocationForCurrentGeneration(
      payload,
      channel,
      localParticipantId
    )
  );
}

function isVoiceAccessRevocationForChannel(
  payload: VoiceAccessRevokedPayload | undefined,
  channel: ConnectedVoiceChannel | null
) {
  if (!channel || channel.channelScope !== 'server') {
    return false;
  }

  return Boolean(
    normalizeUserId(payload?.serverId ?? '') ===
      normalizeUserId(channel.serverId ?? '') &&
    normalizeUserId(payload?.spaceId ?? '') ===
      normalizeUserId(channel.spaceId) &&
    (!payload?.channelScope || payload.channelScope === 'server')
  );
}
