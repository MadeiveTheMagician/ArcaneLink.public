import { expect, test } from '@playwright/test';

import {
  combineVoicePlaybackVolume,
  isDefaultAudioOutputDeviceId,
  resolveAudioOutputDeviceId,
  supportsAudioOutputPrompt,
  supportsAudioOutputRouting
} from '../../src/system/shared/voice/audioOutput';

test.describe('audio output model', () => {
  test('combines the ArcaneLink master volume with participant volume', () => {
    expect(combineVoicePlaybackVolume(80, 0.5)).toBeCloseTo(0.4);
    expect(combineVoicePlaybackVolume(100, 1)).toBe(1);
    expect(combineVoicePlaybackVolume(0, 1)).toBe(0);
  });

  test('clamps invalid values and always silences muted playback', () => {
    expect(combineVoicePlaybackVolume(150, 2)).toBe(1);
    expect(combineVoicePlaybackVolume(-10, -1)).toBe(0);
    expect(combineVoicePlaybackVolume(Number.NaN, Number.NaN)).toBe(1);
    expect(combineVoicePlaybackVolume(100, 1, true)).toBe(0);
  });

  test('uses the requested output only while it remains available', () => {
    const devices = [{ deviceId: 'headset' }, { deviceId: 'speakers' }];

    expect(resolveAudioOutputDeviceId('headset', devices)).toEqual({
      deviceId: 'headset',
      didFallback: false
    });
    expect(resolveAudioOutputDeviceId('removed-device', devices)).toEqual({
      deviceId: '',
      didFallback: true
    });
  });

  test('normalizes system default output aliases', () => {
    expect(resolveAudioOutputDeviceId('', [])).toEqual({
      deviceId: '',
      didFallback: false
    });
    expect(resolveAudioOutputDeviceId('default', [])).toEqual({
      deviceId: '',
      didFallback: false
    });
    expect(isDefaultAudioOutputDeviceId('default')).toBe(true);
    expect(isDefaultAudioOutputDeviceId('')).toBe(true);
    expect(isDefaultAudioOutputDeviceId('headset')).toBe(false);
  });

  test('checks routing and permission prompt as separate capabilities', () => {
    expect(
      supportsAudioOutputRouting({
        setSinkId: async () => undefined
      })
    ).toBe(true);
    expect(supportsAudioOutputRouting({})).toBe(false);

    expect(
      supportsAudioOutputPrompt({
        selectAudioOutput: async () => ({}) as MediaDeviceInfo
      })
    ).toBe(true);
    expect(supportsAudioOutputPrompt({})).toBe(false);
  });
});
