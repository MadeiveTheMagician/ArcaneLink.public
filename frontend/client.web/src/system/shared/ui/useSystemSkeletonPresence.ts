import { useEffect, useMemo, useReducer, useState } from 'react';

import {
  type SystemSkeletonPresenceEvent,
  type SystemSkeletonPresenceTiming,
  createSystemSkeletonPresencePhase,
  defaultSystemSkeletonPresenceTiming,
  getSystemSkeletonPresenceDelayMs,
  isSystemSkeletonPresenceMounted,
  reduceSystemSkeletonPresence
} from './systemSkeletonPresenceModel';

type SystemSkeletonPresenceOptions = Partial<SystemSkeletonPresenceTiming>;

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

function normalizeDuration(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, value ?? fallback) : fallback;
}

export function useSystemSkeletonPresence(
  isLoading: boolean,
  options: SystemSkeletonPresenceOptions = {}
) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const timing = useMemo<SystemSkeletonPresenceTiming>(
    () => ({
      revealDelayMs: normalizeDuration(
        options.revealDelayMs,
        defaultSystemSkeletonPresenceTiming.revealDelayMs
      ),
      enterDurationMs: normalizeDuration(
        options.enterDurationMs,
        defaultSystemSkeletonPresenceTiming.enterDurationMs
      ),
      exitDurationMs: normalizeDuration(
        options.exitDurationMs,
        defaultSystemSkeletonPresenceTiming.exitDurationMs
      )
    }),
    [options.enterDurationMs, options.exitDurationMs, options.revealDelayMs]
  );
  const [phase, dispatch] = useReducer(
    reduceSystemSkeletonPresence,
    isLoading,
    createSystemSkeletonPresencePhase
  );

  useEffect(() => {
    dispatch(isLoading ? 'show' : 'hide');
  }, [isLoading]);

  useEffect(() => {
    const delayMs = getSystemSkeletonPresenceDelayMs(
      phase,
      timing,
      prefersReducedMotion
    );

    if (delayMs == null) {
      return;
    }

    const eventByPhase: Partial<
      Record<typeof phase, SystemSkeletonPresenceEvent>
    > = {
      waiting: 'reveal',
      entering: 'entered',
      exiting: 'exited'
    };
    const event = eventByPhase[phase];
    if (!event) {
      return;
    }

    const timeoutId = window.setTimeout(() => dispatch(event), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [phase, prefersReducedMotion, timing]);

  return {
    isMounted: isSystemSkeletonPresenceMounted(phase),
    phase
  };
}
