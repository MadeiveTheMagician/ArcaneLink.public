import type { HubConnection } from '@microsoft/signalr';
import { expect, test } from '@playwright/test';

import type {
  ConnectedVoiceChannel,
  VoiceStatePayload
} from '../../src/system/Server/hooks/voice/voiceChannelTypes';
import {
  invokeAcceptPrivateCall,
  invokeCancelPrivateCall,
  invokeDeclinePrivateCall,
  invokeDisconnectVoiceParticipant,
  invokeGetIncomingPrivateCalls,
  invokeGetPrivateCallState,
  invokeGetVoiceChannelState,
  invokeJoinVoiceChannel,
  invokeRefreshCurrentVoiceIdentity,
  invokeRenewVoiceAccessLease,
  invokeStartPrivateCall,
  invokeUpdateVoiceParticipantModeration,
  isVoiceAccessLeasePayloadForChannel,
  leavePreviousVoiceChannelAfterFailedSwitch,
  leaveStaleVoiceJoin,
  prepareVoiceJoinMedia,
  renewVoiceAccessLeaseWithTimeout,
  runVoiceAccessLeaseCheck
} from '../../src/system/Server/hooks/voice/voiceHubCommands';

function createConnectionSpy() {
  const calls: unknown[][] = [];
  const connection = {
    invoke: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(null);
    }
  } as unknown as HubConnection;

  return { connection, calls };
}

const localState = {
  isMuted: true,
  isDeafened: false,
  isCameraEnabled: true,
  isScreenSharing: false
};

