import type { ServerMemberDetailsResponse } from '../../../../shared/types';

export const serverMemberPageSize = 100;
export const serverMemberLoadThreshold = 0.85;

export function mergeServerMemberPages(
  primary: ServerMemberDetailsResponse[],
  secondary: ServerMemberDetailsResponse[]
) {
  const seenMemberIds = new Set<string>();

  return [...primary, ...secondary].filter((member) => {
    if (seenMemberIds.has(member.id)) {
      return false;
    }

    seenMemberIds.add(member.id);
    return true;
  });
}

export function shouldLoadMoreServerMembers({
  scrollTop,
  clientHeight,
  scrollHeight
}: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}) {
  return (
    scrollHeight > 0 &&
    scrollTop + clientHeight >= scrollHeight * serverMemberLoadThreshold
  );
}
