import { expect, test } from '@playwright/test';

import type { ServerJoinRequestResponse } from '../../src/shared/types';
import {
  mergeServerJoinRequestPages,
  serverJoinRequestPageSize
} from '../../src/system/Server/hooks/workspace/serverJoinRequestPaginationModel';

function joinRequest(id: string, displayName = id): ServerJoinRequestResponse {
  return {
    id,
    user: { displayName }
  } as ServerJoinRequestResponse;
}

test.describe('server join request pagination model', () => {
  test('loads 100 requests per page', () => {
    expect(serverJoinRequestPageSize).toBe(100);
  });

  test('deduplicates overlapping pages and preserves loaded order', () => {
    const loadedRequest = joinRequest('request-2', 'Loaded');
    const result = mergeServerJoinRequestPages(
      [joinRequest('request-1'), loadedRequest],
      [joinRequest('request-2', 'Duplicate'), joinRequest('request-3')]
    );

    expect(result.map((request) => request.id)).toEqual([
      'request-1',
      'request-2',
      'request-3'
    ]);
    expect(result[1]).toBe(loadedRequest);
  });
});
