import {
  applyAudioOutputDevice,
  combineVoicePlaybackVolume,
  listAvailableAudioOutputDevices
} from './audioOutput';
import type { VoiceSettings } from './voiceSettings';

export type VoiceConnectionCue = 'connected' | 'disconnected';

export type VoiceConnectionCuePlaybackConfig = {
  durationSeconds: number;
  fadeOutSeconds: number;
  sampleRateHz: number;
};

const voiceConnectionCueSampleRateHz = 48_000;
const voiceConnectionCueFadeOutSeconds = 0.08;

const voiceConnectionCueSampleUrls: Record<VoiceConnectionCue, string> = {
  connected: new URL('./samples/voice-connected.wav', import.meta.url).href,
  disconnected: new URL('./samples/voice-disconnected.wav', import.meta.url)
    .href
};

const voiceConnectionCuePlaybackConfigs: Record<
  VoiceConnectionCue,
  VoiceConnectionCuePlaybackConfig
> = {
  connected: {
    durationSeconds: 1.5300208333333334,
    fadeOutSeconds: voiceConnectionCueFadeOutSeconds,
    sampleRateHz: voiceConnectionCueSampleRateHz
  },
  disconnected: {
    durationSeconds: 1.2166666666666666,
    fadeOutSeconds: voiceConnectionCueFadeOutSeconds,
    sampleRateHz: voiceConnectionCueSampleRateHz
  }
};

type VoiceConnectionCuePlayerState = {
  activeAudio: HTMLAudioElement | null;
  activePlaybackGeneration: number | null;
  audios: Record<VoiceConnectionCue, HTMLAudioElement>;
  desiredVolume: number;
  hasUnlockedPlayback: boolean;
  requestedOutputDeviceId: string;
  routedOutputDeviceId: string | null;
  routingPromise: Promise<void> | null;
  unlockPromise: Promise<void> | null;
};

export function getVoiceConnectionCuePlaybackConfig(cue: VoiceConnectionCue) {
  return voiceConnectionCuePlaybackConfigs[cue];
}

export function createVoiceConnectionCuePlayer() {
  let state: VoiceConnectionCuePlayerState | null = null;
  let playbackGeneration = 0;

  function ensureState(settings: VoiceSettings) {
    state ??= createPlayerState();
    if (!state) return null;

    syncPlayerVolume(state, settings);
    return state;
  }

  function prime(settings: VoiceSettings) {
    const activeState = ensureState(settings);
    if (!activeState) return;

    try {
      for (const audio of Object.values(activeState.audios)) {
        audio.load();
      }
      unlockPlayerPlayback(activeState);
      void routePlayerOutput(activeState, settings.outputDeviceId);
    } catch {
      // Preloading is optional and must not interrupt a join action.
    }
  }

  async function play(cue: VoiceConnectionCue, settings: VoiceSettings) {
    const requestGeneration = ++playbackGeneration;
    const activeState = ensureState(settings);
    if (!activeState) return;

    try {
      await Promise.all([
        activeState.unlockPromise,
        routePlayerOutput(activeState, settings.outputDeviceId)
      ]);
      if (requestGeneration !== playbackGeneration || state !== activeState) {
        return;
      }

      stopActiveAudio(activeState);
      const audio = activeState.audios[cue];
      resetAudioPlayback(audio);
      activeState.activeAudio = audio;
      activeState.activePlaybackGeneration = requestGeneration;
      await audio.play();

      if (
        requestGeneration !== playbackGeneration ||
        state !== activeState ||
        activeState.activeAudio !== audio ||
        activeState.activePlaybackGeneration !== requestGeneration
      ) {
        if (activeState.activePlaybackGeneration === requestGeneration) {
          stopActiveAudio(activeState);
        }
      }
    } catch {
      if (activeState.activePlaybackGeneration === requestGeneration) {
        stopActiveAudio(activeState);
      }
      // Voice connection itself must never depend on an optional audio cue.
    }
  }

  function stop() {
    playbackGeneration += 1;
    if (state) {
      stopActiveAudio(state);
    }
  }

  async function dispose() {
    playbackGeneration += 1;
    const activeState = state;
    state = null;
    if (!activeState) return;

    stopActiveAudio(activeState);
    await Promise.all([
      activeState.routingPromise?.catch(() => undefined),
      activeState.unlockPromise?.catch(() => undefined)
    ]);
    for (const audio of Object.values(activeState.audios)) {
      audio.removeAttribute('src');
      audio.load();
    }
  }

  return { dispose, play, prime, stop };
}

