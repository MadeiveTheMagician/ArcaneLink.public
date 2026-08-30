import { useEffect, useState } from 'react';

import { ApiError, apiJson, apiNoContent } from '../../../../shared/api/api';
import {
  readUserDataCache,
  writeUserDataCache
} from '../../../../shared/cache/clientCache';
import type { ImageCrop } from '../../../../shared/media/ImageCropEditor';
import type {
  PrivateSpaceMembershipMutationResponse,
  PrivateSpaceResponse,
  SpaceReadStateResponse
} from '../../../../shared/types';
import {
  isUserBlockChangedEvent,
  userBlockChangedEventName
} from '../../../shared';
import { communityCopy } from '../../../shared/copy';
import { useUserPresenceChanged } from '../../../shared/hooks/useUserPresenceChanged';
import {
  captureUserPresenceEventBoundary,
  reconcilePrivateSpaceWithLatestPresence,
  reconcilePrivateSpacesWithLatestPresence
} from '../../../shared/presence/presenceEventStore';
import { patchPrivateSpacesPresence } from '../../../shared/presence/presenceModel';
import { patchPrivateSpacesPeerBlockState } from './privateSpaceViewerSettingsModel';

export type PrivateSpacePersonalSettingsPatch = {
  note?: string | null;
  clearNote?: boolean;
  customNickname?: string | null;
  clearCustomNickname?: boolean;
  customAvatarAssetId?: string | null;
  clearCustomAvatar?: boolean;
  customAvatarCropOffsetX?: number;
  customAvatarCropOffsetY?: number;
  customAvatarCropZoom?: number;
  muteMode?: 'off' | '1h' | '4h' | '8h' | 'indefinite';
};

export type GroupPrivateSpaceSettingsPatch = {
  title?: string | null;
  clearTitle?: boolean;
  description?: string | null;
  clearDescription?: boolean;
  avatarAssetId?: string | null;
  clearAvatar?: boolean;
  avatarCropOffsetX?: number;
  avatarCropOffsetY?: number;
  avatarCropZoom?: number;
};

