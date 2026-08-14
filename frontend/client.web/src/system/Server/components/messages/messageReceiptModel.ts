import type { SpaceMessageResponse } from '../../../../shared/types'

export type PrivateMessageReceiptIndicator = {
  status: 'delivered' | 'read'
  marks: '✓' | '✓✓'
  label: 'Доставлено' | 'Прочитано'
}

type ReceiptMessage = Pick<
  SpaceMessageResponse,
  'deletedAt' | 'receipt' | 'senderUserId'
>

export function resolvePrivateMessageReceiptIndicator(
  message: ReceiptMessage,
  viewerUserId?: string | null,
): PrivateMessageReceiptIndicator | null {
  if (
    !viewerUserId ||
    message.senderUserId !== viewerUserId ||
    message.deletedAt ||
    !message.receipt
  ) {
    return null
  }

  if (message.receipt.statusCode === 'read') {
    return {
      status: 'read',
      marks: '✓✓',
      label: 'Прочитано',
    }
  }

  return {
    status: 'delivered',
    marks: '✓',
    label: 'Доставлено',
  }
}
