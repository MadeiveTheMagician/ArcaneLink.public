import { getVoiceVideoReceiverTrackKind } from '../../../hooks/voice/voiceVideoTrackKinds';

export function getActiveVideoTracks(
  stream: MediaStream | null | undefined,
  mediaTrackVersion = 0
) {
  void mediaTrackVersion;

  return (
    stream
      ?.getVideoTracks()
      .filter(
        (track) => track.readyState === 'live' && track.enabled && !track.muted
      ) ?? []
  );
}

export type ParticipantVideoTracks = {
  camera: MediaStreamTrack | null;
  screen: MediaStreamTrack | null;
};

export function selectParticipantVideoTracks(
  stream: MediaStream | null | undefined,
  {
    isCameraEnabled,
    isScreenSharing
  }: {
    isCameraEnabled: boolean;
    isScreenSharing: boolean;
  },
  mediaTrackVersion = 0
): ParticipantVideoTracks {
  void mediaTrackVersion;

  const tracks = stream?.getVideoTracks() ?? [];
  const cameraReceiverTrack =
    tracks.find(
      (track) => getVoiceVideoReceiverTrackKind(track) === 'camera'
    ) ??
    tracks[0] ??
    null;
  const screenReceiverTrack =
    tracks.find(
      (track) => getVoiceVideoReceiverTrackKind(track) === 'screen'
    ) ??
    tracks[1] ??
    null;
  const cameraTrack = isCameraEnabled ? cameraReceiverTrack : null;
  const screenTrack = isScreenSharing ? screenReceiverTrack : null;

  return {
    camera: isActiveVideoTrack(cameraTrack) ? cameraTrack : null,
    screen: isActiveVideoTrack(screenTrack) ? screenTrack : null
  };
}

const streamByTrack = new WeakMap<MediaStreamTrack, MediaStream>();

export function createTrackStream(track: MediaStreamTrack | null | undefined) {
  if (!track) return null;

  const existingStream = streamByTrack.get(track);
  if (existingStream) return existingStream;

  const stream = new MediaStream([track]);
  streamByTrack.set(track, stream);
  return stream;
}

export function hasActiveVideoTrack(
  stream: MediaStream | null | undefined,
  mediaTrackVersion = 0
) {
  return getActiveVideoTracks(stream, mediaTrackVersion).length > 0;
}

function isActiveVideoTrack(track: MediaStreamTrack | null) {
  return Boolean(
    track && track.readyState === 'live' && track.enabled && !track.muted
  );
}
