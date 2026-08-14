import type { PrivateSpaceResponse } from '../../../../shared/types'

export const maxPrivateSpaceAvatarUploadSizeBytes = 10 * 1024 * 1024

export const supportedPrivateSpaceAvatarMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
] as const

const supportedMimeTypeSet = new Set<string>(
  supportedPrivateSpaceAvatarMimeTypes,
)

export type PrivateSpaceAvatarFileValidationError =
  | 'too-large'
  | 'unsupported-type'

export function validatePrivateSpaceAvatarFile(
  file: Pick<File, 'size' | 'type'>,
): PrivateSpaceAvatarFileValidationError | null {
  if (file.size > maxPrivateSpaceAvatarUploadSizeBytes) {
    return 'too-large'
  }

  if (!supportedMimeTypeSet.has(file.type)) {
    return 'unsupported-type'
  }

  return null
}

export function getPrivateSpaceViewerAvatar(
  space: Pick<PrivateSpaceResponse, 'viewerSettings'>,
) {
  const assetId = space.viewerSettings.customAvatarAssetId
  if (!assetId) {
    return null
  }

  return {
    assetId,
    cropOffsetX: space.viewerSettings.customAvatarCropOffsetX,
    cropOffsetY: space.viewerSettings.customAvatarCropOffsetY,
    cropZoom: space.viewerSettings.customAvatarCropZoom,
  }
}
