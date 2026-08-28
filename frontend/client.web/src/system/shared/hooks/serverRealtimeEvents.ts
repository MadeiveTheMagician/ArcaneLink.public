export const serverDirectoryChangedWindowEvent =
  'arcanelink:server-directory-changed';

export type ServerJoinRequestChangedPayload = {
  requestId?: string | null;
  serverId?: string | null;
};