test.describe('voice hub commands', () => {
  test('uses server-scoped commands with server and space identifiers', async () => {
    const { connection, calls } = createConnectionSpy();
    const channel: ConnectedVoiceChannel = {
      serverId: 'server-1',
      spaceId: 'space-1',
      title: 'Voice',
      channelScope: 'server'
    };

    await invokeJoinVoiceChannel(connection, channel, localState);
    await invokeGetVoiceChannelState(connection, channel);
    await invokeRenewVoiceAccessLease(connection, channel);

    expect(calls).toEqual([
      ['JoinVoiceChannel', 'server-1', 'space-1', true, false, true, false],
      ['GetVoiceChannelState', 'server-1', 'space-1'],
      ['RenewVoiceChannelAccessLease', 'server-1', 'space-1']
    ]);
  });

  test('refreshes the current voice identity through the bounded hub command', async () => {
    const { connection, calls } = createConnectionSpy();

    await invokeRefreshCurrentVoiceIdentity(connection);

    expect(calls).toEqual([['RefreshCurrentVoiceIdentity']]);
  });

  test('starts local media before waiting for the hub transport', async () => {
    let resolveConnection: ((value: string) => void) | null = null;
    const connectionPromise = new Promise<string>((resolve) => {
      resolveConnection = resolve;
    });
    const calls: string[] = [];

    const pending = prepareVoiceJoinMedia(
      () => {
        calls.push('connection');
        return connectionPromise;
      },
      async () => {
        calls.push('media');
        return {} as MediaStream;
      }
    );

    expect(calls).toEqual(['connection', 'media']);
    resolveConnection?.('connected');
    await expect(pending).resolves.toEqual({
      connection: 'connected',
      error: null
    });
  });

  test('preserves a connected transport when microphone capture rejects', async () => {
    const captureError = new DOMException(
      'Microphone denied',
      'NotAllowedError'
    );

    await expect(
      prepareVoiceJoinMedia(
        async () => 'connected',
        async () => {
          throw captureError;
        }
      )
    ).resolves.toEqual({
      connection: 'connected',
      error: captureError
    });
  });

  test('uses private-scoped commands without a server identifier', async () => {
    const { connection, calls } = createConnectionSpy();
    const channel: ConnectedVoiceChannel = {
      serverId: null,
      spaceId: 'private-1',
      title: 'Private call',
      channelScope: 'private'
    };

    await invokeJoinVoiceChannel(connection, channel, localState);
    await invokeGetVoiceChannelState(connection, channel);
    await invokeRenewVoiceAccessLease(connection, channel);

    expect(calls).toEqual([
      ['JoinPrivateVoiceChannel', 'private-1', true, false, true, false],
      ['GetPrivateVoiceChannelState', 'private-1'],
      ['RenewPrivateVoiceChannelAccessLease', 'private-1']
    ]);
  });

  test('leaves the previous voice space when a channel switch fails', async () => {
    const { connection, calls } = createConnectionSpy();
    const previousChannel: ConnectedVoiceChannel = {
      serverId: 'server-1',
      spaceId: 'server-voice-1',
      title: 'Server voice',
      channelScope: 'server'
    };
    const nextChannel: ConnectedVoiceChannel = {
      serverId: null,
      spaceId: 'private-1',
      title: 'Private call',
      channelScope: 'private'
    };

    await expect(
      leavePreviousVoiceChannelAfterFailedSwitch(
        connection,
        previousChannel,
        nextChannel
      )
    ).resolves.toBe(true);
    await expect(
      leavePreviousVoiceChannelAfterFailedSwitch(connection, previousChannel, {
        ...nextChannel,
        spaceId: 'SERVER-VOICE-1'
      })
    ).resolves.toBe(false);

    const failedConnection = {
      invoke: () => Promise.reject(new Error('transport unavailable'))
    } as unknown as HubConnection;
    await expect(
      leavePreviousVoiceChannelAfterFailedSwitch(
        failedConnection,
        previousChannel,
        nextChannel
      )
    ).resolves.toBe(false);

    expect(calls).toEqual([['LeaveVoiceChannel', 'server-voice-1']]);
  });

  test('cleans a stale completed join for either server or private scope', async () => {
    const invocations: unknown[][] = [];
    const connection = {
      invoke: async (...args: unknown[]) => {
        invocations.push(args);
      }
    } as unknown as HubConnection;
    const serverChannel = {
      serverId: 'server-1',
      spaceId: 'server-space-new',
      title: 'Server voice',
      channelScope: 'server' as const
    };
    const privateChannel = {
      serverId: null,
      spaceId: 'private-space-new',
      title: 'Private voice',
      channelScope: 'private' as const
    };

    await expect(leaveStaleVoiceJoin(connection, serverChannel)).resolves.toBe(
      true
    );
    await expect(leaveStaleVoiceJoin(connection, privateChannel)).resolves.toBe(
      true
    );
    expect(invocations).toEqual([
      ['LeaveVoiceChannel', 'server-space-new'],
      ['LeaveVoiceChannel', 'private-space-new']
    ]);
  });

  test('uses call lifecycle commands on the voice hub connection', async () => {
    const { connection, calls } = createConnectionSpy();

    await invokeStartPrivateCall(connection, 'private-1', localState);
    await invokeAcceptPrivateCall(
      connection,
      'private-1',
      'call-1',
      localState
    );
    await invokeDeclinePrivateCall(connection, 'private-1', 'call-1');
    await invokeCancelPrivateCall(connection, 'private-1', 'call-1');
    await invokeGetPrivateCallState(connection, 'private-1');
    await invokeGetIncomingPrivateCalls(connection);

    expect(calls).toEqual([
      ['StartPrivateCall', 'private-1', true, false, true, false],
      ['AcceptPrivateCall', 'private-1', 'call-1', true, false, true, false],
      ['DeclinePrivateCall', 'private-1', 'call-1'],
      ['CancelPrivateCall', 'private-1', 'call-1'],
      ['GetPrivateCallState', 'private-1'],
      ['GetIncomingPrivateCalls']
    ]);
  });

  test('sends nullable server voice moderation patches', async () => {
    const { connection, calls } = createConnectionSpy();

    await invokeUpdateVoiceParticipantModeration(connection, {
      serverId: 'server-1',
      spaceId: 'space-1',
      participantId: 'participant-1',
      isServerMuted: true
    });
    await invokeUpdateVoiceParticipantModeration(connection, {
      serverId: 'server-1',
      spaceId: 'space-1',
      participantId: 'participant-1',
      isServerDeafened: false
    });
    await invokeDisconnectVoiceParticipant(connection, {
      serverId: 'server-1',
      spaceId: 'space-1',
      participantId: 'participant-1'
    });

    expect(calls).toEqual([
      [
        'UpdateVoiceParticipantModeration',
        'server-1',
        'space-1',
        'participant-1',
        true,
        null
      ],
      [
        'UpdateVoiceParticipantModeration',
        'server-1',
        'space-1',
        'participant-1',
        null,
        false
      ],
      ['DisconnectVoiceParticipant', 'server-1', 'space-1', 'participant-1']
    ]);
  });

  test('accepts only a matching authoritative roster containing the local participant', () => {
    const channel: ConnectedVoiceChannel = {
      serverId: 'SERVER-1',
      spaceId: 'SPACE-1',
      title: 'Voice',
      channelScope: 'server'
    };
    const payload: VoiceStatePayload = {
      serverId: 'server-1',
      spaceId: 'space-1',
      channelScope: 'server',
      participants: [
        {
          participantId: 'participant-1',
          userId: 'user-1',
          login: 'user',
          displayName: 'User',
          isMuted: false,
          isDeafened: false,
          isCameraEnabled: false,
          isScreenSharing: false,
          joinedAt: new Date().toISOString()
        }
      ]
    };

    expect(
      isVoiceAccessLeasePayloadForChannel(payload, channel, 'PARTICIPANT-1')
    ).toBe(true);
    expect(
      isVoiceAccessLeasePayloadForChannel(
        { ...payload, participants: [] },
        channel,
        'participant-1'
      )
    ).toBe(false);
    expect(
      isVoiceAccessLeasePayloadForChannel(
        { ...payload, spaceId: 'other-space' },
        channel,
        'participant-1'
      )
    ).toBe(false);
  });

  test('fails a lease renewal that exceeds its client deadline', async () => {
    const connection = {
      invoke: () => new Promise(() => undefined)
    } as unknown as HubConnection;
    const channel: ConnectedVoiceChannel = {
      serverId: null,
      spaceId: 'private-1',
      title: 'Private call',
      channelScope: 'private'
    };

    await expect(
      renewVoiceAccessLeaseWithTimeout(connection, channel, 5)
    ).rejects.toThrow('timed out');
  });

  test('tears down only on denial and preserves the session on transport failure', async () => {
    const payload = {
      serverId: null,
      spaceId: 'private-1',
      channelScope: 'private' as const,
      participants: []
    };
    let teardownCount = 0;
    let transportFailureCount = 0;
    let acceptedCount = 0;
    const callbacks = {
      isCurrent: () => true,
      isAccepted: () => true,
      onAccepted: () => {
        acceptedCount += 1;
      },
      onDenied: () => {
        teardownCount += 1;
      },
      onTransportError: () => {
        transportFailureCount += 1;
      }
    };

    expect(
      await runVoiceAccessLeaseCheck({
        ...callbacks,
        renew: async () => null
      })
    ).toBe('denied');
    expect(
      await runVoiceAccessLeaseCheck({
        ...callbacks,
        renew: async () => {
          throw new Error('transport failed');
        }
      })
    ).toBe('unavailable');
    expect(teardownCount).toBe(1);
    expect(transportFailureCount).toBe(1);

    expect(
      await runVoiceAccessLeaseCheck({
        ...callbacks,
        renew: async () => payload,
        isCurrent: () => false
      })
    ).toBe('stale');
    expect(teardownCount).toBe(1);

    expect(
      await runVoiceAccessLeaseCheck({
        ...callbacks,
        renew: async () => payload
      })
    ).toBe('renewed');
    expect(acceptedCount).toBe(1);
  });
});
