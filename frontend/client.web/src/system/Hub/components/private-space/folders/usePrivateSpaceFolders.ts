import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiJson, apiNoContent } from '../../../../../shared/api/api';
import type {
  PrivateSpaceFolderResponse,
  PrivateSpaceResponse,
  UpsertPrivateSpaceFolderRequest
} from '../../../../../shared/types';
import type { FolderDropPlacement } from './PrivateSpaceFolderDragArea';
import {
  getPrivateSpaceListActivityMs,
  reconcilePrivateSpaceFolderOrder,
  reorderPrivateSpaceIds
} from './privateSpaceOrderModel';

const allFolderId = '00000000-0000-0000-0000-000000000000';

function normalizeFolder(
  folder: PrivateSpaceFolderResponse,
  privateSpaces?: readonly PrivateSpaceResponse[]
): PrivateSpaceFolderResponse {
  const spaceIds = [...folder.spaceIds];
  const visibleSpaceIds = new Set(spaceIds);

  const normalizedFolder = {
    ...folder,
    isOrderLocked: folder.isOrderLocked ?? false,
    spaceIds,
    pinnedSpaceIds: (folder.pinnedSpaceIds ?? []).filter((spaceId) =>
      visibleSpaceIds.has(spaceId)
    )
  };

  return privateSpaces && privateSpaces.length > 0
    ? {
        ...normalizedFolder,
        spaceIds: reconcilePrivateSpaceFolderOrder(
          normalizedFolder,
          privateSpaces
        )
      }
    : normalizedFolder;
}

