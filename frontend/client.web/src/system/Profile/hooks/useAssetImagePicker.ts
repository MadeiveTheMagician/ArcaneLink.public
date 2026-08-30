import { useEffect, useRef, useState } from 'react';

import { apiJson } from '../../../shared/api/api';
import type { AssetResponse } from '../../../shared/types';

export type AssetImageDraft = {
  previewUrl: string;
  assetId?: string;
  file?: File;
  isObjectUrl: boolean;
};

type AssetSort = 'newest' | 'oldest';

type UseAssetImagePickerOptions = {
  accessToken: string;
  libraryEndpoint: string;
  sort: AssetSort;
};

export function useAssetImagePicker({
  accessToken,
  libraryEndpoint,
  sort
}: UseAssetImagePickerOptions) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<AssetImageDraft | null>(null);
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);

  const sortedAssets = [...assets].sort((a, b) => {
    const firstTime = new Date(a.createdAt).getTime();
    const secondTime = new Date(b.createdAt).getTime();

    return sort === 'newest' ? secondTime - firstTime : firstTime - secondTime;
  });

  useEffect(() => {
    return () => {
      if (draft?.isObjectUrl) {
        URL.revokeObjectURL(draft.previewUrl);
      }
    };
  }, [draft]);

  function openDraft(nextDraft: AssetImageDraft) {
    if (draft?.isObjectUrl) {
      URL.revokeObjectURL(draft.previewUrl);
    }

    setDraft(nextDraft);
    setIsLibraryOpen(false);
    setIsCropDialogOpen(true);
  }

  function selectFile(file: File | undefined) {
    if (!file) {
      return;
    }

    openDraft({
      previewUrl: URL.createObjectURL(file),
      file,
      isObjectUrl: true
    });
  }

  async function loadAssets() {
    setIsLoadingAssets(true);

    try {
      setAssets(
        await apiJson<AssetResponse[]>(libraryEndpoint, { accessToken })
      );
    } finally {
      setIsLoadingAssets(false);
    }
  }

  function openLibrary() {
    setIsLibraryOpen(true);
    void loadAssets();
  }

  function selectAsset(asset: AssetResponse) {
    openDraft({
      previewUrl: `/api/assets/${asset.id}/content`,
      assetId: asset.id,
      isObjectUrl: false
    });
  }

  function cancelCrop() {
    if (draft?.isObjectUrl) {
      URL.revokeObjectURL(draft.previewUrl);
    }

    setDraft(null);
    setIsCropDialogOpen(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function completeCrop() {
    setDraft(null);
    setIsCropDialogOpen(false);

    clearFileInput();
  }

  function clearFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function removeAsset(assetId: string) {
    setAssets((current) => current.filter((asset) => asset.id !== assetId));
  }

  return {
    fileInputRef,
    draft,
    assets,
    sortedAssets,
    isCropDialogOpen,
    isLibraryOpen,
    isLoadingAssets,
    setIsLibraryOpen,
    setAssets,
    openDraft,
    selectFile,
    loadAssets,
    openLibrary,
    selectAsset,
    cancelCrop,
    completeCrop,
    clearFileInput,
    removeAsset
  };
}
