import { SystemIcon, voiceCopy } from '../../../../shared';
import type { VoiceUserAudioSettings } from '../../../../shared/types/voicePlayback';
import type { VoiceParticipant } from '../../../hooks/voice/useVoiceChannel';
import { getActiveVoiceParticipantAudioStatuses } from './voiceParticipantCards';

import styles from './VoiceParticipantLocalStatus.module.css';

type VoiceParticipantLocalStatusProps = {
  participant: Pick<VoiceParticipant, 'isMuted' | 'isDeafened'>;
  settings?: VoiceUserAudioSettings;
  className?: string;
};

export function VoiceParticipantLocalStatus({
  participant,
  settings,
  className = ''
}: VoiceParticipantLocalStatusProps) {
  const participantStatuses =
    getActiveVoiceParticipantAudioStatuses(participant);

  if (
    participantStatuses.length === 0 &&
    !settings?.isMuted &&
    settings?.isVideoHidden !== true
  ) {
    return null;
  }

  return (
    <span className={`${styles.statuses} ${className}`}>
      {participantStatuses.map((status) => {
        const isMuted = status === 'muted';
        const label = isMuted
          ? voiceCopy.participantMenu.microphoneOff
          : voiceCopy.participantMenu.soundOff;

        return (
          <span
            className={styles.statusIcon}
            key={status}
            role={'img'}
            aria-label={label}
            title={label}
          >
            <SystemIcon
              name={isMuted ? 'mic-off' : 'headphones-off'}
              size={16}
              tone={'danger'}
            />
          </span>
        );
      })}
      {settings?.isMuted && (
        <span
          className={`${styles.statusIcon} ${styles.crossed}`}
          role="img"
          aria-label={voiceCopy.participantMenu.localMuteActive}
          title={voiceCopy.participantMenu.localMuteActive}
        >
          <SystemIcon name="speaker" size={16} tone="danger" />
        </span>
      )}
      {settings?.isVideoHidden === true && (
        <span
          className={`${styles.statusIcon} ${styles.crossed}`}
          role="img"
          aria-label={voiceCopy.participantMenu.videoHiddenLocally}
          title={voiceCopy.participantMenu.videoHiddenLocally}
        >
          <SystemIcon name="camera" size={16} tone="danger" />
        </span>
      )}
    </span>
  );
}
