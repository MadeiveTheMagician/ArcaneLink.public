import { expect, test } from '@playwright/test'
import type {
  PrivateSpaceResponse,
  PrivateSpaceViewerSettingsResponse,
} from '../../src/shared/types'
import {
  getPrivateSpaceViewerAvatar,
  maxPrivateSpaceAvatarUploadSizeBytes,
  validatePrivateSpaceAvatarFile,
} from '../../src/system/Hub/components/private-space/privateSpaceAvatarModel'

const viewerSettings: PrivateSpaceViewerSettingsResponse = {
  note: null,
  customNickname: null,
  customAvatarAssetId: 'viewer-avatar',
  customAvatarCropOffsetX: 0.12,
  customAvatarCropOffsetY: -0.08,
  customAvatarCropZoom: 1.4,
  mutedUntil: null,
  isMutedIndefinitely: false,
  isPeerBlocked: false,
}

test.describe('private space personal avatar model', () => {
  test('accepts supported images up to and including 10 MB', () => {
    expect(
      validatePrivateSpaceAvatarFile({
        size: maxPrivateSpaceAvatarUploadSizeBytes,
        type: 'image/webp',
      }),
    ).toBeNull()
  })

  test('rejects oversized and unsupported files', () => {
    expect(
      validatePrivateSpaceAvatarFile({
        size: maxPrivateSpaceAvatarUploadSizeBytes + 1,
        type: 'image/png',
      }),
    ).toBe('too-large')
    expect(
      validatePrivateSpaceAvatarFile({
        size: 128,
        type: 'image/svg+xml',
      }),
    ).toBe('unsupported-type')
  })

  test('resolves the viewer avatar independently of Direct or Group kind', () => {
    for (const kind of ['direct', 'group'] as const) {
      const space = {
        kind,
        viewerSettings,
      } as Pick<PrivateSpaceResponse, 'kind' | 'viewerSettings'>

      expect(getPrivateSpaceViewerAvatar(space)).toEqual({
        assetId: 'viewer-avatar',
        cropOffsetX: 0.12,
        cropOffsetY: -0.08,
        cropZoom: 1.4,
      })
    }
  })

  test('keeps the original avatar when no viewer avatar is configured', () => {
    expect(
      getPrivateSpaceViewerAvatar({
        viewerSettings: {
          ...viewerSettings,
          customAvatarAssetId: null,
        },
      }),
    ).toBeNull()
  })
})
