export type VoiceAudioTrackSnapshot = {
  readyState: MediaStreamTrackState
  muted: boolean
}

export type VoiceAudioTrackPlaybackState =
  | 'missing'
  | 'pending'
  | 'available'

export function resolveVoiceAudioTrackPlaybackState(
  tracks: readonly VoiceAudioTrackSnapshot[],
): VoiceAudioTrackPlaybackState {
  const liveTracks = tracks.filter((track) => track.readyState === 'live')
  if (liveTracks.length === 0) {
    return 'missing'
  }

  return liveTracks.some((track) => !track.muted)
    ? 'available'
    : 'pending'
}

export function canStartVoiceAudioPlayback(
  state: VoiceAudioTrackPlaybackState,
) {
  return state !== 'missing'
}
