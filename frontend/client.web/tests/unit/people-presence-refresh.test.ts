import { expect, test } from '@playwright/test'
import {
  shouldRefreshPeopleDiscoveryForPresence,
} from '../../src/system/Hub/components/community/peoplePresenceRefreshModel'
import type { CommunityPeopleSort } from '../../src/system/Hub/components/community/communityTypes'
import { createRealtimeRefreshCoalescer } from '../../src/system/shared/hooks/realtimeRefreshCoalescer'

test.describe('people discovery presence refresh', () => {
  test('reloads every presence-dependent people query, including recent sort', () => {
    for (const sort of [
      'recommended',
      'online',
      'recent',
    ] satisfies CommunityPeopleSort[]) {
      expect(
        shouldRefreshPeopleDiscoveryForPresence({
          activeTab: 'people',
          onlineOnly: false,
          sort,
        }),
      ).toBe(true)
    }

    expect(
      shouldRefreshPeopleDiscoveryForPresence({
        activeTab: 'friends',
        onlineOnly: true,
        sort: 'recommended',
      }),
    ).toBe(false)
  })

  test('coalesces a presence burst into one request and one follow-up', async () => {
    let callCount = 0
    let concurrentCount = 0
    let maximumConcurrentCount = 0
    let releaseFirstRequest: (() => void) | null = null
    const firstRequest = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve
    })
    const coalescer = createRealtimeRefreshCoalescer(async () => {
      callCount += 1
      concurrentCount += 1
      maximumConcurrentCount = Math.max(
        maximumConcurrentCount,
        concurrentCount,
      )

      if (callCount === 1) {
        await firstRequest
      }

      concurrentCount -= 1
    }, 1)

    coalescer.request()
    coalescer.request()
    await waitFor(() => callCount === 1)

    coalescer.request()
    coalescer.request()
    releaseFirstRequest?.()
    await waitFor(() => callCount === 2)

    expect(callCount).toBe(2)
    expect(maximumConcurrentCount).toBe(1)
    coalescer.dispose()
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
