import { expect, test } from '@playwright/test'
import {
  createSpeakingWhileMutedWarningState,
  createVoiceInputVadAvailabilityState,
  isPushToTalkKeyEvent,
  microphoneGainPercentToLinearGain,
  resolveToggledMuteState,
  resolveVoiceInputBackgroundState,
  resolveVoiceInputGateOpen,
  resolveVoiceInputVadGateAvailable,
  updateVoiceInputVadAvailability,
  updateVoiceInputAvailability,
  updateSpeakingWhileMutedWarning,
  voiceInputVadRecoverySampleCount,
} from '../../src/system/Server/hooks/voice/voiceInputGateModel'

test.describe('voice input gate model', () => {
  test('keeps mute and deafen authoritative for every input mode', () => {
    expect(
      resolveVoiceInputGateOpen({
        isMuted: true,
        isDeafened: false,
        inputMode: 'push-to-talk',
        pushToTalkKeyCode: 'KeyV',
        isPushToTalkPressed: true,
        isVoiceActive: true,
        isVoiceActivityAvailable: true,
      }),
    ).toBe(false)
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: true,
        inputMode: 'voice-activity',
        pushToTalkKeyCode: null,
        isPushToTalkPressed: false,
        isVoiceActive: true,
        isVoiceActivityAvailable: true,
      }),
    ).toBe(false)
  })

  test('gates voice activity by threshold while push-to-talk stays explicit', () => {
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'voice-activity',
        pushToTalkKeyCode: null,
        isPushToTalkPressed: false,
        isVoiceActive: true,
        isVoiceActivityAvailable: true,
      }),
    ).toBe(true)
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'voice-activity',
        pushToTalkKeyCode: null,
        isPushToTalkPressed: false,
        isVoiceActive: false,
        isVoiceActivityAvailable: true,
      }),
    ).toBe(false)
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'push-to-talk',
        pushToTalkKeyCode: 'KeyV',
        isPushToTalkPressed: false,
        isVoiceActive: true,
        isVoiceActivityAvailable: true,
      }),
    ).toBe(false)
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'push-to-talk',
        pushToTalkKeyCode: 'KeyV',
        isPushToTalkPressed: true,
        isVoiceActive: false,
        isVoiceActivityAvailable: true,
      }),
    ).toBe(true)
  })

  test('keeps voice activity transmitting in background while releasing push-to-talk', () => {
    const backgroundState = resolveVoiceInputBackgroundState({
      isPushToTalkPressed: true,
      isVoiceActive: true,
    })

    expect(backgroundState).toEqual({
      isPushToTalkPressed: false,
      isVoiceActive: true,
    })
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'voice-activity',
        pushToTalkKeyCode: null,
        isPushToTalkPressed: backgroundState.isPushToTalkPressed,
        isVoiceActive: backgroundState.isVoiceActive,
        isVoiceActivityAvailable: true,
      }),
    ).toBe(true)
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'push-to-talk',
        pushToTalkKeyCode: 'KeyV',
        isPushToTalkPressed: backgroundState.isPushToTalkPressed,
        isVoiceActive: backgroundState.isVoiceActive,
        isVoiceActivityAvailable: true,
      }),
    ).toBe(false)
    expect(
      resolveVoiceInputGateOpen({
        isMuted: true,
        isDeafened: false,
        inputMode: 'voice-activity',
        pushToTalkKeyCode: null,
        isPushToTalkPressed: backgroundState.isPushToTalkPressed,
        isVoiceActive: backgroundState.isVoiceActive,
        isVoiceActivityAvailable: true,
      }),
    ).toBe(false)
    expect(
      resolveVoiceInputVadGateAvailable({
        documentVisibility: 'hidden',
        isAudioContextReady: true,
        isSignalAvailable: true,
      }),
    ).toBe(false)
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'voice-activity',
        pushToTalkKeyCode: null,
        isPushToTalkPressed: false,
        isVoiceActive: false,
        isVoiceActivityAvailable: false,
      }),
    ).toBe(true)
  })

  test('fails VAD open after confirmed input loss and restores it after stable samples', () => {
    let availability = updateVoiceInputVadAvailability(
      createVoiceInputVadAvailabilityState(),
      'silent',
    )

    expect(availability).toEqual({
      isAvailable: false,
      recoverySampleCount: 0,
    })
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'voice-activity',
        pushToTalkKeyCode: null,
        isPushToTalkPressed: false,
        isVoiceActive: false,
        isVoiceActivityAvailable: availability.isAvailable,
      }),
    ).toBe(true)

    for (let index = 1; index < voiceInputVadRecoverySampleCount; index += 1) {
      availability = updateVoiceInputVadAvailability(
        availability,
        'available',
      )
      expect(availability.isAvailable).toBe(false)
    }
    availability = updateVoiceInputVadAvailability(availability, 'grace')
    expect(availability.recoverySampleCount).toBe(0)

    for (let index = 0; index < voiceInputVadRecoverySampleCount; index += 1) {
      availability = updateVoiceInputVadAvailability(
        availability,
        'available',
      )
    }
    expect(availability).toEqual({
      isAvailable: true,
      recoverySampleCount: 0,
    })
  })

  test('keeps mute, deafen, and push-to-talk authoritative during VAD fail-open', () => {
    const unavailable = updateVoiceInputVadAvailability(
      createVoiceInputVadAvailabilityState(),
      'unavailable',
    )
    const commonState = {
      pushToTalkKeyCode: null,
      isPushToTalkPressed: false,
      isVoiceActive: false,
      isVoiceActivityAvailable: unavailable.isAvailable,
    }

    expect(
      resolveVoiceInputGateOpen({
        ...commonState,
        isMuted: true,
        isDeafened: false,
        inputMode: 'voice-activity',
      }),
    ).toBe(false)
    expect(
      resolveVoiceInputGateOpen({
        ...commonState,
        isMuted: false,
        isDeafened: true,
        inputMode: 'voice-activity',
      }),
    ).toBe(false)
    expect(
      resolveVoiceInputGateOpen({
        ...commonState,
        isMuted: false,
        isDeafened: false,
        inputMode: 'push-to-talk',
        pushToTalkKeyCode: 'KeyV',
      }),
    ).toBe(false)
  })

  test('fails closed when push-to-talk has no configured key', () => {
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'push-to-talk',
        pushToTalkKeyCode: null,
        isPushToTalkPressed: false,
        isVoiceActive: true,
        isVoiceActivityAvailable: true,
      }),
    ).toBe(false)
  })

  test('fails open only for unmuted voice activity when its analyser is blocked', () => {
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'voice-activity',
        pushToTalkKeyCode: null,
        isPushToTalkPressed: false,
        isVoiceActive: false,
        isVoiceActivityAvailable: false,
      }),
    ).toBe(true)
    expect(
      resolveVoiceInputGateOpen({
        isMuted: true,
        isDeafened: false,
        inputMode: 'voice-activity',
        pushToTalkKeyCode: null,
        isPushToTalkPressed: false,
        isVoiceActive: false,
        isVoiceActivityAvailable: false,
      }),
    ).toBe(false)
    expect(
      resolveVoiceInputGateOpen({
        isMuted: false,
        isDeafened: false,
        inputMode: 'push-to-talk',
        pushToTalkKeyCode: 'KeyV',
        isPushToTalkPressed: false,
        isVoiceActive: false,
        isVoiceActivityAvailable: false,
      }),
    ).toBe(false)
  })

  test('atomically removes deafen when the microphone is enabled', () => {
    expect(
      resolveToggledMuteState({ isMuted: true, isDeafened: true }),
    ).toEqual({ isMuted: false, isDeafened: false })
    expect(
      resolveToggledMuteState({ isMuted: false, isDeafened: false }),
    ).toEqual({ isMuted: true, isDeafened: false })
  })

  test('normalizes digital microphone gain and physical key matching', () => {
    expect(microphoneGainPercentToLinearGain(100)).toBe(1)
    expect(microphoneGainPercentToLinearGain(250)).toBe(2)
    expect(microphoneGainPercentToLinearGain(-10)).toBe(0)
    expect(
      isPushToTalkKeyEvent({ code: 'KeyV', repeat: false }, 'KeyV'),
    ).toBe(true)
    expect(
      isPushToTalkKeyEvent({ code: 'KeyV', repeat: true }, 'KeyV'),
    ).toBe(false)
    expect(
      isPushToTalkKeyEvent(
        { code: 'KeyV', repeat: false, ctrlKey: true },
        'KeyV',
      ),
    ).toBe(false)
    expect(
      isPushToTalkKeyEvent(
        { code: 'KeyV', repeat: false, isComposing: true },
        'KeyV',
      ),
    ).toBe(false)
  })

  test('debounces and rate-limits speaking while muted warnings', () => {
    let state = createSpeakingWhileMutedWarningState()
    let result = updateSpeakingWhileMutedWarning(state, {
      nowMs: 0,
      isSpeaking: true,
      isOutboundBlocked: true,
      isEnabled: true,
    })
    state = result.state
    expect(result.shouldWarn).toBe(false)

    result = updateSpeakingWhileMutedWarning(state, {
      nowMs: 1500,
      isSpeaking: true,
      isOutboundBlocked: true,
      isEnabled: true,
    })
    state = result.state
    expect(result.shouldWarn).toBe(true)

    result = updateSpeakingWhileMutedWarning(state, {
      nowMs: 5000,
      isSpeaking: true,
      isOutboundBlocked: true,
      isEnabled: true,
    })
    expect(result.shouldWarn).toBe(false)
  })

  test('debounces unavailable input and resets after signal recovery', () => {
    let result = updateVoiceInputAvailability(
      { unavailableSinceMs: null },
      {
        nowMs: 1000,
        shouldObserve: true,
        isTrackLive: false,
        levelDb: -100,
      },
    )
    expect(result.status).toBe('grace')

    result = updateVoiceInputAvailability(result.state, {
      nowMs: 8999,
      shouldObserve: true,
      isTrackLive: true,
      levelDb: -95,
    })
    expect(result.status).toBe('grace')

    result = updateVoiceInputAvailability(result.state, {
      nowMs: 9000,
      shouldObserve: true,
      isTrackLive: true,
      levelDb: -95,
    })
    expect(result.status).toBe('silent')

    result = updateVoiceInputAvailability(result.state, {
      nowMs: 20_000,
      shouldObserve: true,
      isTrackLive: false,
      levelDb: -100,
    })
    expect(result.status).toBe('unavailable')

    result = updateVoiceInputAvailability(result.state, {
      nowMs: 9100,
      shouldObserve: true,
      isTrackLive: true,
      levelDb: -45,
    })
    expect(result.status).toBe('available')
    expect(result.state.unavailableSinceMs).toBeNull()
  })

  test('ignores intentional capture suspension while warnings are disabled', () => {
    const result = updateVoiceInputAvailability(
      { unavailableSinceMs: 1000 },
      {
        nowMs: 20_000,
        shouldObserve: false,
        isTrackLive: false,
        levelDb: -100,
      },
    )

    expect(result.status).toBe('ignored')
    expect(result.state.unavailableSinceMs).toBeNull()
  })
})
