import type { ServerMemberDetailsResponse } from '../../../../../shared/types';
import { voiceCopy } from '../../../../shared/copy/voice.ru.ts';
import type { VoicePlaybackState } from '../../../../shared/types/voicePlayback';
import { fallbackAvatarAccent } from '../../../../shared/utils/avatarAccent';
import type {
  VoiceParticipant,
  VoicePeerStatus
} from '../../../hooks/voice/useVoiceChannel';
import type { VoiceParticipantCard } from '../detached/detachedVoiceWorkspaceTypes';
import {
  getVoiceParticipantMember,
  normalizeVoiceParticipantUserId
} from './VoiceParticipantIdentity';
import {
  createTrackStream,
  hasActiveVideoTrack,
  selectParticipantVideoTracks
} from './voiceMediaTracks';

type EffectiveVoiceParticipantsOptions = {
  participants: VoiceParticipant[];
  serverMembers: ServerMemberDetailsResponse[];
  isConnected: boolean;
  localParticipantId: string | null;
  currentUserId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
};

type VoiceParticipantCardsOptions = {
  participants: VoiceParticipant[];
  serverMembers: ServerMemberDetailsResponse[];
  currentUserId: string;
  localParticipantId: string | null;
  localCameraPreviewStream: MediaStream | null;
  localScreenPreviewStream: MediaStream | null;
  remoteStreamsByParticipantId: Record<string, MediaStream>;
  peerStatusesByParticipantId: Record<string, VoicePeerStatus>;
  playbackStatesByParticipantId: Record<string, VoicePlaybackState>;
  speakingParticipantIds: Record<string, boolean>;
  avatarAccentsByParticipantId: Record<string, string>;
  mediaTrackVersion: number;
};

export type VoiceParticipantAudioStatus = 'muted' | 'deafened';

export function getActiveVoiceParticipantAudioStatuses(
  participant: Pick<VoiceParticipant, 'isMuted' | 'isDeafened'>
): VoiceParticipantAudioStatus[] {
  const statuses: VoiceParticipantAudioStatus[] = [];

  if (participant.isMuted) {
    statuses.push('muted');
  }
  if (participant.isDeafened) {
    statuses.push('deafened');
  }

  return statuses;
}

export function createEffectiveVoiceParticipants({
  participants,
  serverMembers,
  isConnected,
  localParticipantId,
  currentUserId,
  isMuted,
  isDeafened,
  isCameraEnabled,
  isScreenSharing
}: EffectiveVoiceParticipantsOptions) {
  const participantsWithCurrentServerIdentity = participants.map(
    (participant) => {
      const member = getVoiceParticipantMember(participant, serverMembers);
      if (!member) return participant;

      const login = member.user.login.trim() || participant.login;
      const displayName = member.user.displayName.trim() || login;
      if (
        participant.login === login &&
        participant.displayName === displayName
      ) {
        return participant;
      }

      return {
        ...participant,
        login,
        displayName
      };
    }
  );

  if (!isConnected || !localParticipantId) {
    return participantsWithCurrentServerIdentity;
  }

  const normalizedCurrentUserId =
    normalizeVoiceParticipantUserId(currentUserId);
  const hasLocalParticipant = participantsWithCurrentServerIdentity.some(
    (participant) => {
      const participantId = normalizeVoiceParticipantUserId(
        participant.participantId
      );
      const userId = normalizeVoiceParticipantUserId(participant.userId);

      return (
        participantId === localParticipantId ||
        userId === normalizedCurrentUserId
      );
    }
  );

  if (hasLocalParticipant) return participantsWithCurrentServerIdentity;

  const currentMember = serverMembers.find(
    (member) =>
      normalizeVoiceParticipantUserId(member.userId) === normalizedCurrentUserId
  );
  const fallbackParticipant: VoiceParticipant = {
    participantId: localParticipantId,
    userId: currentUserId,
    login: currentMember?.user.login ?? currentUserId,
    displayName:
      currentMember?.user.displayName ??
      currentMember?.user.login ??
      voiceCopy.participantMenu.you,
    isMuted,
    isDeafened,
    isCameraEnabled,
    isScreenSharing,
    joinedAt: ''
  };

  return [...participantsWithCurrentServerIdentity, fallbackParticipant];
}

