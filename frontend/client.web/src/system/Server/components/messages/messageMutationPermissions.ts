import type { SpaceMessageResponse } from '../../../../shared/types';

type MessageMutationTarget = Pick<
  SpaceMessageResponse,
  'deletedAt' | 'senderUserId'
>;

type EditableMessageTarget = MessageMutationTarget &
  Pick<SpaceMessageResponse, 'body'>;

export function canEditMessage(
  message: MessageMutationTarget,
  currentUserId: string,
  canSendMessages: boolean
) {
  return (
    !message.deletedAt &&
    canSendMessages &&
    message.senderUserId === currentUserId
  );
}

export function canDeleteMessage(
  message: MessageMutationTarget,
  currentUserId: string,
  canSendMessages: boolean,
  canManageMessages: boolean
) {
  return (
    !message.deletedAt &&
    (canManageMessages ||
      (canSendMessages && message.senderUserId === currentUserId))
  );
}

export function canShowEditMessageAction(
  message: EditableMessageTarget,
  currentUserId: string,
  canSendMessages: boolean
) {
  return (
    Boolean(message.body) &&
    canEditMessage(message, currentUserId, canSendMessages)
  );
}
