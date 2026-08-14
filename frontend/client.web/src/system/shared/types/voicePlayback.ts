export type VoiceUserAudioSettings = {
  volume: number
  isMuted: boolean
  isVideoHidden?: boolean
}

export type VoicePlaybackState = 'idle' | 'playing' | 'blocked' | 'silent'
