import { expect, test } from '@playwright/test';

import {
  isUserDataCacheRecordCompatible,
  userDataCacheVersion
} from '../../src/shared/cache/clientCache';

test.describe('client data cache compatibility', () => {
  test('rejects legacy presence snapshots and accepts the current version', () => {
    const now = Date.parse('2026-07-21T12:00:00.000Z');
    const record = {
      key: 'user-1:friends',
      version: userDataCacheVersion,
      updatedAt: now,
      value: []
    };

    expect(isUserDataCacheRecordCompatible(record, now)).toBe(true);
    expect(
      isUserDataCacheRecordCompatible({ ...record, version: 1 }, now)
    ).toBe(false);
  });

  test('rejects expired or malformed records', () => {
    const now = Date.parse('2026-07-21T12:00:00.000Z');

    expect(
      isUserDataCacheRecordCompatible(
        {
          key: 'user-1:friends',
          version: userDataCacheVersion,
          updatedAt: now - 2 * 24 * 60 * 60 * 1000,
          value: []
        },
        now
      )
    ).toBe(false);
    expect(isUserDataCacheRecordCompatible(null, now)).toBe(false);
  });
});
