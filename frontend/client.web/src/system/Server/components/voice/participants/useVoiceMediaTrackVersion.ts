import { useEffect, useState } from 'react'

type UseVoiceMediaTrackVersionOptions = {
  localCameraPreviewStream: MediaStream | null
  localScreenPreviewStream: MediaStream | null
  remoteStreamsByParticipantId: Record<string, MediaStream>
}

export function useVoiceMediaTrackVersion({
  localCameraPreviewStream,
  localScreenPreviewStream,
  remoteStreamsByParticipantId,
}: UseVoiceMediaTrackVersionOptions) {
  const [mediaTrackVersion, setMediaTrackVersion] = useState(0)

  useEffect(() => {
    const streams = [
      localCameraPreviewStream,
      localScreenPreviewStream,
      ...Object.values(remoteStreamsByParticipantId),
    ].filter((stream): stream is MediaStream => Boolean(stream))
    const uniqueStreams = Array.from(new Set(streams))

    function refreshMediaTrackState() {
      setMediaTrackVersion((current) => current + 1)
    }

    uniqueStreams.forEach((stream) => {
      stream.addEventListener('addtrack', refreshMediaTrackState)
      stream.addEventListener('removetrack', refreshMediaTrackState)

      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', refreshMediaTrackState)
        track.addEventListener('mute', refreshMediaTrackState)
        track.addEventListener('unmute', refreshMediaTrackState)
      })
    })

    return () => {
      uniqueStreams.forEach((stream) => {
        stream.removeEventListener('addtrack', refreshMediaTrackState)
        stream.removeEventListener('removetrack', refreshMediaTrackState)

        stream.getVideoTracks().forEach((track) => {
          track.removeEventListener('ended', refreshMediaTrackState)
          track.removeEventListener('mute', refreshMediaTrackState)
          track.removeEventListener('unmute', refreshMediaTrackState)
        })
      })
    }
  }, [
    localCameraPreviewStream,
    localScreenPreviewStream,
    remoteStreamsByParticipantId,
  ])

  return mediaTrackVersion
}
