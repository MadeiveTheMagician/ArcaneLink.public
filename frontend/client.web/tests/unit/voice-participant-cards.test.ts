import { expect, test } from '@playwright/test'
import type { ServerMemberDetailsResponse } from '../../src/shared/types'
import type { VoiceParticipant } from '../../src/system/Server/hooks/voice/useVoiceChannel'
import {
  createEffectiveVoiceParticipants,
  createVoiceParticipantCards,
  getActiveVoiceParticipantAudioStatuses,
} from '../../src/system/Server/components/voice/participants/voiceParticipantCards'
import {
  selectParticipantVideoTracks,
} from '../../src/system/Server/components/voice/participants/voiceMediaTracks'
import {
  registerVoiceVideoReceiverTrack,
} from '../../src/system/Server/hooks/voice/voiceVideoTrackKinds'

const remoteParticipant: VoiceParticipant = {
  participantId: 'remote-user',
  userId: 'remote-user',
  login: 'remote',
  displayName: 'Remote',
  isMuted: false,
  isDeafened: false,
  isCameraEnabled: false,
  isScreenSharing: false,
  joinedAt: '',
}

function serverMember(
  userId: string,
  login: string,
  displayName: string,
): ServerMemberDetailsResponse {
  return {
    userId,
    user: { login, displayName },
  } as ServerMemberDetailsResponse
}

test.describe('voice participant cards model', () => {
  test('returns only active remote audio statuses', () => {
    expect(getActiveVoiceParticipantAudioStatuses(remoteParticipant)).toEqual([])
    expect(
      getActiveVoiceParticipantAudioStatuses({
        isMuted: true,
        isDeafened: false,
      }),
    ).toEqual(['muted'])
    expect(
      getActiveVoiceParticipantAudioStatuses({
        isMuted: true,
        isDeafened: true,
      }),
    ).toEqual(['muted', 'deafened'])
  })

  test('keeps the server snapshot unchanged before connection', () => {
    const result = createEffectiveVoiceParticipants({
      participants: [remoteParticipant],
      serverMembers: [],
      isConnected: false,
      localParticipantId: 'local-user',
      currentUserId: 'local-user',
      isMuted: false,
      isDeafened: false,
      isCameraEnabled: false,
      isScreenSharing: false,
    })

    expect(result).toEqual([remoteParticipant])
  })

  test('adds a local fallback while realtime membership is pending', () => {
    const result = createEffectiveVoiceParticipants({
      participants: [remoteParticipant],
      serverMembers: [],
      isConnected: true,
      localParticipantId: 'local-user',
      currentUserId: 'local-user',
      isMuted: true,
      isDeafened: false,
      isCameraEnabled: true,
      isScreenSharing: false,
    })

    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({
      participantId: 'local-user',
      userId: 'local-user',
      isMuted: true,
      isCameraEnabled: true,
    })
  })

  test('does not duplicate a local participant from realtime', () => {
    const result = createEffectiveVoiceParticipants({
      participants: [remoteParticipant],
      serverMembers: [],
      isConnected: true,
      localParticipantId: 'remote-user',
      currentUserId: 'remote-user',
      isMuted: false,
      isDeafened: false,
      isCameraEnabled: false,
      isScreenSharing: false,
    })

    expect(result).toEqual([remoteParticipant])
  })

  test('refreshes a connected participant from the effective server identity', () => {
    const result = createEffectiveVoiceParticipants({
      participants: [remoteParticipant],
      serverMembers: [
        serverMember('remote-user', 'server-login', 'Server Alias'),
      ],
      isConnected: true,
      localParticipantId: 'local-user',
      currentUserId: 'local-user',
      isMuted: false,
      isDeafened: false,
      isCameraEnabled: false,
      isScreenSharing: false,
    })

    expect(result[0]).toMatchObject({
      userId: 'remote-user',
      login: 'server-login',
      displayName: 'Server Alias',
    })
  })

  test('keeps the camera stream stable while speaking state changes', () => {
    const originalMediaStream = globalThis.MediaStream
    const cameraTrack = {
      enabled: true,
      kind: 'video',
      muted: false,
      readyState: 'live',
    } as MediaStreamTrack

    class FakeMediaStream {
      constructor(private readonly tracks: MediaStreamTrack[] = []) {}

      getVideoTracks() {
        return this.tracks.filter((track) => track.kind === 'video')
      }
    }

    Object.defineProperty(globalThis, 'MediaStream', {
      configurable: true,
      value: FakeMediaStream,
    })

    try {
      const remoteStream = new FakeMediaStream([
        cameraTrack,
      ]) as unknown as MediaStream
      const createCards = (isSpeaking: boolean) =>
        createVoiceParticipantCards({
          participants: [{ ...remoteParticipant, isCameraEnabled: true }],
          serverMembers: [],
          currentUserId: 'local-user',
          localParticipantId: 'local-user',
          localCameraPreviewStream: null,
          localScreenPreviewStream: null,
          remoteStreamsByParticipantId: { 'remote-user': remoteStream },
          peerStatusesByParticipantId: {},
          playbackStatesByParticipantId: {},
          speakingParticipantIds: isSpeaking ? { 'remote-user': true } : {},
          avatarAccentsByParticipantId: {},
          mediaTrackVersion: 0,
        })

      const silentCards = createCards(false)
      const speakingCards = createCards(true)

      expect(silentCards[0].isSpeaking).toBe(false)
      expect(speakingCards[0].isSpeaking).toBe(true)
      expect(speakingCards[0].participantStream).toBe(
        silentCards[0].participantStream,
      )
    } finally {
      if (originalMediaStream) {
        Object.defineProperty(globalThis, 'MediaStream', {
          configurable: true,
          value: originalMediaStream,
        })
      } else {
        Reflect.deleteProperty(globalThis, 'MediaStream')
      }
    }
  })

  test('keeps camera and screen receivers distinct when only screen is shared', () => {
    const cameraTrack = {
      enabled: true,
      kind: 'video',
      muted: true,
      readyState: 'live',
    } as MediaStreamTrack
    const screenTrack = {
      enabled: true,
      kind: 'video',
      muted: false,
      readyState: 'live',
    } as MediaStreamTrack
    registerVoiceVideoReceiverTrack(cameraTrack, 'camera')
    registerVoiceVideoReceiverTrack(screenTrack, 'screen')
    const stream = {
      getVideoTracks: () => [cameraTrack, screenTrack],
    } as MediaStream

    expect(
      selectParticipantVideoTracks(stream, {
        isCameraEnabled: false,
        isScreenSharing: true,
      }),
    ).toEqual({
      camera: null,
      screen: screenTrack,
    })
  })
})
