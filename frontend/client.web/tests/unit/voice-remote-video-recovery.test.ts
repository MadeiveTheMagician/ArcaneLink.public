import { expect, test } from '@playwright/test'
import { resolveRemoteVideoRecoveryState } from '../../src/system/Server/hooks/voice/voiceRemoteVideoRecovery'

function createRemoteStream(
  tracks: Array<Pick<MediaStreamTrack, 'readyState' | 'muted' | 'enabled'>>,
) {
  return {
    getVideoTracks: () => tracks,
  } as unknown as MediaStream
}

test.describe('remote video recovery', () => {
  test('gives a temporarily muted live track a recovery grace period', () => {
    const stream = createRemoteStream([
      { readyState: 'live', muted: true, enabled: true },
    ])
    const firstSample = resolveRemoteVideoRecoveryState(stream, 1, null, 1_000)

    expect(firstSample).toEqual({
      shouldRecover: false,
      mutedSince: 1_000,
    })
    expect(
      resolveRemoteVideoRecoveryState(
        stream,
        1,
        firstSample.mutedSince,
        12_999,
      ).shouldRecover,
    ).toBe(false)
    expect(
      resolveRemoteVideoRecoveryState(
        stream,
        1,
        firstSample.mutedSince,
        13_000,
      ).shouldRecover,
    ).toBe(true)
  })

  test('recovers missing tracks and clears muted state after media resumes', () => {
    const playingStream = createRemoteStream([
      { readyState: 'live', muted: false, enabled: true },
    ])
    expect(
      resolveRemoteVideoRecoveryState(playingStream, 1, 4_000, 20_000),
    ).toEqual({ shouldRecover: false, mutedSince: null })

    const endedStream = createRemoteStream([
      { readyState: 'ended', muted: false, enabled: true },
    ])
    expect(
      resolveRemoteVideoRecoveryState(endedStream, 1, null, 20_000),
    ).toEqual({ shouldRecover: true, mutedSince: null })
    expect(
      resolveRemoteVideoRecoveryState(playingStream, 2, null, 20_000),
    ).toEqual({ shouldRecover: true, mutedSince: null })
  })
})
