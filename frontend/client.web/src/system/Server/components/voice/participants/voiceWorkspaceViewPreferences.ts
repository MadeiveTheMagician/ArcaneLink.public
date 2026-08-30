export type VoiceWorkspaceViewPreferences = {
  showParticipantsWithoutVideo: boolean;
  showSelfCamera: boolean;
};

type VoiceWorkspaceViewPreferencesStorage = {
  version: 1;
  accounts: Record<string, VoiceWorkspaceViewPreferences>;
};

const voiceWorkspaceViewPreferencesStorageKey =
  'arcanelink.voiceWorkspaceViewPreferences.v1';

export const defaultVoiceWorkspaceViewPreferences = {
  showParticipantsWithoutVideo: true,
  showSelfCamera: true
} as const satisfies VoiceWorkspaceViewPreferences;

export function loadVoiceWorkspaceViewPreferences(
  userId: string
): VoiceWorkspaceViewPreferences {
  const accountKey = normalizeAccountKey(userId);
  if (!accountKey || typeof window === 'undefined') {
    return { ...defaultVoiceWorkspaceViewPreferences };
  }

  try {
    const raw = window.localStorage.getItem(
      voiceWorkspaceViewPreferencesStorageKey
    );
    if (!raw) {
      return { ...defaultVoiceWorkspaceViewPreferences };
    }

    const parsed = JSON.parse(
      raw
    ) as Partial<VoiceWorkspaceViewPreferencesStorage>;
    return normalizeVoiceWorkspaceViewPreferences(
      parsed.accounts?.[accountKey]
    );
  } catch {
    return { ...defaultVoiceWorkspaceViewPreferences };
  }
}

export function saveVoiceWorkspaceViewPreferences(
  userId: string,
  preferences: VoiceWorkspaceViewPreferences
) {
  const accountKey = normalizeAccountKey(userId);
  if (!accountKey || typeof window === 'undefined') {
    return;
  }

  let accounts: Record<string, VoiceWorkspaceViewPreferences> = {};
  try {
    const raw = window.localStorage.getItem(
      voiceWorkspaceViewPreferencesStorageKey
    );
    if (raw) {
      const parsed = JSON.parse(
        raw
      ) as Partial<VoiceWorkspaceViewPreferencesStorage>;
      if (parsed.accounts && typeof parsed.accounts === 'object') {
        accounts = parsed.accounts;
      }
    }
  } catch {
    accounts = {};
  }

  const snapshot: VoiceWorkspaceViewPreferencesStorage = {
    version: 1,
    accounts: {
      ...accounts,
      [accountKey]: normalizeVoiceWorkspaceViewPreferences(preferences)
    }
  };
  window.localStorage.setItem(
    voiceWorkspaceViewPreferencesStorageKey,
    JSON.stringify(snapshot)
  );
}

export function isVoiceWorkspaceCardVisible(
  card: {
    isSelf: boolean;
    mediaKind: 'camera' | 'screen';
  },
  showSelfCamera: boolean
) {
  return showSelfCamera || !card.isSelf || card.mediaKind !== 'camera';
}

function normalizeVoiceWorkspaceViewPreferences(
  value: Partial<VoiceWorkspaceViewPreferences> | null | undefined
): VoiceWorkspaceViewPreferences {
  return {
    showParticipantsWithoutVideo:
      typeof value?.showParticipantsWithoutVideo === 'boolean'
        ? value.showParticipantsWithoutVideo
        : true,
    showSelfCamera:
      typeof value?.showSelfCamera === 'boolean' ? value.showSelfCamera : true
  };
}

function normalizeAccountKey(value: string) {
  return value.trim().toLowerCase();
}
