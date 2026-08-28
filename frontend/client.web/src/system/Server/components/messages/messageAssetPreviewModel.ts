import type { SpaceMessageAssetResponse } from '../../../../shared/types';

export type MessageAssetPreviewDirection = 'previous' | 'next';

export function getAdjacentMessagePreviewAsset(
  assets: readonly SpaceMessageAssetResponse[],
  currentAssetId: string,
  direction: MessageAssetPreviewDirection
) {
  const previewableAssets = assets.filter(isPreviewableMessageAsset);
  const currentIndex = previewableAssets.findIndex(
    (asset) => asset.assetId === currentAssetId
  );
  if (currentIndex < 0) return null;

  const nextIndex = currentIndex + (direction === 'next' ? 1 : -1);
  return previewableAssets[nextIndex] ?? null;
}

export function isPreviewableMessageAsset(asset: SpaceMessageAssetResponse) {
  const mimeType = asset.mimeType.toLowerCase();
  return mimeType.startsWith('image/') || mimeType.startsWith('video/');
}
