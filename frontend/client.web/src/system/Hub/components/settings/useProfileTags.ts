import { useEffect, useState } from 'react';

import { apiJson } from '../../../../shared/api/api';
import type { ProfileTagResponse } from '../../../../shared/types';
import { settingsCopy } from '../../../shared/copy/index';

export function useProfileTags(accessToken: string, isEnabled: boolean) {
  const [tags, setTags] = useState<ProfileTagResponse[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEnabled || tags.length > 0) {
      return;
    }

    let isDisposed = false;

    async function loadTags() {
      setError(null);

      try {
        const [availableTags, selectedTags] = await Promise.all([
          apiJson<ProfileTagResponse[]>('/api/users/profile-tags', {
            accessToken
          }),
          apiJson<ProfileTagResponse[]>('/api/users/me/profile/tags', {
            accessToken
          })
        ]);

        if (!isDisposed) {
          setTags(availableTags);
          setSelectedTagIds(selectedTags.map((tag) => tag.id));
        }
      } catch (requestError) {
        if (!isDisposed) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : settingsCopy.errors.loadProfileTags
          );
        }
      }
    }

    void loadTags();

    return () => {
      isDisposed = true;
    };
  }, [accessToken, isEnabled, tags.length]);

  async function toggle(tagId: string) {
    const previousTagIds = selectedTagIds;
    const nextTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((item) => item !== tagId)
      : [...selectedTagIds, tagId];

    setSelectedTagIds(nextTagIds);
    setIsSaving(true);
    setError(null);

    try {
      const savedTags = await apiJson<ProfileTagResponse[]>(
        '/api/users/me/profile/tags',
        {
          method: 'PUT',
          accessToken,
          body: { tagIds: nextTagIds }
        }
      );
      setSelectedTagIds(savedTags.map((tag) => tag.id));
    } catch (requestError) {
      setSelectedTagIds(previousTagIds);
      setError(
        requestError instanceof Error
          ? requestError.message
          : settingsCopy.errors.saveProfileTags
      );
    } finally {
      setIsSaving(false);
    }
  }

  return { tags, selectedTagIds, isSaving, error, toggle };
}
