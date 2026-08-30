import * as signalR from '@microsoft/signalr';

import type {
  ConnectedVoiceChannel,
  PrivateCallJoinResult,
  PrivateCallState,
  VoiceStatePayload
} from './voiceChannelTypes';

type LocalVoiceState = {
  isMuted: boolean;
  isDeafened: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
};

export async function prepareVoiceJoinMedia<TConnection>(
  ensureConnection: () => Promise<TConnection>,
  ensureLocalStream: () => Promise<MediaStream>
) {
  const [connectionResult, mediaResult] = await Promise.allSettled([
    ensureConnection(),
    ensureLocalStream()
  ]);
  const connection =
    connectionResult.status === 'fulfilled' ? connectionResult.value : null;
  if (mediaResult.status === 'rejected') {
    return {
      connection,
      error: mediaResult.reason
    };
  }
  if (connectionResult.status === 'rejected') {
    return {
      connection: null,
      error: connectionResult.reason
    };
  }

  return { connection, error: null };
}

export function invokeJoinVoiceChannel(
  connection: signalR.HubConnection,
  channel: ConnectedVoiceChannel,
  localVoiceState: LocalVoiceState
) {
  if (channel.channelScope === 'private') {
    return connection.invoke<string | null>(
      'JoinPrivateVoiceChannel',
      channel.spaceId,
      localVoiceState.isMuted,
      localVoiceState.isDeafened,
      localVoiceState.isCameraEnabled,
      localVoiceState.isScreenSharing
    );
  }

  return connection.invoke<string | null>(
    'JoinVoiceChannel',
    channel.serverId,
    channel.spaceId,
    localVoiceState.isMuted,
    localVoiceState.isDeafened,
    localVoiceState.isCameraEnabled,
    localVoiceState.isScreenSharing
  );
}

export function invokeGetVoiceChannelState(
  connection: signalR.HubConnection,
  channel: ConnectedVoiceChannel
) {
  return channel.channelScope === 'private'
    ? connection.invoke('GetPrivateVoiceChannelState', channel.spaceId)
    : connection.invoke(
        'GetVoiceChannelState',
        channel.serverId,
        channel.spaceId
      );
}

export function invokeRefreshCurrentVoiceIdentity(
  connection: signalR.HubConnection
) {
  return connection.invoke('RefreshCurrentVoiceIdentity');
}

export async function leavePreviousVoiceChannelAfterFailedSwitch(
  connection: signalR.HubConnection,
  previousChannel: ConnectedVoiceChannel | null,
  nextChannel: ConnectedVoiceChannel
) {
  if (
    !previousChannel ||
    previousChannel.spaceId.trim().toLowerCase() ===
      nextChannel.spaceId.trim().toLowerCase()
  ) {
    return false;
  }

  try {
    await connection.invoke('LeaveVoiceChannel', previousChannel.spaceId);
    return true;
  } catch {
    return false;
  }
}

export async function leaveStaleVoiceJoin(
  connection: signalR.HubConnection,
  channel: ConnectedVoiceChannel
) {
  try {
    await connection.invoke('LeaveVoiceChannel', channel.spaceId);
    return true;
  } catch {
    return false;
  }
}

export function invokeStartPrivateCall(
  connection: signalR.HubConnection,
  spaceId: string,
  localVoiceState: LocalVoiceState
) {
  return connection.invoke<PrivateCallJoinResult | null>(
    'StartPrivateCall',
    spaceId,
    localVoiceState.isMuted,
    localVoiceState.isDeafened,
    localVoiceState.isCameraEnabled,
    localVoiceState.isScreenSharing
  );
}

export function invokeAcceptPrivateCall(
  connection: signalR.HubConnection,
  spaceId: string,
  callId: string,
  localVoiceState: LocalVoiceState
) {
  return connection.invoke<PrivateCallJoinResult | null>(
    'AcceptPrivateCall',
    spaceId,
    callId,
    localVoiceState.isMuted,
    localVoiceState.isDeafened,
    localVoiceState.isCameraEnabled,
    localVoiceState.isScreenSharing
  );
}

export function invokeDeclinePrivateCall(
  connection: signalR.HubConnection,
  spaceId: string,
  callId: string
) {
  return connection.invoke<boolean>('DeclinePrivateCall', spaceId, callId);
}

export function invokeCancelPrivateCall(
  connection: signalR.HubConnection,
  spaceId: string,
  callId: string
) {
  return connection.invoke<boolean>('CancelPrivateCall', spaceId, callId);
}

