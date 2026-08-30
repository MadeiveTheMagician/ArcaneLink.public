import { useEffect, useState } from 'react';

import { apiJson, apiNoContent } from '../../../../shared/api/api';
import type {
  AssetResponse,
  OwnUserProfileResponse
} from '../../../../shared/types';
import { settingsCopy } from '../../../shared/copy';

const maxUploadSizeBytes = 10 * 1024 * 1024;

export const profileBannerAssetLimit = 10;

export function useProfileBannerAssets(
  accessToken: string,
  isEnabled: boolean
) {
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [changingAssetId, setChangingAssetId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEnabled) return undefined;

    let isDisposed = false;

    async function loadAssets() {
      setIsLoading(true);
      setError(null);

      try {
        const [ownedAssets, profile] = await Promise.all([
          apiJson<AssetResponse[]>('/api/assets/me/banner', { accessToken }),
          apiJson<OwnUserProfileResponse>('/api/users/me/profile', {
            accessToken
          })
        ]);

        if (!isDisposed) {
          setAssets(ownedAssets);
          setSelectedAssetId(profile.bannerAssetId);
        }
      } catch (requestError) {
        if (!isDisposed) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : settingsCopy.errors.loadBanners
          );
        }
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    }

    void loadAssets();
    return () => {
      isDisposed = true;
    };
  }, [accessToken, isEnabled]);

  async function upload(file: File | undefined) {
    if (!file) return false;

    if (!file.type.startsWith('image/')) {
      setError(settingsCopy.errors.bannerMustBeImage);
      return false;
    }

    if (file.size > maxUploadSizeBytes) {
      setError(settingsCopy.errors.bannerTooLarge);
      return false;
    }

    if (assets.length >= profileBannerAssetLimit) {
      setError(settingsCopy.errors.bannerLimit);
      return false;
    }

    const formData = new FormData();
    formData.append('File', file);
    setIsUploading(true);
    setError(null);

    try {
      const profile = await apiJson<OwnUserProfileResponse>(
        '/api/users/me/profile/banner/upload',
        {
          method: 'POST',
          accessToken,
          body: formData
        }
      );
      const ownedAssets = await apiJson<AssetResponse[]>(
        '/api/assets/me/banner',
        { accessToken }
      );
      setAssets(ownedAssets);
      setSelectedAssetId(profile.bannerAssetId);
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : settingsCopy.errors.uploadBanner
      );
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  async function select(assetId: string | null) {
    setChangingAssetId(assetId ?? 'none');
    setError(null);

    try {
      const profile = assetId
        ? await apiJson<OwnUserProfileResponse>(
            `/api/users/me/profile/banner/${assetId}`,
            { method: 'POST', accessToken }
          )
        : await apiJson<OwnUserProfileResponse>(
            '/api/users/me/profile/banner',
            { method: 'DELETE', accessToken }
          );
      setSelectedAssetId(profile.bannerAssetId);
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : settingsCopy.errors.saveBanner
      );
      return false;
    } finally {
      setChangingAssetId(null);
    }
  }

  async function remove(assetId: string) {
    setDeletingAssetId(assetId);
    setError(null);

    try {
      await apiNoContent(`/api/assets/${assetId}`, {
        method: 'DELETE',
        accessToken
      });
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
      if (selectedAssetId === assetId) setSelectedAssetId(null);
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : settingsCopy.errors.deleteBanner
      );
      return false;
    } finally {
      setDeletingAssetId(null);
    }
  }

  return {
    assets,
    selectedAssetId,
    isLoading,
    isUploading,
    changingAssetId,
    deletingAssetId,
    error,
    upload,
    select,
    remove
  };
}
