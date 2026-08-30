import type { SpaceMessageResponse } from '../../../shared/types';

export type MessagePinnedEvent = {
  kind: 'message_pinned';
  messageId: string;
};

export function getMessagePinnedEvent(
  message: Pick<SpaceMessageResponse, 'messageTypeCode' | 'payload'>
): MessagePinnedEvent | null {
  if (message.messageTypeCode !== 'event' || !message.payload) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(message.payload);

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('kind' in payload) ||
      payload.kind !== 'message_pinned' ||
      !('messageId' in payload) ||
      typeof payload.messageId !== 'string' ||
      payload.messageId.length === 0
    ) {
      return null;
    }

    return {
      kind: 'message_pinned',
      messageId: payload.messageId
    };
  } catch {
    return null;
  }
}
