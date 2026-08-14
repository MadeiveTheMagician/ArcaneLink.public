const initialPeerRecoveryDelayMs = 8_000
const repeatedPeerRecoveryDelayMs = 10_000

export function resolveVoicePeerRecoveryDelayMs(
  state: RTCPeerConnectionState,
  hasAttemptedRecovery: boolean,
) {
  if (state === 'failed') {
    return hasAttemptedRecovery ? repeatedPeerRecoveryDelayMs : 0
  }

  if (state === 'disconnected') {
    return hasAttemptedRecovery
      ? repeatedPeerRecoveryDelayMs
      : initialPeerRecoveryDelayMs
  }

  return null
}
