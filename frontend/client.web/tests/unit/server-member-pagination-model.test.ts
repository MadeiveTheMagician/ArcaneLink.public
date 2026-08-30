import { expect, test } from '@playwright/test';

import type { ServerMemberDetailsResponse } from '../../src/shared/types';
import {
  mergeServerMemberPages,
  serverMemberPageSize,
  shouldLoadMoreServerMembers
} from '../../src/system/Server/hooks/workspace/serverMemberPaginationModel';

function member(id: string, displayName = id): ServerMemberDetailsResponse {
  return {
    id,
    user: { displayName }
  } as ServerMemberDetailsResponse;
}

test.describe('server member pagination model', () => {
  test('loads 100 members per request', () => {
    expect(serverMemberPageSize).toBe(100);
  });

  test('starts loading after 85 percent of the list is reached', () => {
    expect(
      shouldLoadMoreServerMembers({
        scrollTop: 649,
        clientHeight: 200,
        scrollHeight: 1000
      })
    ).toBe(false);
    expect(
      shouldLoadMoreServerMembers({
        scrollTop: 650,
        clientHeight: 200,
        scrollHeight: 1000
      })
    ).toBe(true);
  });

  test('deduplicates overlapping pages and keeps the loaded version', () => {
    const loadedMember = member('member-2', 'Updated');
    const result = mergeServerMemberPages(
      [member('member-1'), loadedMember],
      [member('member-2', 'Stale'), member('member-3')]
    );

    expect(result.map((item) => item.id)).toEqual([
      'member-1',
      'member-2',
      'member-3'
    ]);
    expect(result[1]).toBe(loadedMember);
  });
});
