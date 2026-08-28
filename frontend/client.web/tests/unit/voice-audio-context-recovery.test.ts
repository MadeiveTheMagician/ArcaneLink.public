import { expect, test } from '@playwright/test'
import {
  resolveVoiceAudioContext,
  resumeVoiceAudioContext,
} from '../../src/system/Server/hooks/voice/voiceAudioContextRecovery'
import type { ResumableVoiceAudioContext } from '../../src/system/Server/hooks/voice/voiceAudioContextRecovery'

function createContext(
  state: AudioContextState,
  resume: () => Promise<void> = async () => undefined,
): ResumableVoiceAudioContext {
  return { state, resume }
}

test.describe('voice audio context recovery', () => {
  test('resumes a suspended context and observes the resulting state', async () => {
    let state: AudioContextState = 'suspended'
    let resumeCalls = 0
    const context: ResumableVoiceAudioContext = {
      get state() {
        return state
      },
      async resume() {
        resumeCalls += 1
        state = 'running'
      },
    }

    await expect(resumeVoiceAudioContext(context)).resolves.toBe(true)
    expect(resumeCalls).toBe(1)
  })

  test('reports blocked and closed contexts without throwing', async () => {
    const blocked = createContext('suspended', async () => {
      throw new DOMException('Gesture required', 'NotAllowedError')
    })
    let closedResumeCalls = 0
    const closed = createContext('closed', async () => {
      closedResumeCalls += 1
    })

    await expect(resumeVoiceAudioContext(blocked)).resolves.toBe(false)
    await expect(resumeVoiceAudioContext(closed)).resolves.toBe(false)
    expect(closedResumeCalls).toBe(0)
  })

  test('reuses a live context and replaces a closed one', () => {
    const running = createContext('running')
    const closed = createContext('closed')
    const replacement = createContext('suspended')
    let createCalls = 0
    const createReplacement = () => {
      createCalls += 1
      return replacement
    }

    expect(resolveVoiceAudioContext(running, createReplacement)).toBe(running)
    expect(createCalls).toBe(0)
    expect(resolveVoiceAudioContext(closed, createReplacement)).toBe(
      replacement,
    )
    expect(createCalls).toBe(1)
  })
})
