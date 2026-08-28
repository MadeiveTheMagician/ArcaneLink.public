import { expect, test } from '@playwright/test'
import type { SpaceMessageAssetResponse } from '../../src/shared/types'
import { getAdjacentMessagePreviewAsset } from '../../src/system/Server/components/messages/messageAssetPreviewModel'

const assets: SpaceMessageAssetResponse[] = [
  createAsset('first-image', 'image/png', 0),
  createAsset('document', 'application/pdf', 1),
  createAsset('middle-video', 'video/mp4', 2),
  createAsset('last-image', 'image/jpeg', 3),
]

test.describe('message asset preview navigation', () => {
  test('moves through image and video assets while skipping files', () => {
    expect(
      getAdjacentMessagePreviewAsset(assets, 'first-image', 'next')?.assetId,
    ).toBe('middle-video')
    expect(
      getAdjacentMessagePreviewAsset(assets, 'middle-video', 'previous')
        ?.assetId,
    ).toBe('first-image')
    expect(
      getAdjacentMessagePreviewAsset(assets, 'middle-video', 'next')?.assetId,
    ).toBe('last-image')
  })

  test('stops at the first and last previewable asset', () => {
    expect(
      getAdjacentMessagePreviewAsset(assets, 'first-image', 'previous'),
    ).toBeNull()
    expect(
      getAdjacentMessagePreviewAsset(assets, 'last-image', 'next'),
    ).toBeNull()
  })

  test('does not navigate from a missing or non-previewable asset', () => {
    expect(
      getAdjacentMessagePreviewAsset(assets, 'missing', 'next'),
    ).toBeNull()
    expect(
      getAdjacentMessagePreviewAsset(assets, 'document', 'next'),
    ).toBeNull()
  })
})

function createAsset(
  assetId: string,
  mimeType: string,
  displayOrder: number,
): SpaceMessageAssetResponse {
  return {
    assetId,
    createdAt: '2026-08-13T00:00:00.000Z',
    displayOrder,
    fileName: assetId,
    isSpoiler: false,
    mimeType,
    sizeBytes: 1,
  }
}
