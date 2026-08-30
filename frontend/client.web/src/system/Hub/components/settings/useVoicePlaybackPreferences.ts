import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type {
  VoicePlaybackState,
  VoiceUserAudioSettings
} from '../../../shared/types/voicePlayback';
import {
  getVoicePlaybackPreferencesSnapshot,
  subscribeVoicePlaybackPreferences,
  updateVoiceUserAudioSettings
} from '../../../shared/voice/voicePlaybackPreferences';

const serverAudioSettingsSnapshot: Record<string, VoiceUserAudioSettings> = {};

export function useVoicePlaybackPreferences(ownerUserId: string) {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      subscribeVoicePlaybackPreferences(onStoreChange, ownerUserId),
    [ownerUserId]
  );
  const getSnapshot = useCallback(
    () => getVoicePlaybackPreferencesSnapshot(ownerUserId),
    [ownerUserId]
  );
  const audioSettingsByUserId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverAudioSettingsSnapshot
  );
  const [playbackStatesByParticipantId, setPlaybackStatesByParticipantId] =
    useState<Record<string, VoicePlaybackState>>({});

  useEffect(() => {
    setPlaybackStatesByParticipantId({});
  }, [ownerUserId]);

  const updatePlaybackState = useCallback(
    (participantId: string, state: VoicePlaybackState) => {
      setPlaybackStatesByParticipantId((current) => {
        const normalizedParticipantId =
          normalizeVoiceParticipantId(participantId);
        if (state === 'idle') {
          if (!(normalizedParticipantId in current)) {
            return current;
          }

          const next = { ...current };
          delete next[normalizedParticipantId];
          return next;
        }

        return {
          ...current,
          [normalizedParticipantId]: state
        };
      });
    },
    []
  );

  const updateAudioSettings = useCallback(
    (userId: string, patch: Partial<VoiceUserAudioSettings>) => {
      updateVoiceUserAudioSettings(userId, patch, undefined, ownerUserId);
    },
    [ownerUserId]
  );

  return {
    audioSettingsByUserId,
    playbackStatesByParticipantId,
    updatePlaybackState,
    updateAudioSettings
  };
}

function normalizeVoiceParticipantId(participantId: string) {
  return participantId.trim().toLowerCase();
}
