import type {
  ModerationCaseCursorResponse,
  ModerationCasePageResponse,
  ModerationCaseStatus,
  ModerationCaseSummaryResponse
} from '../moderationTypes';

export type ModerationCaseFilter = ModerationCaseStatus | 'all';

export function createModerationCaseListUrl({
  serverId,
  status,
  cursor,
  limit = 30
}: {
  serverId: string;
  status: ModerationCaseFilter;
  cursor?: ModerationCaseCursorResponse | null;
  limit?: number;
}) {
  const params = new URLSearchParams();

  if (status !== 'all') {
    params.set('status', status);
  }

  if (cursor) {
    params.set('beforeUpdatedAt', cursor.updatedAt);
    params.set('beforeId', cursor.id);
  }

  params.set('limit', String(limit));

  return `/api/servers/${serverId}/moderation/cases?${params.toString()}`;
}

export function mergeModerationCasePages(
  current: ModerationCaseSummaryResponse[],
  page: ModerationCasePageResponse
) {
  const merged = [...current];
  const indexById = new Map(
    merged.map((item, index) => [item.caseId.toLowerCase(), index])
  );

  page.items.forEach((item) => {
    const key = item.caseId.toLowerCase();
    const existingIndex = indexById.get(key);

    if (existingIndex === undefined) {
      indexById.set(key, merged.length);
      merged.push(item);
    } else {
      merged[existingIndex] = item;
    }
  });

  return merged;
}

export function replaceModerationCaseSummary(
  cases: ModerationCaseSummaryResponse[],
  update: Pick<ModerationCaseSummaryResponse, 'caseId' | 'status' | 'updatedAt'>
) {
  const target = cases.find(
    (item) => item.caseId.toLowerCase() === update.caseId.toLowerCase()
  );

  if (!target) {
    return cases;
  }

  return [
    {
      ...target,
      status: update.status,
      updatedAt: update.updatedAt
    },
    ...cases.filter(
      (item) => item.caseId.toLowerCase() !== update.caseId.toLowerCase()
    )
  ];
}
