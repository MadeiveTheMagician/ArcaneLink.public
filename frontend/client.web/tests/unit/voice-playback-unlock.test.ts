import { expect, test } from '@playwright/test'
import {
  requestVoicePlaybackUnlock,
  subscribeVoicePlaybackUnlock,
} from '../../src/system/shared/voice/voicePlaybackUnlock'

test.describe('voice playback unlock', () => {
  test('notifies a mounted subscriber and stops after cleanup', () => {
    const target = new EventTarget()
    let unlockCount = 0
    const unsubscribe = subscribeVoicePlaybackUnlock(
      () => {
        unlockCount += 1
      },
      target,
    )

    requestVoicePlaybackUnlock(target)
    expect(unlockCount).toBe(1)

    unsubscribe()
    requestVoicePlaybackUnlock(target)
    expect(unlockCount).toBe(1)
  })
})