export function usePrivateSpaceFolders(
  accessToken: string,
  privateSpaces: readonly PrivateSpaceResponse[]
) {
  const [folders, setFolders] = useState<PrivateSpaceFolderResponse[]>([]);
  const [activeFolderId, setActiveFolderId] = useState(allFolderId);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const privateSpaceOrderKey = useMemo(
    () =>
      privateSpaces
        .map(
          (space) => `${space.spaceId}:${getPrivateSpaceListActivityMs(space)}`
        )
        .join('|'),
    [privateSpaces]
  );
  const currentPrivateSpacesRef = useRef(privateSpaces);

  useEffect(() => {
    currentPrivateSpacesRef.current = privateSpaces;
  }, [privateSpaces]);

  const loadFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiJson<PrivateSpaceFolderResponse[]>(
        '/api/private-space-folders',
        { accessToken }
      );
      setFolders(
        response.map((folder) =>
          normalizeFolder(folder, currentPrivateSpacesRef.current)
        )
      );
      setActiveFolderId((current) =>
        response.some((folder) => folder.id === current)
          ? current
          : (response[0]?.id ?? allFolderId)
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    setFolders((current) =>
      current.map((folder) =>
        normalizeFolder(folder, currentPrivateSpacesRef.current)
      )
    );
  }, [privateSpaceOrderKey]);

  async function createFolder(request: UpsertPrivateSpaceFolderRequest) {
    setIsMutating(true);
    setError(null);
    try {
      const folder = await apiJson<PrivateSpaceFolderResponse>(
        '/api/private-space-folders',
        { method: 'POST', accessToken, body: request }
      );
      const normalizedFolder = normalizeFolder(
        folder,
        currentPrivateSpacesRef.current
      );
      setFolders((current) => [...current, normalizedFolder]);
      setActiveFolderId(folder.id);
      return normalizedFolder;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'folder_error');
      throw reason;
    } finally {
      setIsMutating(false);
    }
  }

  async function updateFolder(
    folderId: string,
    request: UpsertPrivateSpaceFolderRequest
  ) {
    setIsMutating(true);
    setError(null);
    try {
      const folder = await apiJson<PrivateSpaceFolderResponse>(
        `/api/private-space-folders/${folderId}`,
        { method: 'PUT', accessToken, body: request }
      );
      const normalizedFolder = normalizeFolder(
        folder,
        currentPrivateSpacesRef.current
      );
      setFolders((current) =>
        current.map((item) => (item.id === folderId ? normalizedFolder : item))
      );
      return normalizedFolder;
    } finally {
      setIsMutating(false);
    }
  }

  async function deleteFolder(folderId: string) {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder || folder.isSystem) return;
    setIsMutating(true);
    try {
      await apiNoContent(`/api/private-space-folders/${folderId}`, {
        method: 'DELETE',
        accessToken
      });
      setFolders((current) => current.filter((item) => item.id !== folderId));
      setActiveFolderId((current) =>
        current === folderId ? allFolderId : current
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function addSpaceToFolder(folderId: string, spaceId: string) {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder || folder.isSystem || folder.spaceIds.includes(spaceId)) return;
    setFolders((current) =>
      current.map((item) =>
        item.id === folderId
          ? { ...item, spaceIds: [...item.spaceIds, spaceId] }
          : item
      )
    );
    try {
      await apiNoContent(
        `/api/private-space-folders/${folderId}/spaces/${spaceId}`,
        {
          method: 'PUT',
          accessToken
        }
      );
    } catch (reason) {
      await loadFolders();
      throw reason;
    }
  }

  async function removeSpaceFromFolder(folderId: string, spaceId: string) {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder || folder.isSystem || !folder.spaceIds.includes(spaceId))
      return;

    const previousFolders = folders;
    setFolders((current) =>
      current.map((item) =>
        item.id === folderId
          ? {
              ...item,
              spaceIds: item.spaceIds.filter((id) => id !== spaceId),
              pinnedSpaceIds: item.pinnedSpaceIds.filter((id) => id !== spaceId)
            }
          : item
      )
    );

    try {
      await apiNoContent(
        `/api/private-space-folders/${folderId}/spaces/${spaceId}`,
        { method: 'DELETE', accessToken }
      );
    } catch (reason) {
      setFolders(previousFolders);
      throw reason;
    }
  }

  async function reorderFolders(
    activeFolderId: string,
    overFolderId: string,
    placement: FolderDropPlacement = 'before'
  ) {
    if (activeFolderId === overFolderId) return;
    const systemFolders = folders.filter((folder) => folder.isSystem);
    const customFolders = folders.filter((folder) => !folder.isSystem);
    const activeIndex = customFolders.findIndex(
      (folder) => folder.id === activeFolderId
    );
    const overIndex = customFolders.findIndex(
      (folder) => folder.id === overFolderId
    );
    if (activeIndex < 0 || overIndex < 0) return;

    const previousFolders = folders;
    const reordered = [...customFolders];
    const [movedFolder] = reordered.splice(activeIndex, 1);
    const targetIndex = reordered.findIndex(
      (folder) => folder.id === overFolderId
    );
    const insertionIndex =
      placement === 'after' ? targetIndex + 1 : targetIndex;
    reordered.splice(Math.max(0, insertionIndex), 0, movedFolder);
    setFolders([...systemFolders, ...reordered]);

    try {
      await apiNoContent('/api/private-space-folders/reorder', {
        method: 'PUT',
        accessToken,
        body: { folderIds: reordered.map((folder) => folder.id) }
      });
    } catch (reason) {
      setFolders(previousFolders);
      throw reason;
    }
  }

  async function reorderSpaces(
    activeSpaceId: string,
    overSpaceId: string,
    placement: FolderDropPlacement = 'before'
  ) {
    const folder = folders.find((item) => item.id === activeFolderId);
    if (!folder || activeSpaceId === overSpaceId) return;
    const activeIndex = folder.spaceIds.indexOf(activeSpaceId);
    const overIndex = folder.spaceIds.indexOf(overSpaceId);
    if (activeIndex < 0 || overIndex < 0) return;

    const reorderedSpaceIds = reorderPrivateSpaceIds(
      folder.spaceIds,
      activeSpaceId,
      overSpaceId,
      placement,
      folder.pinnedSpaceIds
    );
    const previousFolders = folders;
    setFolders((current) =>
      current.map((item) =>
        item.id === folder.id ? { ...item, spaceIds: reorderedSpaceIds } : item
      )
    );

    try {
      await apiNoContent(
        `/api/private-space-folders/${folder.id}/spaces/reorder`,
        {
          method: 'PUT',
          accessToken,
          body: { spaceIds: reorderedSpaceIds }
        }
      );
    } catch (reason) {
      setFolders(previousFolders);
      throw reason;
    }
  }

  async function setPinned(spaceId: string, isPinned: boolean) {
    const folder = folders.find((item) => item.id === activeFolderId);
    if (!folder || !folder.spaceIds.includes(spaceId)) return null;

    setIsMutating(true);
    setError(null);
    try {
      const updatedFolder = normalizeFolder(
        await apiJson<PrivateSpaceFolderResponse>(
          `/api/private-space-folders/${folder.id}/spaces/${spaceId}/pin`,
          {
            method: 'PUT',
            accessToken,
            body: { isPinned }
          }
        ),
        currentPrivateSpacesRef.current
      );
      setFolders((current) =>
        current.map((item) =>
          item.id === updatedFolder.id ? updatedFolder : item
        )
      );
      return updatedFolder;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'folder_pin_error');
      throw reason;
    } finally {
      setIsMutating(false);
    }
  }

  async function setOrderLocked(folderId: string, isLocked: boolean) {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return null;

    setIsMutating(true);
    setError(null);
    try {
      const updatedFolder = normalizeFolder(
        await apiJson<PrivateSpaceFolderResponse>(
          `/api/private-space-folders/${folderId}/order-lock`,
          {
            method: 'PUT',
            accessToken,
            body: { isLocked }
          }
        ),
        currentPrivateSpacesRef.current
      );
      setFolders((current) =>
        current.map((item) =>
          item.id === updatedFolder.id ? updatedFolder : item
        )
      );
      return updatedFolder;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'folder_order_lock_error'
      );
      throw reason;
    } finally {
      setIsMutating(false);
    }
  }

  const activeFolder = useMemo(
    () =>
      folders.find((folder) => folder.id === activeFolderId) ??
      folders[0] ??
      null,
    [activeFolderId, folders]
  );

  return {
    folders,
    activeFolder,
    activeFolderId,
    isLoading,
    isMutating,
    error,
    setActiveFolderId,
    createFolder,
    updateFolder,
    deleteFolder,
    addSpaceToFolder,
    removeSpaceFromFolder,
    reorderFolders,
    reorderSpaces,
    setPinned,
    setOrderLocked
  };
}
