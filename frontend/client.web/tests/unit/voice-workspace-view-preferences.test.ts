import { expect, test } from '@playwright/test';

import {
  defaultVoiceWorkspaceViewPreferences,
  isVoiceWorkspaceCardVisible,
  loadVoiceWorkspaceViewPreferences,
  saveVoiceWorkspaceViewPreferences
} from '../../src/system/Server/components/voice/participants/voiceWorkspaceViewPreferences';

function installMemoryLocalStorage() {
  const values = new Map<string, string>();
  const localStorage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
    get length() {
      return values.size;
    }
  } satisfies Storage;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage }
  });
}

test.describe('voice workspace view preferences', () => {
  test.beforeEach(() => installMemoryLocalStorage());

  test('keeps workspace preferences isolated between accounts', () => {
    saveVoiceWorkspaceViewPreferences('USER-A', {
      showParticipantsWithoutVideo: false,
      showSelfCamera: false
    });

    expect(loadVoiceWorkspaceViewPreferences('user-a')).toEqual({
      showParticipantsWithoutVideo: false,
      showSelfCamera: false
    });
    expect(loadVoiceWorkspaceViewPreferences('user-b')).toEqual(
      defaultVoiceWorkspaceViewPreferences
    );
  });

  test('only hides the local camera card, not its screen share', () => {
    expect(
      isVoiceWorkspaceCardVisible({ isSelf: true, mediaKind: 'camera' }, false)
    ).toBe(false);
    expect(
      isVoiceWorkspaceCardVisible({ isSelf: true, mediaKind: 'screen' }, false)
    ).toBe(true);
    expect(
      isVoiceWorkspaceCardVisible({ isSelf: false, mediaKind: 'camera' }, false)
    ).toBe(true);
  });
});
