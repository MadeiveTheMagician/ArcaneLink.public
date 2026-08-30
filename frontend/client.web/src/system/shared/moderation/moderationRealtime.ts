export const moderationCaseChangedWindowEvent =
  'arcanelink:moderation-case-changed';
export const myModerationReportsChangedWindowEvent =
  'arcanelink:my-moderation-reports-changed';

export type ModerationCaseChangedPayload = {
  serverId?: string | null;
  caseId?: string | null;
};

export type MyModerationReportsChangedPayload = {
  serverId?: string | null;
  messageId?: string | null;
  updatedAt?: string | null;
};

export function isModerationEventForServer(
  payload: ModerationCaseChangedPayload | undefined,
  serverId: string
) {
  return Boolean(
    payload?.serverId &&
    payload.serverId.toLowerCase() === serverId.toLowerCase()
  );
}
