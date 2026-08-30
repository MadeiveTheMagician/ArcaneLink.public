import {
  applyAudioOutputDevice,
  combineVoicePlaybackVolume,
  listAvailableAudioOutputDevices
} from './audioOutput';
import type { VoiceSettings } from './voiceSettings';

export type PrivateCallAudioMode = 'incoming' | 'outgoing';

type PlayerState = {
  activeMode: PrivateCallAudioMode | null;
  audios: Record<PrivateCallAudioMode, HTMLAudioElement>;
  urls: string[];
};

export function createPrivateCallRingtonePlayer() {
  let state: PlayerState | null = null;
  let playbackGeneration = 0;

  function ensureState() {
    if (state || typeof document === 'undefined') return state;
    const incoming = createCadenceAudio('incoming');
    const outgoing = createCadenceAudio('outgoing');
    state = {
      activeMode: null,
      audios: { incoming: incoming.audio, outgoing: outgoing.audio },
      urls: [incoming.url, outgoing.url]
    };
    return state;
  }

  function prime(settings: VoiceSettings) {
    const activeState = ensureState();
    if (!activeState) return;
    for (const audio of Object.values(activeState.audios)) {
      const desiredVolume = resolveVolume(settings);
      audio.volume = 0;
      audio.muted = true;
      const unlockPromise = audio.play();
      void Promise.all([unlockPromise, routeAudio(audio, settings, 0)])
        .then(() => {
          const activeAudio = activeState.activeMode
            ? activeState.audios[activeState.activeMode]
            : null;
          if (audio !== activeAudio) {
            audio.pause();
            audio.currentTime = 0;
          }
          audio.muted = false;
          audio.volume = desiredVolume;
        })
        .catch(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = desiredVolume;
        });
    }
  }

  async function play(mode: PrivateCallAudioMode, settings: VoiceSettings) {
    const generation = ++playbackGeneration;
    const activeState = ensureState();
    if (!activeState) return;
    const audio = activeState.audios[mode];
    await routeAudio(audio, settings);
    if (generation !== playbackGeneration || state !== activeState) return;
    if (activeState.activeMode === mode && !audio.paused) return;
    try {
      stopActive(activeState);
      activeState.activeMode = mode;
      audio.currentTime = 0;
      await audio.play();
    } catch {
      // Autoplay may be blocked; the persistent call card remains functional.
    }
  }

  function stop() {
    playbackGeneration += 1;
    if (state) stopActive(state);
  }

  function dispose() {
    playbackGeneration += 1;
    const activeState = state;
    state = null;
    if (!activeState) return;
    stopActive(activeState);
    for (const audio of Object.values(activeState.audios)) {
      audio.removeAttribute('src');
      audio.load();
    }
    for (const url of activeState.urls) URL.revokeObjectURL(url);
  }

  return { dispose, play, prime, stop };
}

async function routeAudio(
  audio: HTMLAudioElement,
  settings: VoiceSettings,
  volume = resolveVolume(settings)
) {
  audio.volume = volume;
  try {
    const devices = await listAvailableAudioOutputDevices();
    await applyAudioOutputDevice(audio, settings.outputDeviceId, devices);
  } catch {
    // The browser default remains the graceful fallback output.
  }
}

function resolveVolume(settings: VoiceSettings) {
  return combineVoicePlaybackVolume(settings.outputVolumePercent, 0.72);
}

function stopActive(state: PlayerState) {
  const mode = state.activeMode;
  state.activeMode = null;
  if (!mode) return;
  const audio = state.audios[mode];
  audio.pause();
  audio.currentTime = 0;
}

function createCadenceAudio(mode: PrivateCallAudioMode) {
  const url = URL.createObjectURL(createCadenceWave(mode));
  const audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.loop = true;
  audio.src = url;
  audio.setAttribute('playsinline', '');
  return { audio, url };
}

function createCadenceWave(mode: PrivateCallAudioMode) {
  const sampleRate = 24_000;
  const durationSeconds = mode === 'incoming' ? 4.2 : 3.6;
  const sampleCount = Math.round(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  writeWaveHeader(view, sampleRate, sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const sample =
      mode === 'incoming'
        ? createIncomingRingtoneSample(time)
        : createOutgoingRingbackSample(time);
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function createIncomingRingtoneSample(time: number) {
  // A quiet descending two-note phrase is easier to listen to than two
  // simultaneous high tones. Most of the loop remains silent so an unanswered
  // call still attracts attention without producing a continuous alarm.
  return (
    createSoftNote(time, 0, 0.32, 392) +
    createSoftNote(time, 0.48, 0.36, 329.63)
  );
}

function createSoftNote(
  time: number,
  start: number,
  duration: number,
  frequency: number
) {
  const elapsed = time - start;
  if (elapsed < 0 || elapsed >= duration) return 0;

  const attack = smoothFade(Math.min(1, elapsed / 0.045));
  const release = smoothFade(Math.min(1, (duration - elapsed) / 0.12));
  const fundamental = Math.sin(2 * Math.PI * frequency * elapsed) * 0.13;
  const softHarmonic = Math.sin(4 * Math.PI * frequency * elapsed) * 0.01;
  return (fundamental + softHarmonic) * attack * release;
}

function smoothFade(progress: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * progress);
}

function createOutgoingRingbackSample(time: number) {
  if (time >= 1.05) return 0;
  const envelope = Math.min(1, time / 0.012, (1.05 - time) / 0.025);
  return Math.sin(2 * Math.PI * 425 * time) * 0.3 * envelope;
}

function writeWaveHeader(
  view: DataView,
  sampleRate: number,
  sampleCount: number
) {
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, sampleCount * 2, true);
}
