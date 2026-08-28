import type { UserDeviceSessionResponse } from '../../../../shared/types';

export function isAccountSessionCurrent(
  session: UserDeviceSessionResponse,
  currentDeviceSessionId?: string | null
) {
  return session.isCurrent || session.id === currentDeviceSessionId;
}

export function sortAccountSessions(
  sessions: UserDeviceSessionResponse[],
  currentDeviceSessionId?: string | null
) {
  return [...sessions].sort((first, second) => {
    const firstCurrent = isAccountSessionCurrent(first, currentDeviceSessionId);
    const secondCurrent = isAccountSessionCurrent(
      second,
      currentDeviceSessionId
    );

    if (firstCurrent !== secondCurrent) {
      return firstCurrent ? -1 : 1;
    }

    return (
      new Date(second.lastUsedAt).getTime() -
      new Date(first.lastUsedAt).getTime()
    );
  });
}

export function getOtherAccountSessions(
  sessions: UserDeviceSessionResponse[],
  currentDeviceSessionId?: string | null
) {
  return sessions.filter(
    (session) => !isAccountSessionCurrent(session, currentDeviceSessionId)
  );
}
