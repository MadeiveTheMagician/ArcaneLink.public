import { expect, test } from '@playwright/test'
import type { SpaceMessageResponse } from '../../src/shared/types'
import {
  getOldestMessageCursor,
  hasOlderMessagePage,
  mergeLatestMessagePage,
  messageHistoryPageSize,
  prependOlderMessagePage,
} from '../../src/system/Server/hooks/messages/messagePaginationModel'

function message(
  id: string,
  createdAt: string,
  body = id,
): SpaceMessageResponse {
  return {
    id,
    createdAt,
    body,
  } as SpaceMessageResponse
}

test.describe('server message pagination model', () => {
  test('uses the oldest loaded message as a composite cursor', () => {
    expect(
      getOldestMessageCursor([
        message('oldest', '2026-07-01T10:00:00.000Z'),
        message('newest', '2026-07-01T11:00:00.000Z'),
      ]),
    ).toEqual({
      createdAt: '2026-07-01T10:00:00.000Z',
      id: 'oldest',
    })
    expect(getOldestMessageCursor([])).toBeNull()
  })

  test('prepends older messages without duplicating an overlapping item', () => {
    const currentOldest = message(
      'current-oldest',
      '2026-07-01T10:00:00.000Z',
      'current version',
    )
    const result = prependOlderMessagePage(
      [
        currentOldest,
        message('newest', '2026-07-01T11:00:00.000Z'),
      ],
      [
        message('oldest', '2026-07-01T09:00:00.000Z'),
        message(
          'current-oldest',
          '2026-07-01T10:00:00.000Z',
          'stale page version',
        ),
      ],
    )

    expect(result.map((item) => item.id)).toEqual([
      'oldest',
      'current-oldest',
      'newest',
    ])
    expect(result[1]).toBe(currentOldest)
  })

  test('merges a realtime latest page without discarding loaded history', () => {
    const result = mergeLatestMessagePage(
      [
        message('oldest', '2026-07-01T09:00:00.000Z'),
        message('overlap', '2026-07-01T10:00:00.000Z', 'old body'),
      ],
      [
        message('overlap', '2026-07-01T10:00:00.000Z', 'updated body'),
        message('newest', '2026-07-01T11:00:00.000Z'),
      ],
    )

    expect(result.map((item) => item.id)).toEqual([
      'oldest',
      'overlap',
      'newest',
    ])
    expect(result[1]?.body).toBe('updated body')
  })

  test('drops a deleted message from the refreshed latest window', () => {
    const result = mergeLatestMessagePage(
      [
        message('history', '2026-07-01T09:00:00.000Z'),
        message('still-visible', '2026-07-01T10:00:00.000Z'),
        message('deleted-remotely', '2026-07-01T10:30:00.000Z'),
      ],
      [
        message('still-visible', '2026-07-01T10:00:00.000Z'),
        message('newest', '2026-07-01T11:00:00.000Z'),
      ],
    )

    expect(result.map((item) => item.id)).toEqual([
      'history',
      'still-visible',
      'newest',
    ])
  })

  test('keeps requesting older pages only after a full page', () => {
    const fullPage = Array.from({ length: messageHistoryPageSize }, (_, index) =>
      message(String(index), `2026-07-01T10:00:${String(index).padStart(2, '0')}Z`),
    )

    expect(hasOlderMessagePage(fullPage)).toBe(true)
    expect(hasOlderMessagePage(fullPage.slice(1))).toBe(false)
  })
})
