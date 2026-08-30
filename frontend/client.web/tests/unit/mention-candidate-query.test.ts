import { expect, test } from '@playwright/test';

import {
  buildMentionCandidateRequestPath,
  mergeMentionCandidateResponses,
  scheduleMentionCandidateQuery
} from '../../src/system/Server/components/messages/mentions';

test.describe('mention candidate requests', () => {
  test('encodes the active display-name or login query', () => {
    expect(
      buildMentionCandidateRequestPath(
        'server-id',
        'space-id',
        'Senior moderator'
      )
    ).toBe(
      '/api/servers/server-id/spaces/space-id/messages/mention-candidates' +
        '?query=Senior+moderator'
    );
  });

  test('debounces a request and aborts it when the query becomes stale', async () => {
    const calls: Array<{ query: string; signal: AbortSignal }> = [];
    const cancelFirst = scheduleMentionCandidateQuery(
      (query, signal) => calls.push({ query, signal }),
      'bo',
      20
    );
    cancelFirst();

    const cancelSecond = scheduleMentionCandidateQuery(
      (query, signal) => calls.push({ query, signal }),
      'bob',
      5
    );
    await waitFor(() => calls.length === 1);

    expect(calls[0]?.query).toBe('bob');
    expect(calls[0]?.signal.aborted).toBe(false);
    cancelSecond();
    expect(calls[0]?.signal.aborted).toBe(true);
  });

  test('keeps previously selected candidates without duplicating fresh results', () => {
    expect(
      mergeMentionCandidateResponses(
        {
          users: [
            { id: 'user-old', login: 'old', displayName: 'Old' },
            { id: 'user-shared', login: 'before', displayName: 'Before' }
          ],
          roles: [{ id: 'role-old', title: 'Old role' }]
        },
        {
          users: [
            { id: 'user-shared', login: 'after', displayName: 'After' },
            { id: 'user-new', login: 'new', displayName: 'New' }
          ],
          roles: [{ id: 'role-new', title: 'New role' }]
        }
      )
    ).toEqual({
      users: [
        { id: 'user-shared', login: 'after', displayName: 'After' },
        { id: 'user-new', login: 'new', displayName: 'New' },
        { id: 'user-old', login: 'old', displayName: 'Old' }
      ],
      roles: [
        { id: 'role-new', title: 'New role' },
        { id: 'role-old', title: 'Old role' }
      ]
    });
  });
});

async function waitFor(predicate: () => boolean) {
  const timeoutAt = Date.now() + 1000;
  while (!predicate()) {
    if (Date.now() >= timeoutAt) {
      throw new Error('Timed out waiting for predicate');
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}
