import { expect, test } from '@playwright/test'
import {
  WebNotificationTimerScheduler,
  type WebNotificationTimerAdapter,
} from '../../src/system/Hub/components/notifications/webNotificationTimerScheduler'

function createFakeTimer() {
  let nextHandle = 1
  const callbacks = new Map<number, () => void>()
  const adapter: WebNotificationTimerAdapter = {
    set(callback) {
      const handle = nextHandle++
      callbacks.set(handle, callback)
      return handle
    },
    clear(handle) {
      callbacks.delete(handle as number)
    },
  }

  return {
    adapter,
    pendingCount: () => callbacks.size,
    fireNext() {
      const entry = callbacks.entries().next().value as
        | [number, () => void]
        | undefined
      if (!entry) {
        return
      }

      callbacks.delete(entry[0])
      entry[1]()
    },
  }
}

test.describe('web notification timer scheduler', () => {
  test('reschedules visible notifications after pause without losing them', () => {
    const timer = createFakeTimer()
    const elapsed: string[] = []
    const scheduler = new WebNotificationTimerScheduler(timer.adapter, 9000)

    scheduler.track('message-1', false, () => elapsed.push('message-1'))
    expect(timer.pendingCount()).toBe(1)

    scheduler.pause()
    expect(timer.pendingCount()).toBe(0)

    scheduler.resume()
    expect(timer.pendingCount()).toBe(1)
    timer.fireNext()

    expect(elapsed).toEqual(['message-1'])
    expect(timer.pendingCount()).toBe(0)
  })

  test('does not schedule persistent notifications and forgets evicted items', () => {
    const timer = createFakeTimer()
    const elapsed: string[] = []
    const scheduler = new WebNotificationTimerScheduler(timer.adapter, 9000)

    scheduler.track('invite-1', true, () => elapsed.push('invite-1'))
    scheduler.track('message-1', false, () => elapsed.push('message-1'))
    scheduler.retain(new Set(['invite-1']))

    expect(timer.pendingCount()).toBe(0)
    timer.fireNext()
    expect(elapsed).toEqual([])
  })

  test('clears every pending timer on dispose', () => {
    const timer = createFakeTimer()
    const scheduler = new WebNotificationTimerScheduler(timer.adapter, 9000)

    scheduler.track('message-1', false, () => undefined)
    scheduler.track('message-2', false, () => undefined)
    scheduler.dispose()

    expect(timer.pendingCount()).toBe(0)
  })
})