export function createVoiceParticipantCards({
  participants,
  serverMembers,
  currentUserId,
  localParticipantId,
  localCameraPreviewStream,
  localScreenPreviewStream,
  remoteStreamsByParticipantId,
  peerStatusesByParticipantId,
  playbackStatesByParticipantId,
  speakingParticipantIds,
  avatarAccentsByParticipantId,
  mediaTrackVersion
}: VoiceParticipantCardsOptions): VoiceParticipantCard[] {
  return participants.flatMap((participant) => {
    const normalizedParticipantId = normalizeVoiceParticipantUserId(
      participant.participantId
    );
    const participantMember = getVoiceParticipantMember(
      participant,
      serverMembers
    );
    const isSelf =
      normalizedParticipantId === localParticipantId ||
      normalizeVoiceParticipantUserId(participant.userId) ===
        normalizeVoiceParticipantUserId(currentUserId);
    const isSpeaking = Boolean(speakingParticipantIds[normalizedParticipantId]);
    const remoteStream = remoteStreamsByParticipantId[normalizedParticipantId];
    const remoteVideoTracks = selectParticipantVideoTracks(
      remoteStream,
      participant,
      mediaTrackVersion
    );
    const canRenderCamera = participant.canUseVideo !== false;
    const canRenderScreen = participant.canShareScreen !== false;
    const cameraTrack =
      participant.isCameraEnabled && canRenderCamera
        ? remoteVideoTracks.camera
        : null;
    const screenTrack =
      participant.isScreenSharing && canRenderScreen
        ? remoteVideoTracks.screen
        : null;
    const cameraStream = isSelf
      ? canRenderCamera
        ? localCameraPreviewStream
        : null
      : createTrackStream(cameraTrack);
    const screenStream = isSelf
      ? canRenderScreen
        ? localScreenPreviewStream
        : null
      : createTrackStream(screenTrack);
    const status = getVoiceParticipantStatus(
      participant,
      peerStatusesByParticipantId[normalizedParticipantId],
      playbackStatesByParticipantId[normalizedParticipantId]
    );
    const accent =
      avatarAccentsByParticipantId[normalizedParticipantId] ??
      fallbackAvatarAccent;
    const hasCameraVideo = hasActiveVideoTrack(cameraStream, mediaTrackVersion);
    const hasScreenVideo = hasActiveVideoTrack(screenStream, mediaTrackVersion);
    const cards: VoiceParticipantCard[] = [
      {
        accent,
        hasVideo: hasCameraVideo,
        isSelf,
        isSpeaking,
        mediaKind: 'camera',
        normalizedParticipantId,
        participant,
        participantMember,
        participantStream: cameraStream,
        status
      }
    ];

    if (canRenderScreen && (participant.isScreenSharing || hasScreenVideo)) {
      cards.push({
        accent,
        hasVideo: hasScreenVideo,
        isSelf,
        isSpeaking,
        mediaKind: 'screen',
        normalizedParticipantId: `${normalizedParticipantId}:screen`,
        participant,
        participantMember,
        participantStream: screenStream,
        status: hasScreenVideo
          ? voiceCopy.channel.screenShare
          : voiceCopy.channel.screenShareWaiting
      });
    }

    return cards;
  });
}

export function getVoiceParticipantStatus(
  participant: VoiceParticipant,
  peerStatus: VoicePeerStatus | undefined,
  playbackState: VoicePlaybackState | undefined
) {
  if (participant.isDeafened) return voiceCopy.participantMenu.soundOff;
  if (participant.isMuted) return voiceCopy.participantMenu.microphoneOff;
  if (!peerStatus) return voiceCopy.participantMenu.waitingWebRtc;

  if (!peerStatus.hasRemoteStream) {
    return `${peerStatus.connectionState}/${peerStatus.iceConnectionState}`;
  }

  if (playbackState === 'blocked') {
    return voiceCopy.participantMenu.audioNeedsEnable;
  }

  if (playbackState === 'silent') return voiceCopy.participantMenu.audioSilent;
  if (playbackState === 'playing')
    return voiceCopy.participantMenu.audioPlaying;

  return voiceCopy.participantMenu.audioConnected;
}
