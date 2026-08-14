import { useEffect, useState } from 'react'
import { apiJson, apiNoContent } from '../../../../shared/api/api'
import type { AssetResponse } from '../../../../shared/types'
import { settingsCopy } from '../../../shared/copy/index'

const profileBackgroundAssetTypeId = '16000000-0000-0000-0000-000000000000'
const maxUploadSizeBytes = 10 * 1024 * 1024

export const profileBackgroundAssetLimit = 10

export function useProfileBackgroundAssets(
  accessToken: string,
  isEnabled: boolean,
) {
  const [assets, setAssets] = useState<AssetResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    let isDisposed = false

    async function loadAssets() {
      setIsLoading(true)
      setError(null)

      try {
        const data = await apiJson<AssetResponse[]>(
          '/api/assets/me/profile-background',
          { accessToken },
        )

        if (!isDisposed) {
          setAssets(data)
        }
      } catch (requestError) {
        if (!isDisposed) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : settingsCopy.errors.loadBackgrounds,
          )
        }
      } finally {
        if (!isDisposed) {
          setIsLoading(false)
        }
      }
    }

    void loadAssets()

    return () => {
      isDisposed = true
    }
  }, [accessToken, isEnabled])

  async function upload(file: File | undefined) {
    if (!file) {
      return null
    }

    if (!file.type.startsWith('image/')) {
      setError(settingsCopy.errors.backgroundMustBeImage)
      return null
    }

    if (file.size > maxUploadSizeBytes) {
      setError(settingsCopy.errors.backgroundTooLarge)
      return null
    }

    if (assets.length >= profileBackgroundAssetLimit) {
      setError(settingsCopy.errors.backgroundLimit)
      return null
    }

    const formData = new FormData()
    formData.append('AssetTypeId', profileBackgroundAssetTypeId)
    formData.append('File', file)

    setIsUploading(true)
    setError(null)

    try {
      const asset = await apiJson<AssetResponse>('/api/assets/upload', {
        method: 'POST',
        accessToken,
        body: formData,
      })

      setAssets((current) => [asset, ...current])
      return asset
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : settingsCopy.errors.uploadBackground,
      )
      return null
    } finally {
      setIsUploading(false)
    }
  }

  async function remove(assetId: string) {
    setDeletingAssetId(assetId)
    setError(null)

    try {
      await apiNoContent(`/api/assets/${assetId}`, {
        method: 'DELETE',
        accessToken,
      })

      setAssets((current) => current.filter((asset) => asset.id !== assetId))
      return true
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : settingsCopy.errors.deleteBackground,
      )
      return false
    } finally {
      setDeletingAssetId(null)
    }
  }

  return {
    assets,
    isLoading,
    isUploading,
    deletingAssetId,
    error,
    upload,
    remove,
  }
}
