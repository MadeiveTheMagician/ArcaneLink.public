export type VoiceNoiseSuppressionRequestedMode = 'disabled' | 'native' | 'ml';

export type VoiceNoiseSuppressionActiveMode = 'disabled' | 'native' | 'ml';

export type VoiceNoiseSuppressionLifecycle =
  | 'disabled'
  | 'native'
  | 'initializing'
  | 'active'
  | 'fallback'
  | 'failed'
  | 'disposed';

export type VoiceNoiseSuppressionHealth =
  'unavailable' | 'initializing' | 'healthy' | 'degraded' | 'failed';

export type VoiceNoiseSuppressionFallbackReason =
  | 'disabled-by-settings'
  | 'native-noise-suppression-unavailable'
  | 'provider-unavailable'
  | 'webassembly-unavailable'
  | 'audio-worklet-unavailable'
  | 'worker-unavailable'
  | 'message-channel-unavailable'
  | 'unsupported-sample-rate'
  | 'initialization-timeout'
  | 'processor-error'
  | 'provider-initialization-failed';

export type VoiceNoiseSuppressionTelemetry = {
  requestedMode: VoiceNoiseSuppressionRequestedMode;
  activeMode: VoiceNoiseSuppressionActiveMode;
  lifecycle: VoiceNoiseSuppressionLifecycle;
  health: VoiceNoiseSuppressionHealth;
  providerId: string | null;
  fallbackReason: VoiceNoiseSuppressionFallbackReason | null;
  latencyMs: number | null;
  averageProcessingTimeMs: number | null;
  cpuLoadPercent: number | null;
  processedFrames: number;
  droppedFrames: number;
  outputUnderruns: number;
  sampledAtMs: number;
};

export type VoiceNoiseSuppressionProcessorSample = {
  averageProcessingTimeMs?: unknown;
  frameDurationMs?: unknown;
  algorithmicLatencyMs?: unknown;
  processedFrames?: unknown;
  droppedFrames?: unknown;
  outputUnderruns?: unknown;
};

export type VoiceNoiseSuppressionSupportEnvironment = {
  webAssembly: boolean;
  audioWorklet: boolean;
  audioWorkletNode: boolean;
  worker: boolean;
  messageChannel: boolean;
  sampleRate: number;
};

export function resolveVoiceNoiseSuppressionRequest({
  mlNoiseSuppression,
  nativeNoiseSuppression,
  nativeNoiseSuppressionActive
}: {
  mlNoiseSuppression: boolean;
  nativeNoiseSuppression: boolean;
  nativeNoiseSuppressionActive: boolean;
}): {
  requestedMode: VoiceNoiseSuppressionRequestedMode;
  fallbackMode: 'native' | 'disabled';
  nativeNoiseSuppressionActive: boolean;
} {
  return {
    requestedMode: mlNoiseSuppression
      ? 'ml'
      : nativeNoiseSuppression
        ? 'native'
        : 'disabled',
    fallbackMode: nativeNoiseSuppression ? 'native' : 'disabled',
    nativeNoiseSuppressionActive
  };
}

export function detectVoiceMlNoiseSuppressionSupport(
  environment: VoiceNoiseSuppressionSupportEnvironment
): {
  supported: boolean;
  reason: VoiceNoiseSuppressionFallbackReason | null;
} {
  if (!environment.webAssembly) {
    return { supported: false, reason: 'webassembly-unavailable' };
  }
  if (!environment.audioWorklet || !environment.audioWorkletNode) {
    return { supported: false, reason: 'audio-worklet-unavailable' };
  }
  if (!environment.worker) {
    return { supported: false, reason: 'worker-unavailable' };
  }
  if (!environment.messageChannel) {
    return { supported: false, reason: 'message-channel-unavailable' };
  }
  if (environment.sampleRate !== 48_000) {
    return { supported: false, reason: 'unsupported-sample-rate' };
  }

  return { supported: true, reason: null };
}

export function createVoiceNoiseSuppressionBaseTelemetry({
  requestedMode,
  nativeNoiseSuppressionActive,
  providerId = null,
  sampledAtMs = Date.now()
}: {
  requestedMode: VoiceNoiseSuppressionRequestedMode;
  nativeNoiseSuppressionActive: boolean;
  providerId?: string | null;
  sampledAtMs?: number;
}): VoiceNoiseSuppressionTelemetry {
  if (requestedMode === 'disabled') {
    return createTelemetry({
      requestedMode,
      activeMode: 'disabled',
      lifecycle: 'disabled',
      health: 'unavailable',
      providerId,
      fallbackReason: 'disabled-by-settings',
      sampledAtMs
    });
  }

  if (requestedMode === 'native') {
    return createTelemetry({
      requestedMode,
      activeMode: nativeNoiseSuppressionActive ? 'native' : 'disabled',
      lifecycle: nativeNoiseSuppressionActive ? 'native' : 'fallback',
      health: nativeNoiseSuppressionActive ? 'healthy' : 'unavailable',
      providerId,
      fallbackReason: nativeNoiseSuppressionActive
        ? null
        : 'native-noise-suppression-unavailable',
      sampledAtMs
    });
  }

  return createTelemetry({
    requestedMode,
    activeMode: 'disabled',
    lifecycle: 'initializing',
    health: 'initializing',
    providerId,
    fallbackReason: null,
    sampledAtMs
  });
}