export function usePrivateSpaces(accessToken: string, userId: string) {
  const [privateSpaces, setPrivateSpaces] = useState<PrivateSpaceResponse[]>(
    []
  );
  const [isLoadingPrivateSpaces, setIsLoadingPrivateSpaces] = useState(false);
  const [isMutatingPrivateSpaces, setIsMutatingPrivateSpaces] = useState(false);

  useUserPresenceChanged((payload) => {
    setPrivateSpaces((current) => patchPrivateSpacesPresence(current, payload));
  });

  async function loadPrivateSpaces(silent = false) {
    if (!silent) {
      setIsLoadingPrivateSpaces(true);
    }

    try {
      const presenceBoundary = captureUserPresenceEventBoundary(userId);
      const nextPrivateSpaces = reconcilePrivateSpacesWithLatestPresence(
        (
          await apiJson<PrivateSpaceResponse[]>('/api/private-spaces', {
            accessToken
          })
        ).map(normalizePrivateSpaceContract),
        presenceBoundary
      );
      setPrivateSpaces(nextPrivateSpaces);
      void writeUserDataCache(userId, 'privateSpaces', nextPrivateSpaces);
    } finally {
      if (!silent) {
        setIsLoadingPrivateSpaces(false);
      }
    }
  }

  async function openDirectSpace(targetUserId: string) {
    setIsMutatingPrivateSpaces(true);

    try {
      const presenceBoundary = captureUserPresenceEventBoundary(userId);
      const privateSpace = reconcilePrivateSpaceWithLatestPresence(
        normalizePrivateSpaceContract(
          await apiJson<PrivateSpaceResponse>(
            `/api/private-spaces/direct/${targetUserId}`,
            {
              method: 'POST',
              accessToken
            }
          )
        ),
        presenceBoundary
      );

      setPrivateSpaces((current) => {
        const withoutDuplicate = current.filter(
          (item) => item.spaceId !== privateSpace.spaceId
        );

        const nextPrivateSpaces = [privateSpace, ...withoutDuplicate];
        void writeUserDataCache(userId, 'privateSpaces', nextPrivateSpaces);

        return nextPrivateSpaces;
      });

      return privateSpace;
    } catch (error) {
      showPrivateSpaceMutationError(error, 'open');
      return null;
    } finally {
      setIsMutatingPrivateSpaces(false);
    }
  }

  async function createPrivateSpace(
    memberUserIds: string[],
    title?: string | null
  ) {
    setIsMutatingPrivateSpaces(true);
    try {
      const presenceBoundary = captureUserPresenceEventBoundary(userId);
      const privateSpace = reconcilePrivateSpaceWithLatestPresence(
        normalizePrivateSpaceContract(
          await apiJson<PrivateSpaceResponse>('/api/private-spaces', {
            method: 'POST',
            accessToken,
            body: { memberUserIds, title: title || null }
          })
        ),
        presenceBoundary
      );
      upsertPrivateSpace(privateSpace, true);
      return privateSpace;
    } catch (error) {
      showPrivateSpaceMutationError(error, 'open');
      return null;
    } finally {
      setIsMutatingPrivateSpaces(false);
    }
  }

  async function closePrivateSpace(spaceId: string) {
    setIsMutatingPrivateSpaces(true);

    try {
      await apiNoContent(`/api/private-spaces/${spaceId}/members/me`, {
        method: 'DELETE',
        accessToken
      });

      setPrivateSpaces((current) => {
        const nextPrivateSpaces = current.filter(
          (item) => item.spaceId !== spaceId
        );
        void writeUserDataCache(userId, 'privateSpaces', nextPrivateSpaces);

        return nextPrivateSpaces;
      });
    } finally {
      setIsMutatingPrivateSpaces(false);
    }
  }

  async function clearPrivateSpaceHistory(spaceId: string) {
    setIsMutatingPrivateSpaces(true);

    try {
      await apiNoContent(`/api/private-spaces/${spaceId}/history/clear`, {
        method: 'POST',
        accessToken
      });

      setPrivateSpaces((current) => {
        const nextPrivateSpaces = current.map((space) =>
          space.spaceId === spaceId
            ? {
                ...space,
                unreadCount: 0,
                lastMessage: null
              }
            : space
        );
        void writeUserDataCache(userId, 'privateSpaces', nextPrivateSpaces);
        return nextPrivateSpaces;
      });
      window.dispatchEvent(
        new CustomEvent('arcanelink:private-space-messages-changed', {
          detail: { spaceId }
        })
      );
      return true;
    } catch (error) {
      showPrivateSpaceMutationError(error, 'clear-history');
      return false;
    } finally {
      setIsMutatingPrivateSpaces(false);
    }
  }

  async function addPrivateSpaceMember(spaceId: string, targetUserId: string) {
    setIsMutatingPrivateSpaces(true);

    try {
      const mutation = await apiJson<PrivateSpaceMembershipMutationResponse>(
        `/api/private-spaces/${spaceId}/members`,
        {
          method: 'POST',
          accessToken,
          body: { userId: targetUserId }
        }
      );
      const presenceBoundary = captureUserPresenceEventBoundary(userId);
      const privateSpace = reconcilePrivateSpaceWithLatestPresence(
        normalizePrivateSpaceContract(
          await apiJson<PrivateSpaceResponse>(
            `/api/private-spaces/${mutation.spaceId}`,
            { accessToken }
          )
        ),
        presenceBoundary
      );

      upsertPrivateSpace(privateSpace, mutation.createdGroup);

      return privateSpace;
    } catch (error) {
      showPrivateSpaceMutationError(error, 'add-member');
      return null;
    } finally {
      setIsMutatingPrivateSpaces(false);
    }
  }

  async function updatePersonalSettings(
    spaceId: string,
    request: PrivateSpacePersonalSettingsPatch
  ) {
    const privateSpace = normalizePrivateSpaceContract(
      await apiJson<PrivateSpaceResponse>(
        `/api/private-spaces/${spaceId}/settings/me`,
        { method: 'PATCH', accessToken, body: request }
      )
    );
    upsertPrivateSpace(privateSpace);
    return privateSpace;
  }

  async function uploadPersonalAvatar(
    spaceId: string,
    file: File,
    crop: ImageCrop
  ) {
    const formData = new FormData();
    formData.append('File', file);
    formData.append('CropOffsetX', String(crop.offsetX));
    formData.append('CropOffsetY', String(crop.offsetY));
    formData.append('CropZoom', String(crop.zoom));

    const privateSpace = normalizePrivateSpaceContract(
      await apiJson<PrivateSpaceResponse>(
        `/api/private-spaces/${spaceId}/settings/me/avatar/upload`,
        {
          method: 'POST',
          accessToken,
          body: formData
        }
      )
    );
    upsertPrivateSpace(privateSpace);
    return privateSpace;
  }

  async function updateGroupSettings(
    spaceId: string,
    request: GroupPrivateSpaceSettingsPatch
  ) {
    const privateSpace = normalizePrivateSpaceContract(
      await apiJson<PrivateSpaceResponse>(
        `/api/private-spaces/${spaceId}/settings`,
        { method: 'PATCH', accessToken, body: request }
      )
    );
    upsertPrivateSpace(privateSpace);
    return privateSpace;
  }

  async function markPrivateSpaceRead(spaceId: string) {
    const space = privateSpaces.find((item) => item.spaceId === spaceId);
    if (!space?.lastMessage) return;

    await apiJson<SpaceReadStateResponse>(
      `/api/private-spaces/${spaceId}/messages/read-state`,
      {
        method: 'PUT',
        accessToken,
        body: { throughMessageId: space.lastMessage.id }
      }
    );
    setPrivateSpaces((current) => {
      const next = current.map((item) =>
        item.spaceId === spaceId ? { ...item, unreadCount: 0 } : item
      );
      void writeUserDataCache(userId, 'privateSpaces', next);
      return next;
    });
  }

  async function markAllPrivateSpacesRead() {
    const response = await apiJson<{ updatedSpaceCount: number }>(
      '/api/private-spaces/read-state/all',
      { method: 'PUT', accessToken }
    );
    setPrivateSpaces((current) => {
      const next = current.map((item) => ({ ...item, unreadCount: 0 }));
      void writeUserDataCache(userId, 'privateSpaces', next);
      return next;
    });
    return response;
  }

  function upsertPrivateSpace(
    privateSpace: PrivateSpaceResponse,
    placeFirst = false
  ) {
    setPrivateSpaces((current) => {
      const existingIndex = current.findIndex(
        (item) => item.spaceId === privateSpace.spaceId
      );
      const withoutCurrent = current.filter(
        (item) => item.spaceId !== privateSpace.spaceId
      );
      const next =
        placeFirst || existingIndex < 0
          ? [privateSpace, ...withoutCurrent]
          : [
              ...withoutCurrent.slice(0, existingIndex),
              privateSpace,
              ...withoutCurrent.slice(existingIndex)
            ];
      void writeUserDataCache(userId, 'privateSpaces', next);
      return next;
    });
  }

  useEffect(() => {
    let isDisposed = false;

    void readUserDataCache(userId, 'privateSpaces').then((privateSpaces) => {
      if (!isDisposed && privateSpaces && privateSpaces.length > 0) {
        setPrivateSpaces(
          reconcilePrivateSpacesWithLatestPresence(
            privateSpaces.map(normalizePrivateSpaceContract)
          )
        );
      }
    });

    void loadPrivateSpaces();
    return () => {
      isDisposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, userId]);

  useEffect(() => {
    function syncPeerBlockState(event: Event) {
      if (!isUserBlockChangedEvent(event)) {
        return;
      }

      setPrivateSpaces((current) => {
        const next = patchPrivateSpacesPeerBlockState(
          current,
          userId,
          event.detail
        );
        if (next !== current) {
          void writeUserDataCache(userId, 'privateSpaces', next);
        }
        return next;
      });
    }

    window.addEventListener(userBlockChangedEventName, syncPeerBlockState);
    return () =>
      window.removeEventListener(userBlockChangedEventName, syncPeerBlockState);
  }, [userId]);

  return {
    privateSpaces,
    isLoadingPrivateSpaces,
    isMutatingPrivateSpaces,
    loadPrivateSpaces,
    openDirectSpace,
    createPrivateSpace,
    closePrivateSpace,
    clearPrivateSpaceHistory,
    addPrivateSpaceMember,
    updatePersonalSettings,
    uploadPersonalAvatar,
    updateGroupSettings,
    markPrivateSpaceRead,
    markAllPrivateSpacesRead
  };
}

function normalizePrivateSpaceContract(
  space: PrivateSpaceResponse
): PrivateSpaceResponse {
  const activeMemberCount = space.members.filter(
    (member) => member.statusCode === 'active'
  ).length;

  return {
    ...space,
    ownerUserId: space.ownerUserId || space.createdByUserId,
    kind:
      space.kind === 'direct' || space.kind === 'group'
        ? space.kind
        : activeMemberCount === 2
          ? 'direct'
          : 'group',
    avatarAssetId: space.avatarAssetId ?? null,
    avatarCropOffsetX: space.avatarCropOffsetX ?? 0,
    avatarCropOffsetY: space.avatarCropOffsetY ?? 0,
    avatarCropZoom: space.avatarCropZoom ?? 1,
    viewerSettings: {
      note: space.viewerSettings?.note ?? null,
      customNickname: space.viewerSettings?.customNickname ?? null,
      customAvatarAssetId: space.viewerSettings?.customAvatarAssetId ?? null,
      customAvatarCropOffsetX:
        space.viewerSettings?.customAvatarCropOffsetX ?? 0,
      customAvatarCropOffsetY:
        space.viewerSettings?.customAvatarCropOffsetY ?? 0,
      customAvatarCropZoom: space.viewerSettings?.customAvatarCropZoom ?? 1,
      mutedUntil: space.viewerSettings?.mutedUntil ?? null,
      isMutedIndefinitely: space.viewerSettings?.isMutedIndefinitely ?? false,
      isPeerBlocked: space.viewerSettings?.isPeerBlocked ?? false
    }
  };
}

function showPrivateSpaceMutationError(
  error: unknown,
  action: 'open' | 'add-member' | 'clear-history'
) {
  const isPrivacyDenied = error instanceof ApiError && error.status === 403;
  const body = isPrivacyDenied
    ? communityCopy.direct.privacyDenied
    : action === 'open'
      ? communityCopy.direct.openFailed
      : action === 'add-member'
        ? communityCopy.direct.addMemberFailed
        : communityCopy.direct.clearHistoryFailed;

  window.dispatchEvent(
    new CustomEvent('arcanelink:system-notification', {
      detail: {
        id: `private-space-error:${Date.now()}:${Math.random()
          .toString(36)
          .slice(2)}`,
        title: communityCopy.direct.actionErrorTitle,
        body,
        force: true
      }
    })
  );
}
