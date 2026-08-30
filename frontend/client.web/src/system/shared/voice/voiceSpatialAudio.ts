import {
  clampVoiceParticipantVolume,
  defaultVoiceParticipantVolume
} from './voiceParticipantVolume';
import type { VoiceSpatialAudioMode } from './voiceSettings';

export { clampVoiceParticipantVolume } from './voiceParticipantVolume';

export type { VoiceSpatialAudioMode } from './voiceSettings';

export type VoiceSpatialAudioFallbackReason =
  | 'audio-context-unavailable'
  | 'media-stream-source-unavailable'
  | 'media-stream-destination-unavailable'
  | 'stereo-panner-unavailable'
  | 'panner-unavailable'
  | 'graph-creation-failed';

export type VoiceSpatialPosition = {
  pan: number;
  x: number;
  y: number;
  z: number;
};

export type VoiceSpatialAudioCapabilities = {
  audioContext: boolean;
  mediaStreamSource: boolean;
  mediaStreamDestination: boolean;
  stereoPanner: boolean;
  panner: boolean;
};

export type VoiceSpatialAudioTelemetry = {
  participantId: string;
  requestedMode: VoiceSpatialAudioMode;
  activeMode: VoiceSpatialAudioMode;
  status: 'active' | 'fallback' | 'disposed';
  fallbackReason: VoiceSpatialAudioFallbackReason | null;
  position: VoiceSpatialPosition;
  participantVolume: number;
  outputVolume: number;
  contextState: AudioContextState;
  outputLatencyMs: number | null;
};

export type VoiceSpatialAudioPath = {
  outputStream: MediaStream;
  setParticipantVolume: (volume: number) => void;
  setOutputVolume: (volume: number) => void;
  getTelemetry: () => VoiceSpatialAudioTelemetry;
  dispose: () => void;
};

export type VoiceSpatialAudioEngine = {
  capabilities: VoiceSpatialAudioCapabilities;
  attachParticipant: (
    participantId: string,
    stream: MediaStream,
    participantVolume?: number
  ) => VoiceSpatialAudioPath;
  resume: () => Promise<boolean>;
  dispose: () => void;
};

type AudioContextWithOutputLatency = AudioContext & {
  outputLatency?: number;
};

const singleParticipantPan = 0.32;
const balancedSpread = 0.72;
const singleParticipantAngle = Math.PI * 0.12;
const immersiveHalfArc = Math.PI * 0.36;

export function resolveVoiceSpatialPosition(
  participantId: string
): VoiceSpatialPosition {
  const normalizedParticipantId = participantId.trim().toLowerCase();
  const side = stableStringHash(normalizedParticipantId) % 2 === 0 ? -1 : 1;
  return createSpatialPosition(
    side * singleParticipantPan,
    side * singleParticipantAngle
  );
}

