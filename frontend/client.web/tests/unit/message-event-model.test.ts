import { expect, test } from '@playwright/test'
import { getMessagePinnedEvent } from '../../src/system/shared/messages/messageEventModel'

test.describe('message event model', () => {
  test('parses a persisted message pin event', () => {
    expect(
      getMessagePinnedEvent({
        messageTypeCode: 'event',
        payload: JSON.stringify({
          kind: 'message_pinned',
          messageId: 'message-42',
        }),
      }),
    ).toEqual({
      kind: 'message_pinned',
      messageId: 'message-42',
    })
  })

  test('ignores text messages and malformed event payloads', () => {
    expect(
      getMessagePinnedEvent({
        messageTypeCode: 'text',
        payload: JSON.stringify({
          kind: 'message_pinned',
          messageId: 'message-42',
        }),
      }),
    ).toBeNull()
    expect(
      getMessagePinnedEvent({
        messageTypeCode: 'event',
        payload: '{not-json',
      }),
    ).toBeNull()
    expect(
      getMessagePinnedEvent({
        messageTypeCode: 'event',
        payload: JSON.stringify({ kind: 'message_pinned' }),
      }),
    ).toBeNull()
  })
})
