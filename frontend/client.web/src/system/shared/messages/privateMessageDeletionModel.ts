import type {
  PrivateDeletedMessageResponse,
  PrivateMessageDeletionScope,
  SpaceMessageResponse
} from '../../../shared/types';

type PrivateMessageDeletionTarget = Pick<
  SpaceMessageResponse,
  'deletedAt' | 'senderUserId'
>;

export function getPrivateMessageDeletionScopes(
  message: PrivateMessageDeletionTarget,
  currentUserId: string
): PrivateMessageDeletionScope[] {
  if (message.deletedAt) {
    return [];
  }

  return message.senderUserId === currentUserId ? ['me', 'everyone'] : ['me'];
}

export function isVisiblePrivateMessage(
  message: Pick<SpaceMessageResponse, 'deletedAt'>
) {
  return !message.deletedAt;
}

export function isPrivateMessageRestorable(
  deletion: Pick<PrivateDeletedMessageResponse, 'restoreUntil'>,
  now = Date.now()
) {
  const restoreUntil = Date.parse(deletion.restoreUntil);

  return Number.isFinite(restoreUntil) && restoreUntil > now;
}
