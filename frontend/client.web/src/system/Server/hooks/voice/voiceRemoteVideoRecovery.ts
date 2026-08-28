import type {
  ConnectedVoiceChannel,
  VoiceParticipant
} from './voiceChannelTypes';
import { normalizeUserId } from './voiceChannelUtils';

type RemoteVideoRecoveryOptions = {
  spaceId: string;
  participants: VoiceParticipant[];
  operationId: number;
  lastAttemptByParticipant: Record<string, number>;
  getChannel: () => ConnectedVoiceChannel | null;
  isCurrentOperation: (operationId: number) => boolean;
  isCurrentParticipant: (participant: VoiceParticipant) => boolean;
  getRemoteStream: (participantId: string) => MediaStream | null | undefined;
  hasPeerConnection: (participantId: string) => boolean;
  renegotiatePeer: (participantId: string) => void | Promise<void>;
  debug: (event: string, details: Record<string, unknown>) => void;
};

const retryDelays = [900, 2400, 5200];
const recoveryCooldownMs = 8000;
const mutedRecoveryGraceMs = 12_000;

export function resolveRemoteVideoRecoveryState(
  remoteStream: MediaStream | null | undefined,
  expectedTrackCount: number,
  previousMutedSince: number | null,
  now: number
) {
  const liveTracks =
    remoteStream
      ?.getVideoTracks()
      .filter((track) => track.readyState === 'live') ?? [];
  if (liveTracks.length < expectedTrackCount) {
    return { shouldRecover: true, mutedSince: null };
  }

  const unmutedTrackCount = liveTracks.filter((track) => !track.muted).length;
  if (unmutedTrackCount >= expectedTrackCount) {
    return { shouldRecover: false, mutedSince: null };
  }

  const mutedSince = previousMutedSince ?? now;
  return {
    shouldRecover: now - mutedSince >= mutedRecoveryGraceMs,
    mutedSince
  };
}

export function scheduleMissingRemoteVideoRecovery({
  spaceId,
  participants,
  operationId,
  lastAttemptByParticipant,
  getChannel,
  isCurrentOperation,
  isCurrentParticipant,
  getRemoteStream,
  hasPeerConnection,
  renegotiatePeer,
  debug
}: RemoteVideoRecoveryOptions) {
  retryDelays.forEach((delayMs, attemptIndex) => {
    window.setTimeout(() => {
      const channel = getChannel();
      if (
        !channel ||
        channel.spaceId !== spaceId ||
        !isCurrentOperation(operationId)
      ) {
        return;
      }

      participants.forEach((participant) => {
        if (
          isCurrentParticipant(participant) ||
          (!participant.isCameraEnabled && !participant.isScreenSharing)
        ) {
          return;
        }

        const participantId = normalizeUserId(participant.participantId);
        const remoteStream = getRemoteStream(participantId);
        const recoveryKey = `${spaceId}:${participantId}`;
        const mutedSinceKey = `${recoveryKey}:muted-since`;
        const now = Date.now();
        const recoveryState = resolveRemoteVideoRecoveryState(
          remoteStream,
          Number(participant.isCameraEnabled) +
            Number(participant.isScreenSharing),
          lastAttemptByParticipant[mutedSinceKey] ?? null,
          now
        );
        if (recoveryState.mutedSince === null) {
          delete lastAttemptByParticipant[mutedSinceKey];
        } else {
          lastAttemptByParticipant[mutedSinceKey] = recoveryState.mutedSince;
        }

        if (!recoveryState.shouldRecover || !hasPeerConnection(participantId)) {
          return;
        }

        const lastAttemptAt = lastAttemptByParticipant[recoveryKey] ?? 0;
        if (now - lastAttemptAt < recoveryCooldownMs) {
          debug('remote-video:recover-skip', {
            participantId,
            attempt: attemptIndex + 1,
            reason: 'cooldown'
          });
          return;
        }
        lastAttemptByParticipant[recoveryKey] = now;
        if (recoveryState.mutedSince !== null) {
          lastAttemptByParticipant[mutedSinceKey] = now;
        }

        debug('remote-video:recover', {
          participantId,
          attempt: attemptIndex + 1,
          isCameraEnabled: participant.isCameraEnabled,
          isScreenSharing: participant.isScreenSharing
        });
        void renegotiatePeer(participantId);
      });
    }, delayMs);
  });
}
