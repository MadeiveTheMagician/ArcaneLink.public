import { useRef, useState } from 'react';

import { normalizeUserId } from './voiceChannelUtils';

export function useRemoteVoiceStreams() {
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const [remoteStreamsByParticipantId, setRemoteStreamsByParticipantId] =
    useState<Record<string, MediaStream>>({});

  function getRemoteStream(participantId: string) {
    return remoteStreamsRef.current[normalizeUserId(participantId)] ?? null;
  }

  function hasRemoteStream(participantId: string) {
    return Boolean(getRemoteStream(participantId));
  }

  function setRemoteStream(participantId: string, stream: MediaStream) {
    const normalizedParticipantId = normalizeUserId(participantId);
    const nextStream = new MediaStream(stream.getTracks());

    remoteStreamsRef.current = {
      ...remoteStreamsRef.current,
      [normalizedParticipantId]: nextStream
    };
    setRemoteStreamsByParticipantId((current) => ({
      ...current,
      [normalizedParticipantId]: nextStream
    }));
  }

  function removeRemoteStream(participantId: string) {
    const normalizedParticipantId = normalizeUserId(participantId);
    const nextRemoteStreams = { ...remoteStreamsRef.current };
    delete nextRemoteStreams[normalizedParticipantId];
    remoteStreamsRef.current = nextRemoteStreams;

    setRemoteStreamsByParticipantId((current) => {
      const next = { ...current };
      delete next[normalizedParticipantId];
      return next;
    });
  }

  function clearRemoteStreams() {
    remoteStreamsRef.current = {};
    setRemoteStreamsByParticipantId({});
  }

  return {
    remoteStreamsByParticipantId,
    getRemoteStream,
    hasRemoteStream,
    setRemoteStream,
    removeRemoteStream,
    clearRemoteStreams
  };
}
