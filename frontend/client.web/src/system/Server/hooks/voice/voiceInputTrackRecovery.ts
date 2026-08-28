const voiceInputTrackRecoveryDelaysMs = [1500, 5000, 15_000] as const
export const voiceInputTrackStabilityResetDelayMs = 10_000

export function resolveVoiceInputTrackRecoveryDelayMs(attempt: number) {
  if (!Number.isInteger(attempt) || attempt < 0) {
    return null
  }

  return voiceInputTrackRecoveryDelaysMs[attempt] ?? null
}

export function shouldRecoverVoiceInputTrack({
  documentVisibility,
  isMuted,
  isDeafened,
  trackMuted,
  trackReadyState,
}: {
  documentVisibility: DocumentVisibilityState
  isMuted: boolean
  isDeafened: boolean
  trackMuted: boolean
  trackReadyState: MediaStreamTrackState
}) {
  return (
    documentVisibility === 'visible' &&
    !isMuted &&
    !isDeafened &&
    trackReadyState === 'live' &&
    trackMuted
  )
}
