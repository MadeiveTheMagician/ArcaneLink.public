import { expect, test } from '@playwright/test'
import type { SpaceMessageResponse } from '../../src/shared/types'
import {
  createReadMarkerCoordinator,
  getReadMarkerCandidate,
} from '../../src/system/Server/components/messages/messageReadMarkerModel'
import {
  createRealtimeRefreshCoalescer,
  getSpaceReadStateRefreshTargets,
} from '../../src/system/shared/hooks/realtimeRefreshCoalescer'
import {
  formatUnreadCount,
  getUnreadMessageLabel,
} from '../../src/system/shared/ui/unreadBadgeModel'
import { resolveMessageFocus } from '../../src/system/shared/messages/messageFocusModel'

function message(id: string, deletedAt: string | null = null) {
  return { id, deletedAt } as SpaceMessageResponse
}

test.describe('unread model', () => {
  test('caps visual counts at 99+ and normalizes invalid values', () => {
    expect(formatUnreadCount(4)).toBe('4')
    expect(formatUnreadCount(100)).toBe('99+')
    expect(formatUnreadCount(-2)).toBe('0')
    expect(formatUnreadCount(Number.NaN)).toBe('0')
    expect(getUnreadMessageLabel(145)).toBe(
      'Непрочитанных сообщений: 145',
    )
    expect(getUnreadMessageLabel(0)).toBeNull()
  })

  test('selects only the latest non-deleted message in a readable viewport', () => {
    const messages = [
      message('one'),
      message('two'),
      message('deleted', '2026-07-21T00:00:00Z'),
    ]

    expect(
      getReadMarkerCandidate({
        messages,
        isLoaded: true,
        isDocumentVisible: true,
        isNearBottom: true,
        isReadingHistory: false,
      }),
    ).toBe('two')

    for (const blockedState of [
      { isLoaded: false },
      { isDocumentVisible: false },
      { isNearBottom: false },
      { isReadingHistory: true },
    ]) {
      expect(
        getReadMarkerCandidate({
          messages,
          isLoaded: true,
          isDocumentVisible: true,
          isNearBottom: true,
          isReadingHistory: false,
          ...blockedState,
        }),
      ).toBeNull()
    }
  })

  test('deduplicates read markers per feed and keeps only the newest queued marker', async () => {
    const calls: string[] = []
    let releaseFirstRequest: (() => void) | null = null
    const firstRequest = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve
    })
    const coordinator = createReadMarkerCoordinator(async (request) => {
      calls.push(`${request.feedKey}:${request.messageId}`)
      if (calls.length === 1) {
        await firstRequest
      }
      return true
    })

    coordinator.activateFeed('server:space')
    coordinator.request({ feedKey: 'server:space', messageId: 'one' })
    coordinator.request({ feedKey: 'server:space', messageId: 'two' })
    coordinator.request({ feedKey: 'server:space', messageId: 'three' })
    releaseFirstRequest?.()
    await waitFor(() => calls.length === 2)

    expect(calls).toEqual(['server:space:one', 'server:space:three'])

    coordinator.request({ feedKey: 'server:space', messageId: 'three' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toHaveLength(2)
  })

  test('drops a queued marker when navigation activates another feed', async () => {
    const calls: string[] = []
    let releaseFirstRequest: (() => void) | null = null
    const firstRequest = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve
    })
    const coordinator = createReadMarkerCoordinator(async (request) => {
      calls.push(`${request.feedKey}:${request.messageId}`)
      if (calls.length === 1) {
        await firstRequest
      }
      return true
    })

    coordinator.activateFeed('feed-a')
    coordinator.request({ feedKey: 'feed-a', messageId: 'a-current' })
    coordinator.request({ feedKey: 'feed-a', messageId: 'a-queued' })
    coordinator.activateFeed('feed-b')
    coordinator.request({ feedKey: 'feed-a', messageId: 'a-stale' })
    releaseFirstRequest?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toEqual(['feed-a:a-current'])

    coordinator.request({ feedKey: 'feed-b', messageId: 'b-current' })
    await waitFor(() => calls.length === 2)

    expect(calls).toEqual(['feed-a:a-current', 'feed-b:b-current'])
  })

  test('debounces bursts and performs at most one follow-up while refreshing', async () => {
    let callCount = 0
    let releaseFirstRequest: (() => void) | null = null
    const firstRequest = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve
    })
    const coalescer = createRealtimeRefreshCoalescer(async () => {
      callCount += 1
      if (callCount === 1) {
        await firstRequest
      }
    }, 5)

    coalescer.request()
    coalescer.request()
    coalescer.request()
    await waitFor(() => callCount === 1)

    coalescer.request()
    coalescer.request()
    releaseFirstRequest?.()
    await waitFor(() => callCount === 2)

    expect(callCount).toBe(2)
    coalescer.dispose()
  })

  test('routes local and realtime read-state refreshes to the narrow list scope', () => {
    expect(getSpaceReadStateRefreshTargets(null, 'server-one')).toEqual({
      serverList: false,
      currentServerSpaces: false,
      privateSpaces: true,
    })
    expect(
      getSpaceReadStateRefreshTargets('SERVER-ONE', 'server-one'),
    ).toEqual({
      serverList: true,
      currentServerSpaces: true,
      privateSpaces: false,
    })
    expect(
      getSpaceReadStateRefreshTargets('server-two', 'server-one'),
    ).toEqual({
      serverList: true,
      currentServerSpaces: false,
      privateSpaces: false,
    })
  })

  test('ordinary navigation clears history while search navigation keeps its target', () => {
    expect(resolveMessageFocus({ kind: 'latest' })).toBeNull()
    expect(
      resolveMessageFocus({
        kind: 'search-result',
        message: {
          id: 'message-one',
          spaceId: 'space-one',
          createdAt: '2026-07-21T12:00:00Z',
        },
      }),
    ).toEqual({
      messageId: 'message-one',
      spaceId: 'space-one',
      createdAt: '2026-07-21T12:00:00Z',
    })
  })
})

async function waitFor(predicate: () => boolean) {
  const timeoutAt = Date.now() + 1000

  while (!predicate()) {
    if (Date.now() >= timeoutAt) {
      throw new Error('Timed out waiting for condition')
    }

    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}
