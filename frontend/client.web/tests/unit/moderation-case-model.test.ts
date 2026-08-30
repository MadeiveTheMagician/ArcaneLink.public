import { expect, test } from '@playwright/test';

import {
  createModerationCaseListUrl,
  mergeModerationCasePages,
  replaceModerationCaseSummary
} from '../../src/system/Moderation/models/moderationCaseModel';
import {
  getModerationCaseStatusLabel,
  getUserReportStatusLabel
} from '../../src/system/Moderation/moderationCopy.ru';
import type {
  ModerationCasePageResponse,
  ModerationCaseSummaryResponse
} from '../../src/system/Moderation/moderationTypes';
import { isModerationEventForServer } from '../../src/system/shared/moderation/moderationRealtime';

function summary(
  caseId: string,
  updatedAt: string
): ModerationCaseSummaryResponse {
  return {
    caseId,
    serverId: 'server-1',
    spaceId: 'space-1',
    messageId: 'message-1',
    reportedUserId: 'user-2',
    reportedUserDisplayName: 'User 2',
    status: 'open',
    submissionCount: 1,
    reasonCodes: ['spam'],
    createdAt: updatedAt,
    updatedAt
  };
}

test.describe('moderation case model', () => {
  test('builds status and composite cursor query parameters', () => {
    expect(
      createModerationCaseListUrl({
        serverId: 'server-1',
        status: 'in_review',
        cursor: {
          updatedAt: '2026-07-21T12:00:00.0000001Z',
          id: 'case-2'
        },
        limit: 20
      })
    ).toBe(
      '/api/servers/server-1/moderation/cases?status=in_review&beforeUpdatedAt=2026-07-21T12%3A00%3A00.0000001Z&beforeId=case-2&limit=20'
    );

    expect(
      createModerationCaseListUrl({
        serverId: 'server-1',
        status: 'all'
      })
    ).toBe('/api/servers/server-1/moderation/cases?limit=30');
  });

  test('merges paged cases without duplicates and keeps newest first', () => {
    const replacement = summary('CASE-1', '2026-07-21T12:02:00Z');
    const page: ModerationCasePageResponse = {
      items: [replacement, summary('case-2', '2026-07-21T12:01:00Z')],
      nextCursor: null
    };

    const merged = mergeModerationCasePages(
      [summary('case-1', '2026-07-21T12:00:00Z')],
      page
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(replacement);
  });

  test('updates status by case id and scopes realtime events by server', () => {
    const cases = [summary('case-1', '2026-07-21T12:00:00Z')];
    const updated = replaceModerationCaseSummary(cases, {
      caseId: 'CASE-1',
      status: 'resolved',
      updatedAt: '2026-07-21T12:03:00Z'
    });

    expect(updated[0].status).toBe('resolved');
    expect(
      isModerationEventForServer({ serverId: 'SERVER-1' }, 'server-1')
    ).toBe(true);
    expect(isModerationEventForServer(undefined, 'server-1')).toBe(false);
    expect(getModerationCaseStatusLabel('in_review')).toBe('На рассмотрении');
    expect(getUserReportStatusLabel('received')).toBe('Получена');
    expect(getUserReportStatusLabel('closed')).toBe('Закрыта');
  });
});
