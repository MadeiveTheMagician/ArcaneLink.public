import { useState } from 'react';

import { apiJson } from '../../../../shared/api/api';
import type { UserResponse } from '../../../../shared/types';
import { useUserPresenceChanged } from '../../../shared/hooks/useUserPresenceChanged';
import {
  captureUserPresenceEventBoundary,
  reconcileCurrentUserWithLatestPresence
} from '../../../shared/presence/presenceEventStore';
import { patchCurrentUserPresence } from '../../../shared/presence/presenceModel';

export function useCurrentHubUser(
  accessToken: string,
  initialUser: UserResponse
) {
  const [user, setUser] = useState(initialUser);

  useUserPresenceChanged((payload) => {
    setUser((current) => patchCurrentUserPresence(current, payload));
  });

  async function loadCurrentUser() {
    const presenceBoundary = captureUserPresenceEventBoundary();
    setUser(
      reconcileCurrentUserWithLatestPresence(
        await apiJson<UserResponse>('/api/users/me', {
          accessToken
        }),
        presenceBoundary
      )
    );
  }

  return {
    user,
    loadCurrentUser
  };
}
