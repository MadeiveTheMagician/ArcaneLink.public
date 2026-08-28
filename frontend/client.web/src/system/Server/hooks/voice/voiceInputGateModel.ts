export type VoiceInputMode = 'voice-activity' | 'push-to-talk';

export type VoiceInputGateState = {
  isMuted: boolean;
  isDeafened: boolean;
  inputMode: VoiceInputMode;
  pushToTalkKeyCode: string | null;
  isPushToTalkPressed: boolean;
  isVoiceActive: boolean;
  isVoiceActivityAvailable: boolean;
};

export type SpeakingWhileMutedWarningState = {
  speakingSinceMs: number | null;
  lastWarningAtMs: number | null;
};

export type VoiceInputAvailabilityState = {
  unavailableSinceMs: number | null;
};

export type VoiceInputAvailabilityStatus =
  'available' | 'silent' | 'unavailable' | 'grace' | 'ignored';

export type VoiceInputVadAvailabilityState = {
  isAvailable: boolean;
  recoverySampleCount: number;
};

export type VoiceInputBackgroundState = {
  isPushToTalkPressed: boolean;
  isVoiceActive: boolean;
};

const speakingWhileMutedDelayMs = 1500;
const speakingWhileMutedCooldownMs = 30_000;
const inputUnavailableGraceMs = 8000;
export const voiceInputVadRecoverySampleCount = 6;

export function resolveVoiceInputGateOpen(state: VoiceInputGateState) {
  if (state.isMuted || state.isDeafened) {
    return false;
  }

  if (state.inputMode === 'push-to-talk') {
    if (!state.pushToTalkKeyCode) {
      return false;
    }

    return state.isPushToTalkPressed;
  }

  return state.isVoiceActivityAvailable ? state.isVoiceActive : true;
}

export function resolveVoiceInputBackgroundState(
  state: VoiceInputBackgroundState
): VoiceInputBackgroundState {
  return {
    isPushToTalkPressed: false,
    // Visibility releases a held PTT key. The hook treats background VAD as
    // unavailable (fail-open), while explicit mute/deafen remain authoritative.
    isVoiceActive: state.isVoiceActive
  };
}

export function resolveVoiceInputVadGateAvailable(options: {
  documentVisibility: DocumentVisibilityState;
  isAudioContextReady: boolean;
  isSignalAvailable: boolean;
}) {
  return (
    options.documentVisibility === 'visible' &&
    options.isAudioContextReady &&
    options.isSignalAvailable
  );
}

export function createVoiceInputVadAvailabilityState(): VoiceInputVadAvailabilityState {
  return {
    isAvailable: true,
    recoverySampleCount: 0
  };
}

export function updateVoiceInputVadAvailability(
  state: VoiceInputVadAvailabilityState,
  status: VoiceInputAvailabilityStatus
): VoiceInputVadAvailabilityState {
  if (status === 'silent' || status === 'unavailable') {
    return {
      isAvailable: false,
      recoverySampleCount: 0
    };
  }

  if (state.isAvailable) {
    return state;
  }

  if (status !== 'available') {
    return {
      isAvailable: false,
      recoverySampleCount: 0
    };
  }

  const recoverySampleCount = state.recoverySampleCount + 1;
  return recoverySampleCount >= voiceInputVadRecoverySampleCount
    ? {
        isAvailable: true,
        recoverySampleCount: 0
      }
    : {
        isAvailable: false,
        recoverySampleCount
      };
}

export function resolveToggledMuteState(state: {
  isMuted: boolean;
  isDeafened: boolean;
}) {
  return state.isMuted && state.isDeafened
    ? { isMuted: false, isDeafened: false }
    : {
        isMuted: !state.isMuted,
        isDeafened: state.isDeafened
      };
}

export function microphoneGainPercentToLinearGain(percent: number) {
  if (!Number.isFinite(percent)) {
    return 1;
  }

  return Math.min(2, Math.max(0, percent / 100));
}

export function isPushToTalkKeyEvent(
  event: Pick<KeyboardEvent, 'code' | 'repeat'> &
    Partial<
      Pick<
        KeyboardEvent,
        'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing'
      >
    >,
  keyCode: string
) {
  return (
    Boolean(keyCode) &&
    !event.repeat &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.isComposing &&
    event.code === keyCode
  );
}

export function createSpeakingWhileMutedWarningState(): SpeakingWhileMutedWarningState {
  return {
    speakingSinceMs: null,
    lastWarningAtMs: null
  };
}

export function updateVoiceInputAvailability(
  state: VoiceInputAvailabilityState,
  options: {
    nowMs: number;
    shouldObserve: boolean;
    isTrackLive: boolean;
    levelDb: number;
  }
) {
  const hasMeaningfulSignal = options.isTrackLive && options.levelDb > -90;
  if (hasMeaningfulSignal) {
    return {
      state: { unavailableSinceMs: null },
      status: 'available' as const
    };
  }
  if (!options.shouldObserve) {
    return {
      state: { unavailableSinceMs: null },
      status: 'ignored' as const
    };
  }

  const unavailableSinceMs = state.unavailableSinceMs ?? options.nowMs;
  return {
    state: { unavailableSinceMs },
    status:
      options.nowMs - unavailableSinceMs >= inputUnavailableGraceMs
        ? options.isTrackLive
          ? ('silent' as const)
          : ('unavailable' as const)
        : ('grace' as const)
  };
}

export function updateSpeakingWhileMutedWarning(
  state: SpeakingWhileMutedWarningState,
  options: {
    nowMs: number;
    isSpeaking: boolean;
    isOutboundBlocked: boolean;
    isEnabled: boolean;
  }
) {
  if (!options.isEnabled || !options.isSpeaking || !options.isOutboundBlocked) {
    return {
      state: {
        ...state,
        speakingSinceMs: null
      },
      shouldWarn: false
    };
  }

  const speakingSinceMs = state.speakingSinceMs ?? options.nowMs;
  const reachedDelay =
    options.nowMs - speakingSinceMs >= speakingWhileMutedDelayMs;
  const outsideCooldown =
    state.lastWarningAtMs === null ||
    options.nowMs - state.lastWarningAtMs >= speakingWhileMutedCooldownMs;

  if (!reachedDelay || !outsideCooldown) {
    return {
      state: {
        ...state,
        speakingSinceMs
      },
      shouldWarn: false
    };
  }

  return {
    state: {
      speakingSinceMs,
      lastWarningAtMs: options.nowMs
    },
    shouldWarn: true
  };
}
