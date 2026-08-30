const initialPeerRecoveryDelayMs = 8_000;
const repeatedPeerRecoveryDelayMs = 10_000;

export function resolveVoicePeerRecoveryDelayMs(
  state: RTCPeerConnectionState,
  hasAttemptedRecovery: boolean,
  iceState?: RTCIceConnectionState
) {
  if (state === 'failed' || iceState === 'failed') {
    return hasAttemptedRecovery ? repeatedPeerRecoveryDelayMs : 0;
  }

  if (state === 'disconnected' || iceState === 'disconnected') {
    return hasAttemptedRecovery
      ? repeatedPeerRecoveryDelayMs
      : initialPeerRecoveryDelayMs;
  }

  return null;
}
