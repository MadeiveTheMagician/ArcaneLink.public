import { expect, test } from '@playwright/test';

import {
  mergePrivateCallState,
  resolvePrivateCallAudioMode,
  selectIncomingPrivateCalls,
  shouldDisconnectForPrivateCallState
} from '../../src/system/Server/hooks/voice/privateCallModel';
import type { PrivateCallState } from '../../src/system/Server/hooks/voice/voiceChannelTypes';

function createCall(patch: Partial<PrivateCallState> = {}): PrivateCallState {
  return {
    callId: 'call-1',
    spaceId: 'space-1',
    phase: 'ringing',
    revision: 1,
    caller: { userId: 'caller', login: 'caller', displayName: 'Caller' },
    startedAt: '2026-08-13T10:00:00Z',
    answeredAt: null,
    endedAt: null,
    participantUserIds: ['caller'],
    ringingUserIds: ['callee-a', 'callee-b'],
    declinedUserIds: [],
    endReason: null,
    ...patch
  };
}

test.describe('private call lifecycle model', () => {
  test('never revives an active or ended call with a late ringing event', () => {
    const active = createCall({
      phase: 'active',
      revision: 2,
      ringingUserIds: []
    });
    const ended = createCall({
      phase: 'ended',
      revision: 3,
      ringingUserIds: [],
      endedAt: '2026-08-13T10:05:00Z'
    });

    expect(mergePrivateCallState(active, createCall())).toBe(active);
    expect(mergePrivateCallState(ended, active)).toBe(ended);
  });

  test('ignores lower or duplicate revisions even when their phase looks newer', () => {
    const active = createCall({
      phase: 'active',
      revision: 5,
      ringingUserIds: []
    });
    const staleEnded = createCall({
      phase: 'ended',
      revision: 4,
      ringingUserIds: [],
      endedAt: '2026-08-13T10:04:00Z'
    });

    expect(mergePrivateCallState(active, staleEnded)).toBe(active);
    expect(mergePrivateCallState(active, { ...active })).toBe(active);
  });

  test('does not restore a callee removed by a newer ringing transition', () => {
    const current = createCall({
      revision: 2,
      ringingUserIds: ['callee-b'],
      declinedUserIds: ['callee-a']
    });
    const stale = createCall({
      revision: 3,
      ringingUserIds: ['callee-a', 'callee-b']
    });

    expect(mergePrivateCallState(current, stale)).toMatchObject({
      ringingUserIds: ['callee-b'],
      declinedUserIds: ['callee-a']
    });
  });

  test('keeps simultaneous incoming calls ordered and persistent until resolved', () => {
    const later = createCall({
      callId: 'call-2',
      spaceId: 'space-2',
      startedAt: '2026-08-13T10:01:00Z',
      ringingUserIds: ['current-user']
    });
    const earlier = createCall({ ringingUserIds: ['current-user'] });

    expect(
      selectIncomingPrivateCalls([later, earlier], 'CURRENT-USER').map(
        (call) => call.callId
      )
    ).toEqual(['call-1', 'call-2']);
    expect(
      selectIncomingPrivateCalls(
        [later, earlier],
        'current-user',
        new Set(['CALL-1'])
      ).map((call) => call.callId)
    ).toEqual(['call-2']);
  });

  test('uses incoming ringtone before outgoing ringback and stops when answered', () => {
    const outgoing = createCall();
    const incoming = createCall({
      callId: 'call-2',
      spaceId: 'space-2',
      ringingUserIds: ['caller']
    });

    expect(resolvePrivateCallAudioMode([outgoing], 'caller')).toBe('outgoing');
    expect(resolvePrivateCallAudioMode([outgoing, incoming], 'caller')).toBe(
      'incoming'
    );
    expect(
      resolvePrivateCallAudioMode(
        [{ ...outgoing, phase: 'active', ringingUserIds: [] }],
        'caller'
      )
    ).toBeNull();
  });

  test('terminal teardown only applies to the locally connected space', () => {
    const ended = createCall({ phase: 'ended', ringingUserIds: [] });
    expect(shouldDisconnectForPrivateCallState(ended, 'SPACE-1')).toBe(true);
    expect(shouldDisconnectForPrivateCallState(ended, 'space-2')).toBe(false);
    expect(
      shouldDisconnectForPrivateCallState(
        { ...ended, phase: 'active' },
        'space-1'
      )
    ).toBe(false);
  });
});
