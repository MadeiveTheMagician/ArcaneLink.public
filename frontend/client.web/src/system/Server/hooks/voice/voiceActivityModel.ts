export type VoiceThresholdMode = 'automatic' | 'manual';

export type AutomaticVoiceThresholdState = {
  calibrationSamplesDb: number[];
  noiseFloorDb: number;
  isCalibrated: boolean;
};

export type VoiceActivityState = {
  isSpeaking: boolean;
  attackFrames: number;
  releaseFrames: number;
};

export const voiceLevelFloorDb = -100;
export const defaultManualVoiceThresholdDb = -42;
export const defaultAutomaticVoiceThresholdDb = -42;

const automaticCalibrationSampleCount = 45;
const automaticNoiseMarginDb = 12;
const minimumAutomaticThresholdDb = -55;
const maximumAutomaticThresholdDb = -24;
const voiceAttackFrameCount = 2;
const voiceReleaseFrameCount = 12;

export function calculateVoiceRms(data: Uint8Array<ArrayBuffer>) {
  if (data.length === 0) {
    return 0;
  }

  let sum = 0;
  for (const value of data) {
    const normalizedValue = (value - 128) / 128;
    sum += normalizedValue * normalizedValue;
  }

  return Math.sqrt(sum / data.length);
}

export function rmsToDecibels(rms: number) {
  if (!Number.isFinite(rms) || rms <= 0) {
    return voiceLevelFloorDb;
  }

  return Math.max(voiceLevelFloorDb, 20 * Math.log10(rms));
}

export function applyVoiceGainToLevelDb(levelDb: number, linearGain: number) {
  const safeLevelDb = clampVoiceLevelDb(levelDb);
  if (!Number.isFinite(linearGain)) {
    return safeLevelDb;
  }
  if (linearGain <= 0) {
    return voiceLevelFloorDb;
  }

  return clampVoiceLevelDb(safeLevelDb + 20 * Math.log10(linearGain));
}

export function normalizeVoiceLevel(levelDb: number) {
  const normalizedLevel = (levelDb - voiceLevelFloorDb) / -voiceLevelFloorDb;
  return clamp(normalizedLevel, 0, 1);
}

export function createAutomaticVoiceThresholdState(): AutomaticVoiceThresholdState {
  return {
    calibrationSamplesDb: [],
    noiseFloorDb: defaultAutomaticVoiceThresholdDb - automaticNoiseMarginDb,
    isCalibrated: false
  };
}

export function updateAutomaticVoiceThreshold(
  state: AutomaticVoiceThresholdState,
  levelDb: number
): AutomaticVoiceThresholdState {
  const safeLevelDb = clampVoiceLevelDb(levelDb);

  if (!state.isCalibrated) {
    const calibrationSamplesDb = [
      ...state.calibrationSamplesDb,
      safeLevelDb
    ].slice(-automaticCalibrationSampleCount);

    if (calibrationSamplesDb.length < automaticCalibrationSampleCount) {
      return {
        ...state,
        calibrationSamplesDb
      };
    }

    return {
      calibrationSamplesDb: [],
      noiseFloorDb: percentile(calibrationSamplesDb, 0.6),
      isCalibrated: true
    };
  }

  const currentThresholdDb = automaticThresholdFromNoiseFloor(
    state.noiseFloorDb
  );
  if (safeLevelDb >= currentThresholdDb) {
    return state;
  }

  return {
    ...state,
    noiseFloorDb: state.noiseFloorDb * 0.98 + safeLevelDb * 0.02
  };
}

export function resolveVoiceThresholdDb(
  mode: VoiceThresholdMode,
  manualThresholdDb: number,
  automaticState: AutomaticVoiceThresholdState
) {
  if (mode === 'manual') {
    return clamp(manualThresholdDb, -80, -20);
  }

  return automaticState.isCalibrated
    ? automaticThresholdFromNoiseFloor(automaticState.noiseFloorDb)
    : defaultAutomaticVoiceThresholdDb;
}

export function createVoiceActivityState(): VoiceActivityState {
  return {
    isSpeaking: false,
    attackFrames: 0,
    releaseFrames: 0
  };
}

export function updateVoiceActivityState(
  state: VoiceActivityState,
  isAboveThreshold: boolean
): VoiceActivityState {
  if (isAboveThreshold) {
    const attackFrames = state.attackFrames + 1;

    return {
      isSpeaking: state.isSpeaking || attackFrames >= voiceAttackFrameCount,
      attackFrames,
      releaseFrames: 0
    };
  }

  const releaseFrames = state.releaseFrames + 1;
  return {
    isSpeaking: state.isSpeaking && releaseFrames < voiceReleaseFrameCount,
    attackFrames: 0,
    releaseFrames
  };
}

function automaticThresholdFromNoiseFloor(noiseFloorDb: number) {
  return clamp(
    noiseFloorDb + automaticNoiseMarginDb,
    minimumAutomaticThresholdDb,
    maximumAutomaticThresholdDb
  );
}

function clampVoiceLevelDb(value: number) {
  return clamp(
    Number.isFinite(value) ? value : voiceLevelFloorDb,
    voiceLevelFloorDb,
    0
  );
}

function percentile(values: number[], ratio: number) {
  const sortedValues = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * ratio))
  );

  return sortedValues[index] ?? voiceLevelFloorDb;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