export function createVoiceNoiseSuppressionFallbackTelemetry({
  requestedMode,
  fallbackMode,
  nativeNoiseSuppressionActive,
  reason,
  providerId = null,
  didProviderFail = false,
  sampledAtMs = Date.now()
}: {
  requestedMode: VoiceNoiseSuppressionRequestedMode;
  fallbackMode: 'native' | 'disabled';
  nativeNoiseSuppressionActive: boolean;
  reason: VoiceNoiseSuppressionFallbackReason;
  providerId?: string | null;
  didProviderFail?: boolean;
  sampledAtMs?: number;
}): VoiceNoiseSuppressionTelemetry {
  const usesNativeFallback =
    fallbackMode === 'native' && nativeNoiseSuppressionActive;

  return createTelemetry({
    requestedMode,
    activeMode: usesNativeFallback ? 'native' : 'disabled',
    lifecycle: didProviderFail && !usesNativeFallback ? 'failed' : 'fallback',
    health: didProviderFail && !usesNativeFallback ? 'failed' : 'unavailable',
    providerId,
    fallbackReason: reason,
    sampledAtMs
  });
}

export function normalizeVoiceNoiseSuppressionProcessorTelemetry(
  current: VoiceNoiseSuppressionTelemetry,
  sample: VoiceNoiseSuppressionProcessorSample,
  sampledAtMs = Date.now()
): VoiceNoiseSuppressionTelemetry {
  const averageProcessingTimeMs = finiteNonNegativeOrNull(
    sample.averageProcessingTimeMs
  );
  const frameDurationMs = finitePositiveOrNull(sample.frameDurationMs);
  const latencyMs = finiteNonNegativeOrNull(sample.algorithmicLatencyMs);
  const cpuLoadPercent =
    averageProcessingTimeMs !== null && frameDurationMs !== null
      ? Math.round(
          Math.min(999, (averageProcessingTimeMs / frameDurationMs) * 100) * 10
        ) / 10
      : null;
  const processedFrames = finiteInteger(sample.processedFrames);
  const droppedFrames = finiteInteger(sample.droppedFrames);
  const outputUnderruns = finiteInteger(sample.outputUnderruns);
  const health = classifyVoiceNoiseSuppressionHealth({
    cpuLoadPercent,
    latencyMs,
    droppedFrames,
    outputUnderruns
  });

  return {
    ...current,
    activeMode: 'ml',
    lifecycle: 'active',
    health,
    fallbackReason: null,
    latencyMs,
    averageProcessingTimeMs,
    cpuLoadPercent,
    processedFrames,
    droppedFrames,
    outputUnderruns,
    sampledAtMs
  };
}

export function classifyVoiceNoiseSuppressionHealth({
  cpuLoadPercent,
  latencyMs,
  droppedFrames,
  outputUnderruns
}: {
  cpuLoadPercent: number | null;
  latencyMs: number | null;
  droppedFrames: number;
  outputUnderruns: number;
}): VoiceNoiseSuppressionHealth {
  if (
    droppedFrames > 0 ||
    outputUnderruns > 0 ||
    (cpuLoadPercent !== null && cpuLoadPercent >= 80) ||
    (latencyMs !== null && latencyMs > 40)
  ) {
    return 'degraded';
  }

  return 'healthy';
}

function createTelemetry({
  requestedMode,
  activeMode,
  lifecycle,
  health,
  providerId,
  fallbackReason,
  sampledAtMs
}: Pick<
  VoiceNoiseSuppressionTelemetry,
  | 'requestedMode'
  | 'activeMode'
  | 'lifecycle'
  | 'health'
  | 'providerId'
  | 'fallbackReason'
  | 'sampledAtMs'
>): VoiceNoiseSuppressionTelemetry {
  return {
    requestedMode,
    activeMode,
    lifecycle,
    health,
    providerId,
    fallbackReason,
    latencyMs: null,
    averageProcessingTimeMs: null,
    cpuLoadPercent: null,
    processedFrames: 0,
    droppedFrames: 0,
    outputUnderruns: 0,
    sampledAtMs
  };
}

function finitePositiveOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function finiteNonNegativeOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function finiteInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}
