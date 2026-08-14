import { expect, test } from '@playwright/test'
import {
  blockingModalSelector,
  hasOpenBlockingModal,
  resolveMessageAssetDropDisposition,
} from '../../src/system/shared/messages/messageAssetDropModel'

test.describe('message asset drop blocking modal contract', () => {
  test('detects a blocking layer through the shared aria-modal marker', () => {
    let receivedSelector = ''
    const root = {
      querySelector(selector: string) {
        receivedSelector = selector
        return { role: 'dialog' }
      },
    }

    expect(hasOpenBlockingModal(root)).toBe(true)
    expect(receivedSelector).toBe(blockingModalSelector)
  })

  test('does not treat a non-modal popover as a blocking layer', () => {
    const root = {
      querySelector: () => null,
    }

    expect(hasOpenBlockingModal(root)).toBe(false)
    expect(hasOpenBlockingModal(null)).toBe(false)
  })

  test('rejects files while a blocking modal is open', () => {
    expect(
      resolveMessageAssetDropDisposition({
        canAccept: true,
        hasFiles: true,
        isBlockingModalOpen: true,
      }),
    ).toBe('reject')
  })

  test('accepts files with only a non-blocking popover open', () => {
    expect(
      resolveMessageAssetDropDisposition({
        canAccept: true,
        hasFiles: true,
        isBlockingModalOpen: false,
      }),
    ).toBe('accept')
  })

  test('ignores non-file drags and rejects disabled composers', () => {
    expect(
      resolveMessageAssetDropDisposition({
        canAccept: true,
        hasFiles: false,
        isBlockingModalOpen: true,
      }),
    ).toBe('ignore')
    expect(
      resolveMessageAssetDropDisposition({
        canAccept: false,
        hasFiles: true,
        isBlockingModalOpen: false,
      }),
    ).toBe('reject')
  })
})
