const volumeTaper = 100

export function voiceVolumeToAttenuationGain(volume: number) {
  return (volumeTaper ** volume - 1) / (volumeTaper - 1)
}