export function invokeGetPrivateCallState(
  connection: signalR.HubConnection,
  spaceId: string
) {
  return connection.invoke<PrivateCallState | null>(
    'GetPrivateCallState',
    spaceId
  );
}

export function invokeGetIncomingPrivateCalls(
  connection: signalR.HubConnection
) {
  return connection.invoke<PrivateCallState[]>('GetIncomingPrivateCalls');
}

export function invokeUpdateVoiceParticipantModeration(
  connection: signalR.HubConnection,
  {
    serverId,
    spaceId,
    participantId,
    isServerMuted,
    isServerDeafened
  }: {
    serverId: string;
    spaceId: string;
    participantId: string;
    isServerMuted?: boolean;
    isServerDeafened?: boolean;
  }
) {
  return connection.invoke<boolean>(
    'UpdateVoiceParticipantModeration',
    serverId,
    spaceId,
    participantId,
    isServerMuted ?? null,
    isServerDeafened ?? null
  );
}

export function invokeDisconnectVoiceParticipant(
  connection: signalR.HubConnection,
  {
    serverId,
    spaceId,
    participantId
  }: {
    serverId: string;
    spaceId: string;
    participantId: string;
  }
) {
  return connection.invoke<boolean>(
    'DisconnectVoiceParticipant',
    serverId,
    spaceId,
    participantId
  );
}

export function invokeRenewVoiceAccessLease(
  connection: signalR.HubConnection,
  channel: ConnectedVoiceChannel
) {
  return channel.channelScope === 'private'
    ? connection.invoke<VoiceStatePayload | null>(
        'RenewPrivateVoiceChannelAccessLease',
        channel.spaceId
      )
    : connection.invoke<VoiceStatePayload | null>(
        'RenewVoiceChannelAccessLease',
        channel.serverId,
        channel.spaceId
      );
}

export function renewVoiceAccessLeaseWithTimeout(
  connection: signalR.HubConnection,
  channel: ConnectedVoiceChannel,
  timeoutMs: number
) {
  return new Promise<VoiceStatePayload | null>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error('Voice access lease renewal timed out.'));
    }, timeoutMs);

    void invokeRenewVoiceAccessLease(connection, channel).then(
      (payload) => {
        globalThis.clearTimeout(timeoutId);
        resolve(payload);
      },
      (error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

export function isVoiceAccessLeasePayloadForChannel(
  payload: VoiceStatePayload | null,
  channel: ConnectedVoiceChannel,
  localParticipantId: string
): payload is VoiceStatePayload {
  if (
    !payload ||
    payload.spaceId.toLowerCase() !== channel.spaceId.toLowerCase() ||
    payload.channelScope !== channel.channelScope ||
    !Array.isArray(payload.participants) ||
    !payload.participants.some(
      (participant) =>
        participant.participantId.toLowerCase() ===
        localParticipantId.toLowerCase()
    )
  ) {
    return false;
  }

  if (channel.channelScope === 'private') {
    return payload.serverId === null;
  }

  return Boolean(
    channel.serverId &&
    payload.serverId &&
    payload.serverId.toLowerCase() === channel.serverId.toLowerCase()
  );
}

type VoiceAccessLeaseCheckOptions = {
  renew: () => Promise<VoiceStatePayload | null>;
  isCurrent: () => boolean;
  isAccepted: (payload: VoiceStatePayload) => boolean;
  onAccepted: (payload: VoiceStatePayload) => Promise<void> | void;
  onDenied: () => Promise<void> | void;
  onTransportError: (error: unknown) => Promise<void> | void;
};

export async function runVoiceAccessLeaseCheck({
  renew,
  isCurrent,
  isAccepted,
  onAccepted,
  onDenied,
  onTransportError
}: VoiceAccessLeaseCheckOptions) {
  try {
    const payload = await renew();
    if (!isCurrent()) {
      return 'stale' as const;
    }

    if (!payload || !isAccepted(payload)) {
      await onDenied();
      return 'denied' as const;
    }

    await onAccepted(payload);
    return 'renewed' as const;
  } catch (error) {
    if (!isCurrent()) {
      return 'stale' as const;
    }

    await onTransportError(error);
    return 'unavailable' as const;
  }
}

export function waitForConnected(
  connection: signalR.HubConnection,
  timeoutMs = 4000
) {
  const startedAt = Date.now();

  return new Promise<void>((resolve) => {
    function tick() {
      if (
        connection.state === signalR.HubConnectionState.Connected ||
        Date.now() - startedAt >= timeoutMs
      ) {
        resolve();
        return;
      }

      window.setTimeout(tick, 50);
    }

    tick();
  });
}
