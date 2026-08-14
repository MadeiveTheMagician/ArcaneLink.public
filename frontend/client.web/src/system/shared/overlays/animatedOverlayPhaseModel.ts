export type AnimatedOverlayPhase = 'open' | 'closing'

export const downloadWarningCloseDurationMs = 180
export const systemSettingsCloseDurationMs = 200

export function beginAnimatedOverlayClose(
  phase: AnimatedOverlayPhase,
): AnimatedOverlayPhase {
  return phase === 'open' ? 'closing' : phase
}

export function canRequestAnimatedOverlayClose(
  phase: AnimatedOverlayPhase,
) {
  return phase === 'open'
}

export function getAnimatedOverlayCloseDelayMs(
  durationMs: number,
  prefersReducedMotion: boolean,
) {
  if (prefersReducedMotion) return 0
  if (!Number.isFinite(durationMs)) return 0

  return Math.max(0, durationMs)
}
