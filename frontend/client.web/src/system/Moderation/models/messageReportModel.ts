import type { SpaceMessageResponse } from '../../../shared/types';

export type ServerMessageReportContext = {
  accessToken: string;
  serverId: string;
  spaceId: string;
};

export function canReportServerMessage({
  context,
  currentUserId,
  message
}: {
  context?: ServerMessageReportContext | null;
  currentUserId: string;
  message: SpaceMessageResponse;
}) {
  return Boolean(
    context &&
    !message.deletedAt &&
    !sameId(message.senderUserId, currentUserId) &&
    sameId(message.serverId, context.serverId) &&
    sameId(message.spaceId, context.spaceId)
  );
}

function sameId(first: string, second: string) {
  return first.toLowerCase() === second.toLowerCase();
}
