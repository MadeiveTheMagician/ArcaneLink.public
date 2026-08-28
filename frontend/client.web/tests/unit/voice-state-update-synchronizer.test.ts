import { expect, test } from '@playwright/test'
import {
  createVoiceStateUpdateSynchronizer,
  enqueueAcceptedVoiceGenerationState,
  type VoiceStateUpdateRequest,
} from '../../src/system/Server/hooks/voice/voiceStateUpdateSynchronizer'

const baseRequest: VoiceStateUpdateRequest = {
  participantId: 'participant-current',
  spaceId: 'space-current',
  isMuted: false,
  isDeafened: false,
  isCameraEnabled: false,
  isScreenSharing: false,
}

test.describe('voice state update synchronizer', () => {
  test('publishes the live state after a participant generation is accepted', () => {
    const enqueued: VoiceStateUpdateRequest[] = []
    let liveState = {
      isMuted: false,
      isDeafened: false,
      isCameraEnabled: false,
      isScreenSharing: false,
    }
    const getCurrentState = () => liveState
    liveState = {
      ...liveState,
      isMuted: true,
      isCameraEnabled: true,
      isScreenSharing: true,
    }

    enqueueAcceptedVoiceGenerationState(
      { enqueue: (request) => enqueued.push(request) },
      'participant-returned',
      'space-current',
      getCurrentState,
    )

    expect(enqueued).toEqual([{
      participantId: 'participant-returned',
      spaceId: 'space-current',
      ...liveState,
    }])
  })

  test('retries a transient failure and coalesces to the latest camera/screen state', async () => {
    const sent: VoiceStateUpdateRequest[] = []
    const scheduled: Array<() => void> = []
    let failNext = true
    const synchronizer = createVoiceStateUpdateSynchronizer({
      isCurrentGeneration: () => true,
      send: async (request) => {
        sent.push(request)
        if (failNext) {
          failNext = false
          throw new Error('temporary transport failure')
        }
      },
      schedule: (callback) => {
        scheduled.push(callback)
        return scheduled.length
      },
      cancel: () => undefined,
    })

    synchronizer.enqueue({ ...baseRequest, isCameraEnabled: true })
    await expect.poll(() => sent.length).toBe(1)
    synchronizer.enqueue({
      ...baseRequest,
      isCameraEnabled: true,
      isScreenSharing: true,
    })
    expect(scheduled).toHaveLength(1)
    scheduled.shift()?.()

    await expect.poll(() => sent.length).toBe(2)
    expect(sent[1]).toMatchObject({
      isCameraEnabled: true,
      isScreenSharing: true,
    })
    synchronizer.dispose()
  })

  test('drops a queued retry after the participant generation changes', async () => {
    const sent: VoiceStateUpdateRequest[] = []
    const scheduled: Array<() => void> = []
    let currentParticipantId = baseRequest.participantId
    const synchronizer = createVoiceStateUpdateSynchronizer({
      isCurrentGeneration: (request) =>
        request.participantId === currentParticipantId,
      send: async (request) => {
        sent.push(request)
        throw new Error('temporary transport failure')
      },
      schedule: (callback) => {
        scheduled.push(callback)
        return scheduled.length
      },
      cancel: () => undefined,
    })

    synchronizer.enqueue(baseRequest)
    await expect.poll(() => sent.length).toBe(1)
    currentParticipantId = 'participant-new'
    scheduled.shift()?.()
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0))

    expect(sent).toHaveLength(1)
    synchronizer.dispose()
  })
})
