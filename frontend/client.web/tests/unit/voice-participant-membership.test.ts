import { expect, test } from '@playwright/test'

import type { VoiceParticipant } from '../../src/system/Server/hooks/voice/voiceChannelTypes'
import { isLocalVoiceParticipant } from '../../src/system/Server/hooks/voice/voiceParticipantMembershipModel'

const participant: VoiceParticipant = {
  participantId: 'participant-tab-a',
  userId: 'user-1',
  login: 'user-1',
  displayName: 'User 1',
  isMuted: false,
  isDeafened: false,
  isCameraEnabled: false,
  isScreenSharing: false,
}

test.describe('voice participant membership', () => {
  test('keeps the same account visible in a passive browser tab', () => {
    expect(
      isLocalVoiceParticipant({
        participant,
        currentUserId: participant.userId,
        localParticipantId: null,
        hasConnectedChannel: false,
      }),
    ).toBe(false)
  })

  test('uses the user id while the current tab is still joining', () => {
    expect(
      isLocalVoiceParticipant({
        participant,
        currentUserId: participant.userId,
        localParticipantId: null,
        hasConnectedChannel: true,
      }),
    ).toBe(true)
  })

  test('uses the connection participant id after joining', () => {
    expect(
      isLocalVoiceParticipant({
        participant,
        currentUserId: participant.userId,
        localParticipantId: participant.participantId,
        hasConnectedChannel: true,
      }),
    ).toBe(true)

    expect(
      isLocalVoiceParticipant({
        participant,
        currentUserId: participant.userId,
        localParticipantId: 'participant-tab-b',
        hasConnectedChannel: true,
      }),
    ).toBe(false)
  })
})
