export const voiceInputMeterFloorDb = -80;
export const voiceInputMeterCeilingDb = 0;
export const voiceInputThresholdMaximumDb = -20;

export function normalizeVoiceInputMeterDb(levelDb: number) {
  const safeLevelDb = Number.isFinite(levelDb)
    ? levelDb
    : voiceInputMeterFloorDb;

  return clamp(
    (safeLevelDb - voiceInputMeterFloorDb) /
      (voiceInputMeterCeilingDb - voiceInputMeterFloorDb),
    0,
    1
  );
}

export function getVoiceInputThresholdTrackRatio() {
  return normalizeVoiceInputMeterDb(voiceInputThresholdMaximumDb);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
