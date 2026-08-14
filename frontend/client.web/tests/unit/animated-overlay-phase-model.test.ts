import { expect, test } from '@playwright/test'
import {
  beginAnimatedOverlayClose,
  canRequestAnimatedOverlayClose,
  getAnimatedOverlayCloseDelayMs,
} from '../../src/system/shared/overlays/animatedOverlayPhaseModel'

test.describe('animated overlay phase model', () => {
  test('allows only one transition from open to closing', () => {
    expect(canRequestAnimatedOverlayClose('open')).toBe(true)
    expect(beginAnimatedOverlayClose('open')).toBe('closing')
    expect(canRequestAnimatedOverlayClose('closing')).toBe(false)
    expect(beginAnimatedOverlayClose('closing')).toBe('closing')
  })

  test('waits for the configured animation before finalizing close', () => {
    expect(getAnimatedOverlayCloseDelayMs(200, false)).toBe(200)
    expect(getAnimatedOverlayCloseDelayMs(-20, false)).toBe(0)
    expect(getAnimatedOverlayCloseDelayMs(Number.NaN, false)).toBe(0)
  })

  test('finalizes immediately when reduced motion is requested', () => {
    expect(getAnimatedOverlayCloseDelayMs(200, true)).toBe(0)
  })
})
