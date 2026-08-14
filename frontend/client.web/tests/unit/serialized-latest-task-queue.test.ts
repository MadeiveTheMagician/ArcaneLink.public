import { expect, test } from '@playwright/test'
import { createSerializedLatestTaskQueue } from '../../src/system/Profile/hooks/serializedLatestTaskQueue'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

test.describe('serialized latest task queue', () => {
  test('serializes writes and marks a superseded response as stale', async () => {
    const queue = createSerializedLatestTaskQueue<string>()
    const first = deferred<string>()
    const second = deferred<string>()
    let secondStarted = false

    const firstResult = queue.enqueue(() => first.promise)
    const secondResult = queue.enqueue(() => {
      secondStarted = true
      return second.promise
    })

    await Promise.resolve()
    expect(secondStarted).toBe(false)
    expect(queue.getPendingCount()).toBe(2)

    first.resolve('first')
    await expect(firstResult).resolves.toMatchObject({
      value: 'first',
      isLatest: false,
    })
    expect(secondStarted).toBe(true)
    expect(queue.getPendingCount()).toBe(1)

    second.resolve('second')
    await expect(secondResult).resolves.toMatchObject({
      value: 'second',
      isLatest: true,
    })
    expect(queue.getPendingCount()).toBe(0)
  })

  test('continues with the newest queued write after an earlier failure', async () => {
    const queue = createSerializedLatestTaskQueue<string>()
    const first = deferred<string>()
    const second = deferred<string>()
    const firstResult = queue.enqueue(() => first.promise)
    const secondResult = queue.enqueue(() => second.promise)

    first.reject(new Error('first failed'))
    await expect(firstResult).rejects.toThrow('first failed')

    second.resolve('second')
    await expect(secondResult).resolves.toMatchObject({
      value: 'second',
      isLatest: true,
    })
  })
})
