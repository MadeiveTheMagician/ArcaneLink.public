import { expect, test } from '@playwright/test'
import type { SpaceMessageResponse } from '../../src/shared/types'
import {
  canDeleteMessage,
  canEditMessage,
  canShowEditMessageAction,
} from '../../src/system/Server/components/messages/messageMutationPermissions'

function message(
  senderUserId: string,
  deletedAt: string | null = null,
  body: string | null = 'Message body',
): Pick<SpaceMessageResponse, 'body' | 'deletedAt' | 'senderUserId'> {
  return { body, deletedAt, senderUserId }
}

test.describe('message mutation permissions', () => {
  test('only the sender with send access can edit a message', () => {
    expect(canEditMessage(message('current'), 'current', true)).toBe(true)
    expect(canEditMessage(message('other'), 'current', true)).toBe(false)
    expect(canEditMessage(message('current'), 'current', false)).toBe(false)
    expect(
      canEditMessage(message('current', '2026-07-21T00:00:00Z'), 'current', true),
    ).toBe(false)
  })

  test('server managers retain delete access without granting it to ordinary members', () => {
    const foreignMessage = message('other')

    expect(canEditMessage(foreignMessage, 'current', true)).toBe(false)
    expect(canDeleteMessage(foreignMessage, 'current', true, true)).toBe(true)
    expect(canDeleteMessage(foreignMessage, 'current', true, false)).toBe(false)
    expect(canDeleteMessage(message('current'), 'current', true, false)).toBe(true)
    expect(canDeleteMessage(message('current'), 'current', false, false)).toBe(false)
    expect(
      canDeleteMessage(
        message('current', '2026-07-22T00:00:00Z'),
        'current',
        true,
        true,
      ),
    ).toBe(false)
  })

  test('shows the edit action only for an editable text message', () => {
    expect(canShowEditMessageAction(message('current'), 'current', true)).toBe(true)
    expect(canShowEditMessageAction(message('other'), 'current', true)).toBe(false)
    expect(canShowEditMessageAction(message('current'), 'current', false)).toBe(false)
    expect(
      canShowEditMessageAction(
        message('current', '2026-07-22T00:00:00Z'),
        'current',
        true,
      ),
    ).toBe(false)
    expect(
      canShowEditMessageAction(message('current', null, null), 'current', true),
    ).toBe(false)
    expect(
      canShowEditMessageAction(message('current', null, ''), 'current', true),
    ).toBe(false)
  })
})
