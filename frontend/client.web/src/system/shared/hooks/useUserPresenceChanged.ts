import { useEffect, useRef } from 'react';

import type { UserPresenceChangedPayload } from '../presence/presenceModel';

export const userPresenceChangedWindowEvent =
  'arcanelink:user-presence-changed';

export function useUserPresenceChanged(
  onPresenceChanged: (payload: UserPresenceChangedPayload) => void
) {
  const callbackRef = useRef(onPresenceChanged);

  useEffect(() => {
    callbackRef.current = onPresenceChanged;
  }, [onPresenceChanged]);

  useEffect(() => {
    function handlePresenceChanged(event: Event) {
      callbackRef.current(
        (event as CustomEvent<UserPresenceChangedPayload>).detail
      );
    }

    window.addEventListener(
      userPresenceChangedWindowEvent,
      handlePresenceChanged
    );

    return () =>
      window.removeEventListener(
        userPresenceChangedWindowEvent,
        handlePresenceChanged
      );
  }, []);
}
