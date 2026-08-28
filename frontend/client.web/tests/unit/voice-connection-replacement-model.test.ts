import { expect, test } from '@playwright/test'
import {
  applyVoiceConnectionReplacementEvent,
  applyVoiceAccessRevocationEvent,
  isVoiceAccessRevocationForCurrentGeneration,
  resolvePendingVoiceAccessRevocations,
  resolvePendingVoiceConnectionReplacements,
} from '../../src/system/Server/hooks/voice/voiceConnectionReplacementModel'

test.describe('voice connection replacement model', () => {
  test('ignores a delayed stale replacement after a newer participant joined', () => {
    const result = applyVoiceConnectionReplacementEvent(
      [],
      { participantId: 'participant-old' },
      'participant-new',
    )

    expect(result.shouldDisconnect).toBe(false)
    expect(result.pending).toEqual([])
  })

  test('defers reordered events while joining and disconnects only the matching generation', () => {
    let pending = applyVoiceConnectionReplacementEvent(
      [],
      { participantId: 'participant-old', spaceId: 'space-a' },
      null,
    ).pending
    pending = applyVoiceConnectionReplacementEvent(
      pending,
      { participantId: 'participant-current', spaceId: 'space-b' },
      null,
    ).pending

    expect(
      resolvePendingVoiceConnectionReplacements(
        pending,
        'participant-current',
      ),
    ).toBe(true)
    expect(
      resolvePendingVoiceConnectionReplacements(pending, 'participant-newer'),
    ).toBe(false)
  })

  test('deduplicates repeated deferred replacement events', () => {
    const first = applyVoiceConnectionReplacementEvent(
      [],
      { participantId: 'participant-current' },
      null,
    )
    const repeated = applyVoiceConnectionReplacementEvent(
      first.pending,
      { participantId: 'PARTICIPANT-CURRENT' },
      null,
    )

    expect(repeated.pending).toHaveLength(1)
  })

  test('ignores a reordered access revocation for an older device generation', () => {
    const channel = {
      serverId: 'server-a',
      spaceId: 'space-a',
      title: 'Voice',
      channelScope: 'server' as const,
    }

    expect(isVoiceAccessRevocationForCurrentGeneration(
      {
        serverId: 'server-a',
        spaceId: 'space-a',
        channelScope: 'server',
        participantId: 'participant-old',
      },
      channel,
      'participant-new',
    )).toBe(false)
    expect(isVoiceAccessRevocationForCurrentGeneration(
      {
        serverId: 'SERVER-A',
        spaceId: 'SPACE-A',
        channelScope: 'server',
        participantId: 'PARTICIPANT-NEW',
      },
      channel,
      'participant-new',
    )).toBe(true)
  })

  test('ignores legacy unversioned and cross-space access revocations', () => {
    const channel = {
      serverId: 'server-a',
      spaceId: 'space-current',
      title: 'Voice',
      channelScope: 'server' as const,
    }

    expect(isVoiceAccessRevocationForCurrentGeneration(
      { serverId: 'server-a' },
      channel,
      'participant-current',
    )).toBe(false)
    expect(isVoiceAccessRevocationForCurrentGeneration(
      {
        serverId: 'server-a',
        spaceId: 'space-old',
        participantId: 'participant-current',
      },
      channel,
      'participant-current',
    )).toBe(false)
  })

  test('buffers an exact access revocation until the join returns its participant id', () => {
    const channel = {
      serverId: 'server-a',
      spaceId: 'space-a',
      title: 'Voice',
      channelScope: 'server' as const,
    }
    const deferred = applyVoiceAccessRevocationEvent(
      [],
      {
        serverId: 'server-a',
        spaceId: 'space-a',
        channelScope: 'server',
        participantId: 'participant-returned-later',
      },
      channel,
      null,
    )

    expect(deferred.shouldDisconnect).toBe(false)
    expect(deferred.pending).toHaveLength(1)
    expect(resolvePendingVoiceAccessRevocations(
      deferred.pending,
      channel,
      'participant-returned-later',
    )).toBe(true)
    expect(resolvePendingVoiceAccessRevocations(
      deferred.pending,
      channel,
      'participant-newer',
    )).toBe(false)
  })
})
