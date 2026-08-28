import { expect, test } from '@playwright/test'
import {
  createSafeVoicePeerStatsSummary,
  serializeSafeVoicePeerStatsSummary,
} from '../../src/system/Server/hooks/voice/voicePeerStatsSummary'

test.describe('safe voice peer stats summary', () => {
  test('keeps audio direction, track state and RTP counters', () => {
    const summary = createSafeVoicePeerStatsSummary({
      sample: 'connected+5000ms',
      connectionState: 'connected',
      iceConnectionState: 'completed',
      signalingState: 'stable',
      transceivers: [
        {
          direction: 'sendrecv',
          currentDirection: 'sendrecv',
          senderTrack: {
            kind: 'audio',
            enabled: true,
            muted: false,
            readyState: 'live',
          },
          receiverTrack: {
            kind: 'audio',
            enabled: true,
            muted: true,
            readyState: 'live',
          },
        },
        {
          direction: 'sendrecv',
          currentDirection: 'recvonly',
          senderTrack: { kind: 'video', readyState: 'live' },
          receiverTrack: { kind: 'video', readyState: 'live' },
        },
      ],
      stats: [
        {
          type: 'inbound-rtp',
          kind: 'audio',
          packetsReceived: 12,
          packetsLost: 1,
          bytesReceived: 1_024,
          totalAudioEnergy: 0.25,
        },
        {
          type: 'outbound-rtp',
          mediaType: 'audio',
          packetsSent: 20,
          bytesSent: 2_048,
          totalAudioEnergy: 0.75,
        },
        {
          type: 'remote-inbound-rtp',
          kind: 'audio',
          packetsReceived: 19,
          packetsLost: 1,
          bytesReceived: 1_900,
          totalAudioEnergy: 0.7,
          fractionLost: 0.05,
          roundTripTime: 0.08,
        },
        {
          type: 'inbound-rtp',
          kind: 'video',
          packetsReceived: 500,
          bytesReceived: 900_000,
        },
      ],
    })

    expect(summary).toEqual({
      sample: 'connected+5000ms',
      connectionState: 'connected',
      iceConnectionState: 'completed',
      signalingState: 'stable',
      audioTransceivers: [
        {
          direction: 'sendrecv',
          currentDirection: 'sendrecv',
          sender: { enabled: true, muted: false, readyState: 'live' },
          receiver: { enabled: true, muted: true, readyState: 'live' },
        },
      ],
      inboundAudio: [
        {
          packetsReceived: 12,
          packetsLost: 1,
          bytesReceived: 1_024,
          totalAudioEnergy: 0.25,
        },
      ],
      outboundAudio: [
        {
          packetsSent: 20,
          bytesSent: 2_048,
          totalAudioEnergy: 0.75,
        },
      ],
      remoteInboundAudio: [
        {
          packetsReceived: 19,
          packetsLost: 1,
          bytesReceived: 1_900,
          totalAudioEnergy: 0.7,
          fractionLost: 0.05,
          roundTripTime: 0.08,
        },
      ],
    })
  })

  test('serializes only allowlisted fields and discards sensitive metadata', () => {
    const summary = createSafeVoicePeerStatsSummary({
      sample: 'token=secret',
      connectionState: 'connected; jwt=secret',
      iceConnectionState: 'connected',
      signalingState: 'stable',
      transceivers: [
        {
          direction: 'sendrecv',
          currentDirection: 'sendrecv',
          senderTrack: {
            kind: 'audio',
            enabled: true,
            muted: false,
            readyState: 'live',
            label: 'Private microphone',
            deviceId: 'device-secret',
          } as never,
          receiverTrack: { kind: 'audio', readyState: 'live' },
        },
      ],
      stats: [
        {
          id: 'sensitive-id',
          type: 'inbound-rtp',
          kind: 'audio',
          packetsReceived: 1,
          bytesReceived: 2,
          address: '192.0.2.10',
          ip: '192.0.2.10',
          sdp: 'v=0 secret',
          jwt: 'secret-token',
          codecId: 'codec-secret',
          trackIdentifier: 'track-secret',
        },
        {
          type: 'local-candidate',
          address: '198.51.100.7',
          deviceId: 'device-secret',
        },
      ],
    })
    const serialized = serializeSafeVoicePeerStatsSummary(summary)

    expect(summary.sample).toBe('event')
    expect(summary.connectionState).toBeNull()
    expect(serialized).toContain('"packetsReceived":1')
    for (const secret of [
      'secret',
      '192.0.2.10',
      '198.51.100.7',
      'address',
      'deviceId',
      'label',
      'sdp',
      'jwt',
      'codecId',
      'trackIdentifier',
    ]) {
      expect(serialized).not.toContain(secret)
    }
  })
})
