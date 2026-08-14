export type SystemSkeletonPresencePhase =
  | 'hidden'
  | 'waiting'
  | 'entering'
  | 'visible'
  | 'exiting'

export type SystemSkeletonPresenceEvent =
  | 'show'
  | 'hide'
  | 'reveal'
  | 'entered'
  | 'exited'

export type SystemSkeletonPresenceTiming = {
  revealDelayMs: number
  enterDurationMs: number
  exitDurationMs: number
}

export const defaultSystemSkeletonPresenceTiming: SystemSkeletonPresenceTiming =
  {
    revealDelayMs: 140,
    enterDurationMs: 160,
    exitDurationMs: 160,
  }

export function createSystemSkeletonPresencePhase(
  isLoading: boolean,
): SystemSkeletonPresencePhase {
  return isLoading ? 'waiting' : 'hidden'
}

export function reduceSystemSkeletonPresence(
  phase: SystemSkeletonPresencePhase,
  event: SystemSkeletonPresenceEvent,
): SystemSkeletonPresencePhase {
  if (event === 'show') {
    if (phase === 'hidden') return 'waiting'
    if (phase === 'exiting') return 'entering'
    return phase
  }

  if (event === 'hide') {
    if (phase === 'waiting') return 'hidden'
    if (phase === 'entering' || phase === 'visible') return 'exiting'
    return phase
  }

  if (event === 'reveal' && phase === 'waiting') {
    return 'entering'
  }

  if (event === 'entered' && phase === 'entering') {
    return 'visible'
  }

  if (event === 'exited' && phase === 'exiting') {
    return 'hidden'
  }

  return phase
}

export function isSystemSkeletonPresenceMounted(
  phase: SystemSkeletonPresencePhase,
) {
  return phase !== 'hidden'
}

export function getSystemSkeletonPresenceDelayMs(
  phase: SystemSkeletonPresencePhase,
  timing: SystemSkeletonPresenceTiming,
  prefersReducedMotion: boolean,
): number | null {
  if (phase === 'waiting') {
    return timing.revealDelayMs
  }

  if (phase === 'entering') {
    return prefersReducedMotion ? 0 : timing.enterDurationMs
  }

  if (phase === 'exiting') {
    return prefersReducedMotion ? 0 : timing.exitDurationMs
  }

  return null
}
