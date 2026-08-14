import { expect, test } from '@playwright/test'
import type {
  PrivateDeletedMessageResponse,
  SpaceMessageResponse,
} from '../../src/shared/types'
import {
  getPrivateMessageDeletionScopes,
  isPrivateMessageRestorable,
  isVisiblePrivateMessage,
} from '../../src/system/shared/messages/privateMessageDeletionModel'

function message(
  senderUserId: string,
  deletedAt: string | null = null,
): Pick<SpaceMessageResponse, 'deletedAt' | 'senderUserId'> {
  return { deletedAt, senderUserId }
}

test.describe('private message deletion model', () => {
  test('always allows hiding a visible message and only lets the sender delete for everyone', () => {
    expect(getPrivateMessageDeletionScopes(message('current'), 'current')).toEqual([
      'me',
      'everyone',
    ])
    expect(getPrivateMessageDeletionScopes(message('other'), 'current')).toEqual([
      'me',
    ])
    expect(
      getPrivateMessageDeletionScopes(
        message('current', '2026-07-22T10:00:00Z'),
        'current',
      ),
    ).toEqual([])
  })

  test('filters tombstones out of the private timeline', () => {
    expect(isVisiblePrivateMessage({ deletedAt: null })).toBe(true)
    expect(
      isVisiblePrivateMessage({ deletedAt: '2026-07-22T10:00:00Z' }),
    ).toBe(false)
  })

  test('only enables restore before the server deadline', () => {
    const deletion = {
      restoreUntil: '2026-07-23T10:00:00Z',
    } as Pick<PrivateDeletedMessageResponse, 'restoreUntil'>

    expect(
      isPrivateMessageRestorable(deletion, Date.parse('2026-07-23T09:59:59Z')),
    ).toBe(true)
    expect(
      isPrivateMessageRestorable(deletion, Date.parse('2026-07-23T10:00:00Z')),
    ).toBe(false)
    expect(isPrivateMessageRestorable({ restoreUntil: 'invalid' }, 0)).toBe(false)
  })
})
