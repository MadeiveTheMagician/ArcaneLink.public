import { expect, test } from '@playwright/test';

import {
  applyVoiceGainToLevelDb,
  calculateVoiceRms,
  createAutomaticVoiceThresholdState,
  createVoiceActivityState,
  normalizeVoiceLevel,
  resolveVoiceThresholdDb,
  rmsToDecibels,
  updateAutomaticVoiceThreshold,
  updateVoiceActivityState,
  voiceLevelFloorDb
} from '../../src/system/Server/hooks/voice/voiceActivityModel';

test.describe('voice activity model', () => {
  test('converts silence and a known waveform into stable levels', () => {
    expect(calculateVoiceRms(new Uint8Array([128, 128, 128]))).toBe(0);
    expect(rmsToDecibels(0)).toBe(voiceLevelFloorDb);

    const rms = calculateVoiceRms(new Uint8Array([0, 128, 255, 128]));
    expect(rms).toBeCloseTo(Math.SQRT1_2, 2);
    expect(rmsToDecibels(rms)).toBeCloseTo(-3, 0);
    expect(normalizeVoiceLevel(-50)).toBe(0.5);
  });

  test('applies digital input gain to the measured decibel level', () => {
    expect(applyVoiceGainToLevelDb(-50, 2)).toBeCloseTo(-44, 0);
    expect(applyVoiceGainToLevelDb(-50, 0.5)).toBeCloseTo(-56, 0);
    expect(applyVoiceGainToLevelDb(-50, 0)).toBe(voiceLevelFloorDb);
    expect(applyVoiceGainToLevelDb(-50, Number.NaN)).toBe(-50);
  });

  test('calibrates automatic threshold above the measured noise floor', () => {
    let state = createAutomaticVoiceThresholdState();

    for (let index = 0; index < 45; index += 1) {
      state = updateAutomaticVoiceThreshold(state, index % 5 === 0 ? -46 : -52);
    }

    expect(state.isCalibrated).toBe(true);
    expect(resolveVoiceThresholdDb('automatic', -42, state)).toBeCloseTo(
      -40,
      0
    );
  });

  test('clamps manual thresholds to the supported range', () => {
    const state = createAutomaticVoiceThresholdState();

    expect(resolveVoiceThresholdDb('manual', -90, state)).toBe(-80);
    expect(resolveVoiceThresholdDb('manual', -10, state)).toBe(-20);
  });

  test('uses attack and release hysteresis around the threshold', () => {
    let state = createVoiceActivityState();

    state = updateVoiceActivityState(state, true);
    expect(state.isSpeaking).toBe(false);
    state = updateVoiceActivityState(state, true);
    expect(state.isSpeaking).toBe(true);

    for (let index = 0; index < 11; index += 1) {
      state = updateVoiceActivityState(state, false);
    }
    expect(state.isSpeaking).toBe(true);

    state = updateVoiceActivityState(state, false);
    expect(state.isSpeaking).toBe(false);
  });
});
