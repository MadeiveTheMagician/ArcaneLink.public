import { useState } from 'react';

import type { VoicePeerStatus } from './voiceChannelTypes';
import { normalizeUserId } from './voiceChannelUtils';

export function useVoicePeerStatuses() {
  const [peerStatusesByParticipantId, setPeerStatusesByParticipantId] =
    useState<Record<string, VoicePeerStatus>>({});

  function setPeerStatus(participantId: string, status: VoicePeerStatus) {
    setPeerStatusesByParticipantId((current) => ({
      ...current,
      [normalizeUserId(participantId)]: status
    }));
  }

  function removePeerStatus(participantId: string) {
    setPeerStatusesByParticipantId((current) => {
      const next = { ...current };
      delete next[normalizeUserId(participantId)];
      return next;
    });
  }

  return {
    peerStatusesByParticipantId,
    setPeerStatus,
    removePeerStatus
  };
}
