import { type RefObject, useEffect } from 'react';

type BodyChildAccessibilityState = {
  inert: boolean;
  ariaHidden: string | null;
};

const modalBackdrops: HTMLElement[] = [];
const originalBodyChildStates = new Map<
  HTMLElement,
  BodyChildAccessibilityState
>();
let bodyObserver: MutationObserver | null = null;

function rememberBodyChildState(element: HTMLElement) {
  if (originalBodyChildStates.has(element)) return;

  originalBodyChildStates.set(element, {
    inert: element.inert,
    ariaHidden: element.getAttribute('aria-hidden')
  });
}

function restoreBodyChildState(element: HTMLElement) {
  const originalState = originalBodyChildStates.get(element);
  if (!originalState) return;

  element.inert = originalState.inert;
  if (originalState.ariaHidden == null) {
    element.removeAttribute('aria-hidden');
  } else {
    element.setAttribute('aria-hidden', originalState.ariaHidden);
  }
}

function syncBodyModalAccessibility() {
  if (typeof document === 'undefined') return;

  const activeBackdrop = modalBackdrops.at(-1) ?? null;
  const bodyChildren = Array.from(document.body.children).filter(
    (element): element is HTMLElement => element instanceof HTMLElement
  );

  for (const element of bodyChildren) {
    rememberBodyChildState(element);

    if (element === activeBackdrop) {
      restoreBodyChildState(element);
    } else {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    }
  }

  for (const element of originalBodyChildStates.keys()) {
    if (!element.isConnected) originalBodyChildStates.delete(element);
  }
}

function startBodyObserver() {
  if (bodyObserver || typeof MutationObserver === 'undefined') return;

  bodyObserver = new MutationObserver(syncBodyModalAccessibility);
  bodyObserver.observe(document.body, { childList: true });
}

function stopBodyObserverAndRestore() {
  bodyObserver?.disconnect();
  bodyObserver = null;

  for (const element of originalBodyChildStates.keys()) {
    restoreBodyChildState(element);
  }
  originalBodyChildStates.clear();
}

function registerBodyModal(backdrop: HTMLElement) {
  modalBackdrops.push(backdrop);
  startBodyObserver();
  syncBodyModalAccessibility();

  return () => {
    const backdropIndex = modalBackdrops.lastIndexOf(backdrop);
    if (backdropIndex >= 0) modalBackdrops.splice(backdropIndex, 1);

    if (modalBackdrops.length === 0) {
      stopBodyObserverAndRestore();
    } else {
      syncBodyModalAccessibility();
    }
  };
}

export function useBodyModalInert(
  isOpen: boolean,
  backdropRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!isOpen || !backdropRef.current) return undefined;

    return registerBodyModal(backdropRef.current);
  }, [backdropRef, isOpen]);
}