function createPlayerState(): VoiceConnectionCuePlayerState | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  try {
    const state: VoiceConnectionCuePlayerState = {
      activeAudio: null,
      activePlaybackGeneration: null,
      audios: {
        connected: createCueAudio(voiceConnectionCueSampleUrls.connected),
        disconnected: createCueAudio(voiceConnectionCueSampleUrls.disconnected)
      },
      desiredVolume: 1,
      hasUnlockedPlayback: false,
      requestedOutputDeviceId: '',
      routedOutputDeviceId: null,
      routingPromise: null,
      unlockPromise: null
    };

    for (const audio of Object.values(state.audios)) {
      audio.addEventListener('ended', () => {
        if (state.activeAudio === audio) {
          state.activeAudio = null;
          state.activePlaybackGeneration = null;
        }
      });
    }

    return state;
  } catch {
    return null;
  }
}

function createCueAudio(sampleUrl: string) {
  const audio = document.createElement('audio');

  audio.preload = 'auto';
  audio.src = sampleUrl;
  audio.defaultPlaybackRate = 1;
  audio.playbackRate = 1;
  audio.preservesPitch = true;
  audio.setAttribute('playsinline', '');

  return audio;
}

function syncPlayerVolume(
  state: VoiceConnectionCuePlayerState,
  settings: VoiceSettings
) {
  const volume = combineVoicePlaybackVolume(settings.outputVolumePercent, 0.68);
  state.desiredVolume = volume;

  for (const audio of Object.values(state.audios)) {
    if (state.unlockPromise && audio === state.audios.connected) {
      continue;
    }
    audio.volume = state.desiredVolume;
  }
}

function unlockPlayerPlayback(state: VoiceConnectionCuePlayerState) {
  if (state.hasUnlockedPlayback || state.unlockPromise || state.activeAudio) {
    return;
  }

  const audio = state.audios.connected;
  resetAudioPlayback(audio);
  audio.volume = 0;
  const unlockPromise = audio
    .play()
    .then(() => {
      state.hasUnlockedPlayback = true;
    })
    .catch(() => undefined)
    .finally(() => {
      stopAudio(audio);
      audio.volume = state.desiredVolume;
      if (state.unlockPromise === unlockPromise) {
        state.unlockPromise = null;
      }
    });
  state.unlockPromise = unlockPromise;
}

function routePlayerOutput(
  state: VoiceConnectionCuePlayerState,
  outputDeviceId: string
) {
  state.requestedOutputDeviceId = outputDeviceId;
  if (state.routedOutputDeviceId === outputDeviceId && !state.routingPromise) {
    return Promise.resolve();
  }

  if (!state.routingPromise) {
    state.routingPromise = drainOutputRouting(state).finally(() => {
      state.routingPromise = null;
    });
  }

  return state.routingPromise;
}

async function drainOutputRouting(state: VoiceConnectionCuePlayerState) {
  while (state.routedOutputDeviceId !== state.requestedOutputDeviceId) {
    const targetOutputDeviceId = state.requestedOutputDeviceId;

    try {
      const devices = await listAvailableAudioOutputDevices();
      const selections = await Promise.all(
        Object.values(state.audios).map((audio) =>
          applyAudioOutputDevice(audio, targetOutputDeviceId, devices)
        )
      );
      if (selections.some((selection) => selection.didFallback)) {
        if (state.requestedOutputDeviceId !== targetOutputDeviceId) {
          continue;
        }
        return;
      }
      state.routedOutputDeviceId = targetOutputDeviceId;
    } catch {
      return;
    }
  }
}

function resetAudioPlayback(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
  audio.defaultPlaybackRate = 1;
  audio.playbackRate = 1;
  audio.preservesPitch = true;
}

function stopActiveAudio(state: VoiceConnectionCuePlayerState) {
  const activeAudio = state.activeAudio;
  state.activeAudio = null;
  state.activePlaybackGeneration = null;
  if (activeAudio) {
    stopAudio(activeAudio);
  }
}

function stopAudio(audio: HTMLAudioElement) {
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // A detached media element can already be unavailable during cleanup.
  }
}
