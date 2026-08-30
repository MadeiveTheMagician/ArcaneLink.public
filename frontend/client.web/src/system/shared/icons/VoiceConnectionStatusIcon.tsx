import styles from './VoiceConnectionStatusIcon.module.css';

export type VoiceConnectionStatusIconState =
  | 'connecting'
  | 'good'
  | 'degraded'
  | 'poor'
  | 'reconnecting'
  | 'disconnected'
  | 'unknown';

type VoiceConnectionStatusIconProps = {
  className?: string;
  state: VoiceConnectionStatusIconState;
};

export function VoiceConnectionStatusIcon({
  className = '',
  state
}: VoiceConnectionStatusIconProps) {
  return (
    <span
      className={`${styles.icon} ${className}`}
      data-state={state}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" focusable="false">
        <path
          className={styles.receiver}
          d="m7.25 8.6 3.45-1.72 2.82 5.65-2.12 1.3a14.1 14.1 0 0 0 6.77 6.77l1.3-2.12 5.65 2.82-1.72 3.45a2.8 2.8 0 0 1-3.3 1.42A20.1 20.1 0 0 1 5.83 11.9 2.8 2.8 0 0 1 7.25 8.6Z"
        />
        <path
          className={`${styles.wave} ${styles.waveNear}`}
          d="M17.3 12.8a3.2 3.2 0 0 0-3.2-3.2"
        />
        <path
          className={`${styles.wave} ${styles.waveMiddle}`}
          d="M21.65 12.8a7.55 7.55 0 0 0-7.55-7.55"
        />
        <path
          className={`${styles.wave} ${styles.waveFar}`}
          d="M26 12.8A11.9 11.9 0 0 0 14.1.9"
        />
        <path className={styles.slash} d="M5.4 5.4 26.6 26.6" />
      </svg>
    </span>
  );
}
