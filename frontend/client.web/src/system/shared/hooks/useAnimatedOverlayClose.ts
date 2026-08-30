import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type AnimatedOverlayPhase,
  beginAnimatedOverlayClose,
  canRequestAnimatedOverlayClose,
  getAnimatedOverlayCloseDelayMs
} from '../overlays/animatedOverlayPhaseModel';

type CloseCompletion = () => void;

function prefersReducedMotion() {
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}

export function useAnimatedOverlayClose(durationMs: number) {
  const [phase, setPhase] = useState<AnimatedOverlayPhase>('open');
  const phaseRef = useRef<AnimatedOverlayPhase>('open');
  const closeTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    []
  );

  const requestClose = useCallback(
    (onClosed: CloseCompletion, onAfterClosed?: CloseCompletion) => {
      if (!canRequestAnimatedOverlayClose(phaseRef.current)) return false;

      phaseRef.current = beginAnimatedOverlayClose(phaseRef.current);
      setPhase(phaseRef.current);

      const closeDelayMs = getAnimatedOverlayCloseDelayMs(
        durationMs,
        prefersReducedMotion()
      );

      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null;
        onClosed();

        if (onAfterClosed) {
          window.requestAnimationFrame(onAfterClosed);
        }
      }, closeDelayMs);

      return true;
    },
    [durationMs]
  );

  return {
    isClosing: phase === 'closing',
    phase,
    requestClose
  };
}
