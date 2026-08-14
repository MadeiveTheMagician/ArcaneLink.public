export function getActiveVideoTracks(
  stream: MediaStream | null | undefined,
  mediaTrackVersion = 0,
) {
  void mediaTrackVersion

  return (
    stream
      ?.getVideoTracks()
      .filter(
        (track) =>
          track.readyState === 'live' && track.enabled && !track.muted,
      ) ?? []
  )
}

const streamByTrack = new WeakMap<MediaStreamTrack, MediaStream>()

export function createTrackStream(
  track: MediaStreamTrack | null | undefined,
) {
  if (!track) return null

  const existingStream = streamByTrack.get(track)
  if (existingStream) return existingStream

  const stream = new MediaStream([track])
  streamByTrack.set(track, stream)
  return stream
}

export function hasActiveVideoTrack(
  stream: MediaStream | null | undefined,
  mediaTrackVersion = 0,
) {
  return getActiveVideoTracks(stream, mediaTrackVersion).length > 0
}
