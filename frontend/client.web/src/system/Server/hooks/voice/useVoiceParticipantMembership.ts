import { useRef, useState } from 'react';
import type { RefObject } from 'react';

import type {
  ConnectedVoiceChannel,
  VoiceParticipant
} from './voiceChannelTypes';
import { normalizeUserId } from './voiceChannelUtils';
import { isLocalVoiceParticipant } from './voiceParticipantMembershipModel';

type VoiceParticipantMembershipOptions = {
  currentUserId: string;
  localParticipantIdRef: RefObject<string | null>;
  getConnectedChannel: () => ConnectedVoiceChannel | null;
  getLocalActivityStream: () => MediaStream | null;
  startVoiceActivityMonitor: (
    participantId: string,
    stream: MediaStream
  ) => void;
  stopVoiceActivityMonitor: (participantId: string) => void;
};

export function useVoiceParticipantMembership({
  currentUserId,
  localParticipantIdRef,
  getConnectedChannel,
  getLocalActivityStream,
  startVoiceActivityMonitor,
  stopVoiceActivityMonitor
}: VoiceParticipantMembershipOptions) {
  const staleSpaceIdsRef = useRef<Set<string>>(new Set());
  const [participantsBySpaceId, setParticipantsBySpaceId] = useState<
    Record<string, VoiceParticipant[]>
  >({});
  const [localParticipantId, setLocalParticipantId] = useState<string | null>(
    null
  );

  function isCurrentVoiceParticipant(participant: VoiceParticipant) {
    return isLocalVoiceParticipant({
      participant,
      currentUserId,
      localParticipantId: localParticipantIdRef.current,
      hasConnectedChannel: Boolean(getConnectedChannel())
    });
  }

  function setLocalVoiceParticipantId(participantId: string | null) {
    const normalizedParticipantId = participantId
      ? normalizeUserId(participantId)
      : null;
    const previousParticipantId = localParticipantIdRef.current;
    if (
      previousParticipantId &&
      previousParticipantId !== normalizedParticipantId
    ) {
      stopVoiceActivityMonitor(previousParticipantId);
    }
    localParticipantIdRef.current = normalizedParticipantId;
    setLocalParticipantId(normalizedParticipantId);

    const localStream = getLocalActivityStream();
    if (normalizedParticipantId && localStream) {
      stopVoiceActivityMonitor(currentUserId);
      startVoiceActivityMonitor(normalizedParticipantId, localStream);
    }
  }

  function markSpaceStale(spaceId: string) {
    staleSpaceIdsRef.current.add(spaceId);
  }

  function markSpaceFresh(spaceId: string) {
    staleSpaceIdsRef.current.delete(spaceId);
  }

  function removeCurrentUserFromSpace(spaceId: string) {
    setParticipantsBySpaceId((current) => {
      const participants = current[spaceId];

      if (!participants?.some(isCurrentVoiceParticipant)) {
        return current;
      }

      return {
        ...current,
        [spaceId]: participants.filter(
          (participant) => !isCurrentVoiceParticipant(participant)
        )
      };
    });
  }

  function sanitizeVoiceParticipants(
    spaceId: string,
    participants: VoiceParticipant[]
  ) {
    if (getConnectedChannel()?.spaceId === spaceId) {
      return participants;
    }

    if (staleSpaceIdsRef.current.has(spaceId)) {
      return participants.filter(
        (participant) => !isCurrentVoiceParticipant(participant)
      );
    }

    return participants.filter(
      (participant) => !isCurrentVoiceParticipant(participant)
    );
  }

  return {
    localParticipantId,
    participantsBySpaceId,
    setParticipantsBySpaceId,
    isCurrentVoiceParticipant,
    setLocalVoiceParticipantId,
    markSpaceStale,
    markSpaceFresh,
    removeCurrentUserFromSpace,
    sanitizeVoiceParticipants
  };
}
