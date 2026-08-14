import { useState } from 'react'
import type { ImageCrop } from '../../../shared/media/ImageCropEditor'
import { apiJson, apiNoContent } from '../../../shared/api/api'
import type {
  AssetResponse,
  OwnUserProfileResponse,
} from '../../../shared/types'
import { profileCopy } from '../../shared'
import { useUserPresenceChanged } from '../../shared/hooks/useUserPresenceChanged'
import { patchPublicProfilePresence } from '../../shared/presence/presenceModel'
import {
  captureUserPresenceEventBoundary,
  reconcilePublicProfileWithLatestPresence,
} from '../../shared/presence/presenceEventStore'
import { useAssetImagePicker } from './useAssetImagePicker'

type AssetSort = 'newest' | 'oldest'

const maxAvatarUploadSizeBytes = 10 * 1024 * 1024
const allowedAvatarMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
])

type UseProfileAvatarOptions = {
  accessToken: string
  initialProfile: OwnUserProfileResponse
  sort: AssetSort
}

export function useProfileAvatar({
  accessToken,
  initialProfile,
  sort,
}: UseProfileAvatarOptions) {
  const [publicProfile, setPublicProfile] = useState(initialProfile)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  const [assetPendingDelete, setAssetPendingDelete] =
    useState<AssetResponse | null>(null)
  const [isDeletingAsset, setIsDeletingAsset] = useState(false)
  const [brokenAvatarUrls, setBrokenAvatarUrls] = useState<Set<string>>(
    () => new Set(),
  )

  useUserPresenceChanged((payload) => {
    setPublicProfile((current) =>
      patchPublicProfilePresence(current, payload),
    )
  })

  const avatarPicker = useAssetImagePicker({
    accessToken,
    libraryEndpoint: '/api/assets/me/avatar',
    sort,
  })

  const profileAvatarUrl = publicProfile.avatarAssetId
    ? `/api/assets/${publicProfile.avatarAssetId}/content`
    : '/brand/default-avatar.svg'
  const avatarSrc =
    avatarPicker.draft?.previewUrl ||
    (brokenAvatarUrls.has(profileAvatarUrl)
      ? '/brand/default-avatar.svg'
      : profileAvatarUrl)

  const avatarStyle = {
    transform: `translate(-50%, -50%) translate(${
      publicProfile.avatarCropOffsetX * 100
    }%, ${
      publicProfile.avatarCropOffsetY * 100
    }%) scale(${publicProfile.avatarCropZoom})`,
  }

  function markBrokenAvatar(url: string) {
    setBrokenAvatarUrls((current) => new Set(current).add(url))
  }

  async function loadPublicProfile() {
    const presenceBoundary = captureUserPresenceEventBoundary()
    const profile = reconcilePublicProfileWithLatestPresence(
      await apiJson<OwnUserProfileResponse>(
        '/api/users/me/profile',
        { accessToken },
      ),
      presenceBoundary,
    )

    setPublicProfile(profile)
  }

  function showAvatarLibrary() {
    setIsAvatarMenuOpen(false)
    avatarPicker.openLibrary()
  }

  function selectAvatarAsset(asset: AssetResponse) {
    avatarPicker.selectAsset(asset)
  }

  async function deleteAvatarAsset(asset: AssetResponse) {
    setIsDeletingAsset(true)

    try {
      await apiNoContent(`/api/assets/${asset.id}`, {
        method: 'DELETE',
        accessToken,
      })

      avatarPicker.removeAsset(asset.id)

      setPublicProfile((currentProfile) => {
        if (currentProfile.avatarAssetId !== asset.id) {
          return currentProfile
        }

        return {
          ...currentProfile,
          avatarAssetId: null,
          avatarSourceAssetId: null,
          avatarCropOffsetX: 0,
          avatarCropOffsetY: 0,
          avatarCropZoom: 1,
        }
      })

      setAssetPendingDelete(null)
    } finally {
      setIsDeletingAsset(false)
    }
  }

  function openAvatarPicker() {
    setIsAvatarMenuOpen(false)
    avatarPicker.fileInputRef.current?.click()
  }

  function selectAvatarFile(file: File | undefined) {
    setAvatarError(null)
    avatarPicker.selectFile(file)
  }

  function cancelAvatarChange() {
    setAvatarError(null)
    avatarPicker.cancelCrop()
  }

  async function confirmAvatarChange(crop: ImageCrop) {
    if (!avatarPicker.draft) {
      return
    }

    setIsSavingAvatar(true)
    setAvatarError(null)

    try {
      const assetId = avatarPicker.draft.assetId

      if (!assetId && avatarPicker.draft.file) {
        validateAvatarFile(avatarPicker.draft.file)

        const formData = new FormData()
        formData.append('File', avatarPicker.draft.file)
        formData.append('CropOffsetX', String(crop.offsetX))
        formData.append('CropOffsetY', String(crop.offsetY))
        formData.append('CropZoom', String(crop.zoom))

        const presenceBoundary = captureUserPresenceEventBoundary()
        const updatedProfile = reconcilePublicProfileWithLatestPresence(
          await apiJson<OwnUserProfileResponse>(
            '/api/users/me/profile/avatar/upload',
            {
              method: 'POST',
              accessToken,
              body: formData,
            },
          ),
          presenceBoundary,
        )

        setPublicProfile(updatedProfile)
        avatarPicker.completeCrop()

        await avatarPicker.loadAssets()
        return
      }

      if (!assetId) {
        throw new Error(profileCopy.errors.avatarAssetMissing)
      }

      const presenceBoundary = captureUserPresenceEventBoundary()
      const updatedProfile = reconcilePublicProfileWithLatestPresence(
        await apiJson<OwnUserProfileResponse>(
          `/api/users/me/profile/avatar/${assetId}`,
          {
            method: 'POST',
            accessToken,
            body: {
              cropOffsetX: crop.offsetX,
              cropOffsetY: crop.offsetY,
              cropZoom: crop.zoom,
            },
          },
        ),
        presenceBoundary,
      )

      setPublicProfile(updatedProfile)
      avatarPicker.completeCrop()

      await avatarPicker.loadAssets()
    } catch (error) {
      setAvatarError(getAvatarSaveError(error))
    } finally {
      setIsSavingAvatar(false)
    }
  }

  return {
    publicProfile,
    avatarPicker,
    avatarSrc,
    avatarStyle,
    isSavingAvatar,
    avatarError,
    isAvatarMenuOpen,
    assetPendingDelete,
    isDeletingAsset,
    brokenAvatarUrls,
    setIsAvatarMenuOpen,
    setAssetPendingDelete,
    markBrokenAvatar,
    loadPublicProfile,
    showAvatarLibrary,
    selectAvatarAsset,
    deleteAvatarAsset,
    openAvatarPicker,
    selectAvatarFile,
    cancelAvatarChange,
    confirmAvatarChange,
  }
}

function getAvatarSaveError(error: unknown) {
  if (!(error instanceof Error)) {
    return profileCopy.errors.avatarSaveFailed
  }

  const localErrors = new Set<string>([
    profileCopy.errors.avatarAssetMissing,
    profileCopy.errors.avatarTooLarge,
    profileCopy.errors.avatarUnsupportedType,
  ])

  return localErrors.has(error.message)
    ? error.message
    : profileCopy.errors.avatarSaveFailed
}

function validateAvatarFile(file: File) {
  if (file.size > maxAvatarUploadSizeBytes) {
    throw new Error(profileCopy.errors.avatarTooLarge)
  }

  if (!allowedAvatarMimeTypes.has(file.type)) {
    throw new Error(profileCopy.errors.avatarUnsupportedType)
  }
}
