import { useEffect, useRef } from 'react';

import styles from './VoiceParticipants.module.css';

type VoiceVideoTileProps = {
  stream: MediaStream;
  isMuted: boolean;
};

export function VoiceVideoTile({ stream, isMuted }: VoiceVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={videoRef}
      className={styles.voiceParticipantVideo}
      autoPlay
      playsInline
      muted={isMuted}
    />
  );
}
