import { expect, test } from '@playwright/test'
import {
  createSystemSkeletonPresencePhase,
  defaultSystemSkeletonPresenceTiming,
  getSystemSkeletonPresenceDelayMs,
  isSystemSkeletonPresenceMounted,
  reduceSystemSkeletonPresence,
} from '../../src/system/shared/ui/systemSkeletonPresenceModel'

test.describe('system skeleton presence model', () => {
  test('cancels a fast loading state before the delayed reveal', () => {
    const waiting = createSystemSkeletonPresencePhase(true)
    const hidden = reduceSystemSkeletonPresence(waiting, 'hide')

    expect(waiting).toBe('waiting')
    expect(hidden).toBe('hidden')
    expect(isSystemSkeletonPresenceMounted(hidden)).toBe(false)
  })

  test('keeps a revealed skeleton mounted until its exit completes', () => {
    const entering = reduceSystemSkeletonPresence('waiting', 'reveal')
    const visible = reduceSystemSkeletonPresence(entering, 'entered')
    const exiting = reduceSystemSkeletonPresence(visible, 'hide')

    expect(entering).toBe('entering')
    expect(visible).toBe('visible')
    expect(exiting).toBe('exiting')
    expect(isSystemSkeletonPresenceMounted(exiting)).toBe(true)
    expect(reduceSystemSkeletonPresence(exiting, 'exited')).toBe('hidden')
  })

  test('reverses an exit when loading starts again', () => {
    expect(reduceSystemSkeletonPresence('exiting', 'show')).toBe('entering')
  })

  test('uses a delayed reveal, smooth exit and instant reduced-motion fades', () => {
    const timing = defaultSystemSkeletonPresenceTiming

    expect(
      getSystemSkeletonPresenceDelayMs('waiting', timing, false),
    ).toBe(140)
    expect(
      getSystemSkeletonPresenceDelayMs('entering', timing, false),
    ).toBe(160)
    expect(
      getSystemSkeletonPresenceDelayMs('exiting', timing, false),
    ).toBe(160)
    expect(
      getSystemSkeletonPresenceDelayMs('entering', timing, true),
    ).toBe(0)
    expect(
      getSystemSkeletonPresenceDelayMs('exiting', timing, true),
    ).toBe(0)
  })
})