export function resolveVoiceSpatialLayout(participantIds: readonly string[]) {
  const normalizedParticipantIds = Array.from(
    new Set(
      participantIds
        .map((participantId) => participantId.trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort((left, right) => {
    const hashDifference = stableStringHash(left) - stableStringHash(right);
    return hashDifference || left.localeCompare(right);
  });
  const layout = new Map<string, VoiceSpatialPosition>();
  if (normalizedParticipantIds.length === 1) {
    const participantId = normalizedParticipantIds[0];
    layout.set(participantId, resolveVoiceSpatialPosition(participantId));
    return layout;
  }

  normalizedParticipantIds.forEach((participantId, index) => {
    const signedPosition =
      (index / Math.max(1, normalizedParticipantIds.length - 1)) * 2 - 1;
    layout.set(
      participantId,
      createSpatialPosition(
        signedPosition * balancedSpread,
        signedPosition * immersiveHalfArc
      )
    );
  });
  return layout;
}

function createSpatialPosition(pan: number, angle: number) {
  return {
    pan: roundPosition(pan),
    x: roundPosition(Math.sin(angle)),
    y: 0,
    z: roundPosition(-Math.cos(angle))
  };
}

export function detectVoiceSpatialAudioCapabilities(
  audioContext: AudioContext | null
): VoiceSpatialAudioCapabilities {
  return {
    audioContext: audioContext !== null,
    mediaStreamSource:
      typeof audioContext?.createMediaStreamSource === 'function',
    mediaStreamDestination:
      typeof audioContext?.createMediaStreamDestination === 'function',
    stereoPanner: typeof audioContext?.createStereoPanner === 'function',
    panner: typeof audioContext?.createPanner === 'function'
  };
}

export function resolveVoiceSpatialAudioMode(
  requestedMode: VoiceSpatialAudioMode,
  capabilities: VoiceSpatialAudioCapabilities
): {
  activeMode: VoiceSpatialAudioMode;
  fallbackReason: VoiceSpatialAudioFallbackReason | null;
} {
  if (!capabilities.audioContext) {
    return {
      activeMode: 'off',
      fallbackReason: 'audio-context-unavailable'
    };
  }
  if (!capabilities.mediaStreamSource) {
    return {
      activeMode: 'off',
      fallbackReason: 'media-stream-source-unavailable'
    };
  }
  if (!capabilities.mediaStreamDestination) {
    return {
      activeMode: 'off',
      fallbackReason: 'media-stream-destination-unavailable'
    };
  }
  if (requestedMode === 'balanced' && !capabilities.stereoPanner) {
    return {
      activeMode: 'off',
      fallbackReason: 'stereo-panner-unavailable'
    };
  }
  if (requestedMode === 'immersive' && !capabilities.panner) {
    return {
      activeMode: 'off',
      fallbackReason: 'panner-unavailable'
    };
  }

  return { activeMode: requestedMode, fallbackReason: null };
}

export function createVoiceSpatialAudioEngine(
  requestedMode: VoiceSpatialAudioMode,
  createAudioContext: (() => AudioContext) | null = resolveAudioContextFactory()
): VoiceSpatialAudioEngine | null {
  return createVoiceAudioEngine(requestedMode, false, createAudioContext);
}

export function createVoicePlaybackAudioEngine(
  requestedMode: VoiceSpatialAudioMode,
  participantGainRequired: boolean,
  createAudioContext: (() => AudioContext) | null = resolveAudioContextFactory()
): VoiceSpatialAudioEngine | null {
  return createVoiceAudioEngine(
    requestedMode,
    participantGainRequired,
    createAudioContext
  );
}

function createVoiceAudioEngine(
  requestedMode: VoiceSpatialAudioMode,
  participantGainRequired: boolean,
  createAudioContext: (() => AudioContext) | null
): VoiceSpatialAudioEngine | null {
  // Keep the ordinary off-mode path on the native media element. An extra
  // AudioContext can remain suspended under mobile autoplay policies. Web
  // Audio is only required here when a participant is boosted above 100%.
  if (requestedMode === 'off' && !participantGainRequired) {
    return null;
  }

  if (!createAudioContext) {
    return null;
  }

  let audioContext: AudioContext;
  try {
    audioContext = createAudioContext();
  } catch {
    return null;
  }

  const capabilities = detectVoiceSpatialAudioCapabilities(audioContext);
  const modeResolution = resolveVoiceSpatialAudioMode(
    requestedMode,
    capabilities
  );
  const activePaths = new Map<
    VoiceSpatialAudioPath,
    {
      participantId: string;
      setPosition: (position: VoiceSpatialPosition) => void;
    }
  >();
  let isDisposed = false;

  function rebalanceSpatialPaths() {
    if (isDisposed || activePaths.size === 0) {
      return;
    }

    const layout = resolveVoiceSpatialLayout(
      Array.from(activePaths.values(), (entry) => entry.participantId)
    );
    activePaths.forEach((entry) => {
      entry.setPosition(
        layout.get(entry.participantId) ??
          resolveVoiceSpatialPosition(entry.participantId)
      );
    });
  }

  function attachParticipant(
    participantId: string,
    stream: MediaStream,
    participantVolume = defaultVoiceParticipantVolume
  ): VoiceSpatialAudioPath {
    if (isDisposed || audioContext.state === 'closed') {
      throw new Error('The spatial audio engine has already been disposed.');
    }

    const source = audioContext.createMediaStreamSource(stream);
    const participantGain = audioContext.createGain();
    const limiter = createVoicePlaybackLimiter(audioContext);
    const outputGain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();
    let position = resolveVoiceSpatialPosition(participantId);
    let activeMode = modeResolution.activeMode;
    let fallbackReason = modeResolution.fallbackReason;
    let graph: ReturnType<typeof createSpatialGraph>;
    try {
      graph = createSpatialGraph(audioContext, activeMode, position);
    } catch {
      activeMode = 'off';
      fallbackReason = 'graph-creation-failed';
      graph = { node: null, setPosition: () => undefined };
    }
    let normalizedVolume = clampVoiceParticipantVolume(participantVolume);
    let normalizedOutputVolume = 1;
    let status: VoiceSpatialAudioTelemetry['status'] = fallbackReason
      ? 'fallback'
      : 'active';
    let isPathDisposed = false;

    // Remote microphone tracks can arrive as mono or duplicated stereo,
    // depending on the sender pipeline and negotiated Opus parameters. Downmix
    // them to one channel before panning so StereoPanner and HRTF both position
    // the voice as a single point source.
    participantGain.channelCount = 1;
    participantGain.channelCountMode = 'explicit';
    participantGain.channelInterpretation = 'speakers';
    participantGain.gain.value = normalizedVolume;
    setVoicePlaybackLimiterThreshold(
      limiter,
      normalizedVolume,
      audioContext.currentTime
    );
    outputGain.gain.value = normalizedOutputVolume;
    source.connect(participantGain);
    if (graph.node) {
      participantGain.connect(graph.node);
      graph.node.connect(limiter);
    } else {
      participantGain.connect(limiter);
    }
    limiter.connect(outputGain);
    outputGain.connect(destination);

    const path: VoiceSpatialAudioPath = {
      outputStream: destination.stream,
      setParticipantVolume(volume) {
        if (isPathDisposed) {
          return;
        }

        normalizedVolume = clampVoiceParticipantVolume(volume);
        const now = audioContext.currentTime;
        participantGain.gain.cancelScheduledValues(now);
        participantGain.gain.setTargetAtTime(normalizedVolume, now, 0.012);
        setVoicePlaybackLimiterThreshold(limiter, normalizedVolume, now);
      },
      setOutputVolume(volume) {
        if (isPathDisposed) {
          return;
        }

        normalizedOutputVolume = clampUnitGain(volume);
        const now = audioContext.currentTime;
        outputGain.gain.cancelScheduledValues(now);
        outputGain.gain.setTargetAtTime(normalizedOutputVolume, now, 0.012);
      },
      getTelemetry() {
        return {
          participantId,
          requestedMode,
          activeMode,
          status,
          fallbackReason,
          position,
          participantVolume: normalizedVolume,
          outputVolume: normalizedOutputVolume,
          contextState: audioContext.state,
          outputLatencyMs: resolveAudioContextOutputLatencyMs(audioContext)
        };
      },
      dispose() {
        if (isPathDisposed) {
          return;
        }

        isPathDisposed = true;
        status = 'disposed';
        activePaths.delete(path);
        source.disconnect();
        participantGain.disconnect();
        graph.node?.disconnect();
        limiter.disconnect();
        outputGain.disconnect();
        destination.disconnect();
        destination.stream.getTracks().forEach((track) => track.stop());
        rebalanceSpatialPaths();
      }
    };

    const normalizedParticipantId = participantId.trim().toLowerCase();
    activePaths.set(path, {
      participantId: normalizedParticipantId,
      setPosition(nextPosition) {
        position = nextPosition;
        graph.setPosition(nextPosition);
      }
    });
    rebalanceSpatialPaths();
    return path;
  }

  return {
    capabilities,
    attachParticipant,
    async resume() {
      if (isDisposed || audioContext.state === 'closed') {
        return false;
      }
      if (audioContext.state === 'running') {
        return true;
      }

      try {
        await audioContext.resume();
      } catch {
        return false;
      }

      return (audioContext.state as AudioContextState) === 'running';
    },
    dispose() {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      Array.from(activePaths.keys()).forEach((path) => path.dispose());
      void audioContext.close();
    }
  };
}

function createVoicePlaybackLimiter(audioContext: AudioContext) {
  const limiter = audioContext.createDynamicsCompressor();
  limiter.threshold.value = 0;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.18;
  return limiter;
}

function setVoicePlaybackLimiterThreshold(
  limiter: DynamicsCompressorNode,
  participantVolume: number,
  now: number
) {
  // At normal volume the limiter is effectively transparent. Boosted voices
  // get peak protection to reduce hard clipping at the 400% upper range.
  const threshold = participantVolume > 1 ? -3 : 0;
  limiter.threshold.cancelScheduledValues(now);
  limiter.threshold.setTargetAtTime(threshold, now, 0.012);
}

function createSpatialGraph(
  audioContext: AudioContext,
  mode: VoiceSpatialAudioMode,
  position: VoiceSpatialPosition
): {
  node: StereoPannerNode | PannerNode | null;
  setPosition: (position: VoiceSpatialPosition) => void;
} {
  if (mode === 'balanced') {
    const panner = audioContext.createStereoPanner();
    const setPosition = (nextPosition: VoiceSpatialPosition) => {
      const now = audioContext.currentTime;
      panner.pan.cancelScheduledValues(now);
      panner.pan.setTargetAtTime(nextPosition.pan, now, 0.04);
    };
    setPosition(position);
    return { node: panner, setPosition };
  }

  if (mode === 'immersive') {
    const panner = audioContext.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10_000;
    panner.rolloffFactor = 0;
    const setPosition = (nextPosition: VoiceSpatialPosition) =>
      setPannerPosition(panner, nextPosition, audioContext.currentTime);
    setPosition(position);
    return { node: panner, setPosition };
  }

  return { node: null, setPosition: () => undefined };
}

function setPannerPosition(
  panner: PannerNode,
  position: VoiceSpatialPosition,
  now: number
) {
  const modernPanner = panner as PannerNode & {
    positionX?: AudioParam;
    positionY?: AudioParam;
    positionZ?: AudioParam;
  };
  if (
    modernPanner.positionX &&
    modernPanner.positionY &&
    modernPanner.positionZ
  ) {
    modernPanner.positionX.setValueAtTime(position.x, now);
    modernPanner.positionY.setValueAtTime(position.y, now);
    modernPanner.positionZ.setValueAtTime(position.z, now);
    return;
  }

  const legacyPanner = panner as unknown as {
    setPosition: (x: number, y: number, z: number) => void;
  };
  legacyPanner.setPosition(position.x, position.y, position.z);
}

function resolveAudioContextFactory(): (() => AudioContext) | null {
  if (typeof AudioContext === 'undefined') {
    return null;
  }

  return () => new AudioContext();
}

function resolveAudioContextOutputLatencyMs(audioContext: AudioContext) {
  const context = audioContext as AudioContextWithOutputLatency;
  const latencySeconds =
    finiteNonNegative(context.baseLatency) +
    finiteNonNegative(context.outputLatency);

  return latencySeconds > 0 ? Math.round(latencySeconds * 1000) : null;
}

function finiteNonNegative(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function clampUnitGain(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

function stableStringHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function roundPosition(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
