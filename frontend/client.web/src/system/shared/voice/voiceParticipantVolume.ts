export const minimumVoiceParticipantVolume = 0
export const defaultVoiceParticipantVolume = 1
export const maximumVoiceParticipantVolume = 4

export const minimumVoiceParticipantVolumePercent =
  minimumVoiceParticipantVolume * 100
export const maximumVoiceParticipantVolumePercent =
  maximumVoiceParticipantVolume * 100
export const voiceParticipantVolumePercentStep = 1

export function clampVoiceParticipantVolume(volume: number) {
  if (!Number.isFinite(volume)) {
    return defaultVoiceParticipantVolume
  }

  return Math.min(
    maximumVoiceParticipantVolume,
    Math.max(minimumVoiceParticipantVolume, volume),
  )
}

export function voiceParticipantVolumeToPercent(volume: number) {
  return Math.round(clampVoiceParticipantVolume(volume) * 100)
}

export function voiceParticipantVolumeFromPercent(volumePercent: number) {
  return clampVoiceParticipantVolume(volumePercent / 100)
}

export function requiresVoiceParticipantGain(volume: number) {
  return clampVoiceParticipantVolume(volume) > 1
}
