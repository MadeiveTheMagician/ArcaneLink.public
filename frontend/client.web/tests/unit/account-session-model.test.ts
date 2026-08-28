import { expect, test } from '@playwright/test';

import type { UserDeviceSessionResponse } from '../../src/shared/types';
import {
  getOtherAccountSessions,
  isAccountSessionCurrent,
  sortAccountSessions
} from '../../src/system/Hub/components/settings/accountSessionModel';

function session(
  id: string,
  lastUsedAt: string,
  isCurrent = false
): UserDeviceSessionResponse {
  return {
    id,
    deviceName: null,
    ipAddress: null,
    userAgent: null,
    createdAt: lastUsedAt,
    lastUsedAt,
    isCurrent
  };
}

test.describe('account session model', () => {
  test('recognizes the current session from either the API flag or local id', () => {
    expect(
      isAccountSessionCurrent(session('api', '2026-08-13', true), null)
    ).toBe(true);
    expect(
      isAccountSessionCurrent(session('local', '2026-08-13'), 'local')
    ).toBe(true);
    expect(
      isAccountSessionCurrent(session('other', '2026-08-13'), 'local')
    ).toBe(false);
  });

  test('keeps the current session first and excludes it from revocable sessions', () => {
    const sessions = [
      session('older', '2026-08-11T12:00:00Z'),
      session('current', '2026-08-10T12:00:00Z'),
      session('newer', '2026-08-12T12:00:00Z')
    ];

    const sorted = sortAccountSessions(sessions, 'current');

    expect(sorted.map((item) => item.id)).toEqual([
      'current',
      'newer',
      'older'
    ]);
    expect(
      getOtherAccountSessions(sorted, 'current').map((item) => item.id)
    ).toEqual(['newer', 'older']);
  });
});
