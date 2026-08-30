import { expect, test } from '@playwright/test';

import {
  activateVoiceProfile,
  createVoiceProfile,
  defaultVoiceProfileId,
  deleteVoiceProfile,
  duplicateVoiceProfile,
  getVoiceProfilesSnapshot,
  normalizeVoiceProfileName,
  parseVoiceProfiles,
  renameVoiceProfile,
  voiceProfileLimit
} from '../../src/system/shared/voice/voiceProfiles';
import {
  type VoiceSettings,
  defaultVoiceSettings
} from '../../src/system/shared/voice/voiceSettings';

test.describe('voice profiles model', () => {
  test('migrates existing voice settings into a protected default profile', () => {
    const legacySettings: VoiceSettings = {
      ...defaultVoiceSettings,
      microphoneGainPercent: 135,
      mlNoiseSuppression: true,
      spatialAudioMode: 'balanced'
    };

    const snapshot = parseVoiceProfiles(null, legacySettings);

    expect(snapshot.activeProfileId).toBe(defaultVoiceProfileId);
    expect(snapshot.profiles).toHaveLength(1);
    expect(snapshot.profiles[0]).toMatchObject({
      id: defaultVoiceProfileId,
      isBuiltIn: true,
      settings: legacySettings
    });
  });

  test('normalizes names and caps malformed stored profile collections', () => {
    const profiles = Array.from(
      { length: voiceProfileLimit + 4 },
      (_, index) => ({
        id: index === 0 ? defaultVoiceProfileId : `profile-${index}`,
        name: `  Профиль   ${index}  `,
        isBuiltIn: false,
        settings: {
          ...defaultVoiceSettings,
          spatialAudioMode: index % 2 === 0 ? 'immersive' : 'off'
        },
        createdAt: 'invalid',
        updatedAt: 'invalid'
      })
    );
    const snapshot = parseVoiceProfiles(
      JSON.stringify({
        version: 1,
        activeProfileId: 'missing',
        profiles
      })
    );

    expect(snapshot.profiles).toHaveLength(voiceProfileLimit);
    expect(snapshot.profiles[0].id).toBe(defaultVoiceProfileId);
    expect(snapshot.profiles[0].name).toBe('Основной');
    expect(snapshot.activeProfileId).toBe(defaultVoiceProfileId);
    expect(normalizeVoiceProfileName('  Стриминг   вечером  ')).toBe(
      'Стриминг вечером'
    );
  });

  test('preserves the built-in profile even when it is stored after the limit', () => {
    const profiles = [
      ...Array.from({ length: voiceProfileLimit + 2 }, (_, index) => ({
        id: `custom-${index}`,
        name: `Custom ${index}`,
        isBuiltIn: false,
        settings: defaultVoiceSettings,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })),
      {
        id: defaultVoiceProfileId,
        name: 'Default',
        isBuiltIn: true,
        settings: {
          ...defaultVoiceSettings,
          microphoneGainPercent: 177
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ];

    const snapshot = parseVoiceProfiles(
      JSON.stringify({
        version: 1,
        activeProfileId: defaultVoiceProfileId,
        profiles
      })
    );

    expect(snapshot.profiles).toHaveLength(voiceProfileLimit);
    expect(snapshot.profiles[0]).toMatchObject({
      id: defaultVoiceProfileId,
      settings: { microphoneGainPercent: 177 }
    });
  });

  test('recovers built-in settings when a legacy profile has no name', () => {
    const snapshot = parseVoiceProfiles(
      JSON.stringify({
        version: 1,
        activeProfileId: defaultVoiceProfileId,
        profiles: [
          {
            id: defaultVoiceProfileId,
            name: '',
            settings: {
              ...defaultVoiceSettings,
              outputVolumePercent: 37
            }
          }
        ]
      })
    );

    expect(snapshot.profiles[0]).toMatchObject({
      id: defaultVoiceProfileId,
      name: 'Основной',
      settings: { outputVolumePercent: 37 }
    });
  });

  test('creates, duplicates, renames, activates and removes user profiles', () => {
    const created = createVoiceProfile('Игровой профиль', {
      ...defaultVoiceSettings,
      mlNoiseSuppression: true,
      spatialAudioMode: 'immersive'
    });
    expect(created).not.toBeNull();
    expect(getVoiceProfilesSnapshot().activeProfileId).toBe(created?.id);

    expect(renameVoiceProfile(created?.id ?? '', 'Игры')).toBe(true);
    const duplicate = duplicateVoiceProfile(created?.id ?? '');
    expect(duplicate?.name).toBe('Игры — копия');
    expect(activateVoiceProfile(created?.id ?? '')).toBe(true);
    expect(deleteVoiceProfile(created?.id ?? '')).toBe(true);
    expect(getVoiceProfilesSnapshot().activeProfileId).toBe(
      defaultVoiceProfileId
    );
    expect(deleteVoiceProfile(defaultVoiceProfileId)).toBe(false);
    expect(renameVoiceProfile(defaultVoiceProfileId, 'Нельзя')).toBe(false);
  });
});
