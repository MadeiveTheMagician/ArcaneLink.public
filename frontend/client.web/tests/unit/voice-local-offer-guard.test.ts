import { expect, test } from '@playwright/test'
import {
  flushVoiceLocalOffer,
  isVoicePeerMakingLocalOffer,
  runVoiceLocalOffer,
} from '../../src/system/Server/hooks/voice/voiceLocalOfferGuard'

type MutablePeerIdentity = RTCPeerConnection & {
  signalingState: RTCSignalingState
}

function createPeerIdentity(
  signalingState: RTCSignalingState = 'stable',
): MutablePeerIdentity {
  return { signalingState } as MutablePeerIdentity
}

test.describe('voice local offer coordinator', () => {
  test('coalesces overlapping work and resumes the latest offer when stable', async () => {
    const peer = createPeerIdentity()
    let releaseFirstOffer: (() => void) | null = null
    const firstOfferBlocked = new Promise<void>((resolve) => {
      releaseFirstOffer = resolve
    })

    const firstOffer = runVoiceLocalOffer(peer, async () => {
      peer.signalingState = 'have-local-offer'
      await firstOfferBlocked
      return 'first'
    })
    expect(isVoicePeerMakingLocalOffer(peer)).toBe(true)

    let supersededOfferRan = false
    const supersededOffer = runVoiceLocalOffer(peer, async () => {
      supersededOfferRan = true
      return 'superseded'
    })
    let latestOfferRan = false
    const latestOffer = runVoiceLocalOffer(peer, async () => {
      latestOfferRan = true
      return 'latest'
    })

    await expect(supersededOffer).resolves.toEqual({ status: 'superseded' })
    expect(supersededOfferRan).toBe(false)

    releaseFirstOffer?.()
    await expect(firstOffer).resolves.toEqual({
      status: 'completed',
      value: 'first',
    })
    await Promise.resolve()
    expect(latestOfferRan).toBe(false)

    peer.signalingState = 'stable'
    flushVoiceLocalOffer(peer)
    await expect(latestOffer).resolves.toEqual({
      status: 'completed',
      value: 'latest',
    })
  })

  test('lets an ICE restart replace an offer waiting for stable signaling', async () => {
    const peer = createPeerIdentity('have-local-offer')
    const staleRenegotiation = runVoiceLocalOffer(
      peer,
      async () => 'stale',
    )
    const iceRestart = runVoiceLocalOffer(
      peer,
      async () => 'restart',
      { requiresStable: false, priority: 'ice-restart' },
    )

    await expect(staleRenegotiation).resolves.toEqual({
      status: 'superseded',
    })
    await expect(iceRestart).resolves.toEqual({
      status: 'completed',
      value: 'restart',
    })
  })

  test('starts the pending timeout only after the active offer finishes', async () => {
    const peer = createPeerIdentity()
    let releaseActiveOffer: (() => void) | null = null
    const activeOfferBlocked = new Promise<void>((resolve) => {
      releaseActiveOffer = resolve
    })
    const activeOffer = runVoiceLocalOffer(peer, async () => {
      await activeOfferBlocked
      return 'active'
    })

    let pendingOfferSettled = false
    const pendingOffer = runVoiceLocalOffer(
      peer,
      async () => 'pending',
      { pendingTimeoutMs: 5 },
    ).then((result) => {
      pendingOfferSettled = true
      return result
    })

    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(pendingOfferSettled).toBe(false)

    releaseActiveOffer?.()
    await activeOffer
    await expect(pendingOffer).resolves.toEqual({
      status: 'completed',
      value: 'pending',
    })
  })

  test('does not let normal renegotiation supersede a queued ICE restart', async () => {
    const peer = createPeerIdentity()
    let releaseActiveOffer: (() => void) | null = null
    const activeOfferBlocked = new Promise<void>((resolve) => {
      releaseActiveOffer = resolve
    })
    const activeOffer = runVoiceLocalOffer(peer, async () => {
      await activeOfferBlocked
    })
    const iceRestart = runVoiceLocalOffer(
      peer,
      async () => 'restart',
      { requiresStable: false, priority: 'ice-restart' },
    )
    const normalRenegotiation = runVoiceLocalOffer(
      peer,
      async () => 'normal',
    )

    await expect(normalRenegotiation).resolves.toEqual({
      status: 'superseded',
    })
    releaseActiveOffer?.()
    await activeOffer
    await expect(iceRestart).resolves.toEqual({
      status: 'completed',
      value: 'restart',
    })
  })

  test('isolates peer generations and releases a failed operation', async () => {
    const replacedPeer = createPeerIdentity()
    const currentPeer = createPeerIdentity()
    let releaseReplacedPeer: (() => void) | null = null
    const replacedPeerBlocked = new Promise<void>((resolve) => {
      releaseReplacedPeer = resolve
    })

    const replacedPeerOffer = runVoiceLocalOffer(replacedPeer, async () => {
      await replacedPeerBlocked
    })
    await expect(
      runVoiceLocalOffer(currentPeer, async () => 'current'),
    ).resolves.toEqual({ status: 'completed', value: 'current' })

    releaseReplacedPeer?.()
    await replacedPeerOffer

    await expect(
      runVoiceLocalOffer(currentPeer, async () => {
        throw new Error('offer failed')
      }),
    ).rejects.toThrow('offer failed')
    expect(isVoicePeerMakingLocalOffer(currentPeer)).toBe(false)

    await expect(
      runVoiceLocalOffer(currentPeer, async () => 'retried'),
    ).resolves.toEqual({ status: 'completed', value: 'retried' })
  })
})
