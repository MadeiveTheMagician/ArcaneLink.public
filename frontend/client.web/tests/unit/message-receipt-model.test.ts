import { expect, test } from '@playwright/test'
import type { SpaceMessageResponse } from '../../src/shared/types'
import { resolvePrivateMessageReceiptIndicator } from '../../src/system/Server/components/messages/messageReceiptModel'

type ReceiptMessage = Pick<
  SpaceMessageResponse,
  'deletedAt' | 'receipt' | 'senderUserId'
>

function message(
  overrides: Partial<ReceiptMessage> = {},
): ReceiptMessage {
  return {
    deletedAt: null,
    receipt: {
      statusCode: 'delivered',
      recipientCount: 1,
      readByCount: 0,
      readAt: null,
    },
    senderUserId: 'current-user',
    ...overrides,
  }
}

test.describe('private message receipt indicator', () => {
  test('shows one check for an outgoing delivered message', () => {
    expect(
      resolvePrivateMessageReceiptIndicator(
        message(),
        'current-user',
      ),
    ).toEqual({
      status: 'delivered',
      marks: '✓',
      label: 'Доставлено',
    })
  })

  test('shows two checks for an outgoing message read by all recipients', () => {
    expect(
      resolvePrivateMessageReceiptIndicator(
        message({
          receipt: {
            statusCode: 'read',
            recipientCount: 2,
            readByCount: 2,
            readAt: '2026-07-28T11:00:00.000Z',
          },
        }),
        'current-user',
      ),
    ).toEqual({
      status: 'read',
      marks: '✓✓',
      label: 'Прочитано',
    })
  })

  test('hides receipts for incoming, deleted and non-private messages', () => {
    expect(
      resolvePrivateMessageReceiptIndicator(
        message({ senderUserId: 'another-user' }),
        'current-user',
      ),
    ).toBeNull()
    expect(
      resolvePrivateMessageReceiptIndicator(
        message({ deletedAt: '2026-07-28T11:00:00.000Z' }),
        'current-user',
      ),
    ).toBeNull()
    expect(
      resolvePrivateMessageReceiptIndicator(
        message({ receipt: null }),
        'current-user',
      ),
    ).toBeNull()
    expect(
      resolvePrivateMessageReceiptIndicator(message(), null),
    ).toBeNull()
  })
})
