export type VoiceInputTransportMode = 'empty' | 'direct' | 'processed'

export function shouldUseDirectVoiceInputTransport(options: {
  microphoneGainPercent: number
  noiseSuppressionMode?: 'disabled' | 'native' | 'ml'
}) {
  return (
    options.microphoneGainPercent === 100 &&
    options.noiseSuppressionMode !== 'ml'
  )
}

export function createDirectVoiceInputStream(rawTrack: MediaStreamTrack) {
  const outboundTrack = rawTrack.clone()
  outboundTrack.enabled = true
  if ('contentHint' in outboundTrack) {
    outboundTrack.contentHint = 'speech'
  }

  return new MediaStream([outboundTrack])
}

export function setDirectVoiceInputGate(
  outboundStream: MediaStream,
  isOpen: boolean,
  canTransmit = true,
) {
  outboundStream.getAudioTracks().forEach((track) => {
    track.enabled = isOpen && canTransmit
  })
}

export function isDirectVoiceInputStreamReady(outboundStream: MediaStream) {
  return outboundStream
    .getAudioTracks()
    .some((track) => track.readyState === 'live')
}
