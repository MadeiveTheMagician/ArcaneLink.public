import { expect, test } from '@playwright/test';

import type { OwnServerMemberProfileResponse } from '../../src/shared/types';
import {
  createServerMemberProfileDraft,
  createServerMemberProfileUpdate,
  createServerProfileAssetReset,
  hasServerMemberProfileOverrides,
  validateServerMemberProfileDraft
} from '../../src/system/Hub/components/settings/serverMemberProfileModel';

const inheritedProfile: OwnServerMemberProfileResponse = {
  serverId: 'server-1',
  userId: 'user-1',
  login: 'arcane',
  displayName: 'Global name',
  avatarAssetId: 'avatar-global',
  avatarSourceAssetId: null,
  avatarCropOffsetX: 0,
  avatarCropOffsetY: 0,
  avatarCropZoom: 1,
  bannerAssetId: 'banner-global',
  about: 'Global about',
  statusText: null,
  updatedAt: '2026-08-02T00:00:00Z',
  inheritance: {
    displayName: true,
    avatar: true,
    banner: true,
    about: true
  }
};

test.describe('server member profile model', () => {
  test('keeps effective global values while every field is inherited', () => {
    const draft = createServerMemberProfileDraft(inheritedProfile);

    expect(draft).toEqual({
      displayName: 'Global name',
      about: 'Global about',
      statusText: '',
      useGlobalDisplayName: true,
      useGlobalAbout: true
    });
    expect(createServerMemberProfileUpdate(inheritedProfile, draft)).toBeNull();
    expect(hasServerMemberProfileOverrides(inheritedProfile)).toBe(false);
  });

  test('creates text overrides without changing inherited assets', () => {
    const draft = {
      ...createServerMemberProfileDraft(inheritedProfile),
      displayName: ' Server name ',
      about: ' Server about ',
      statusText: ' In voice ',
      useGlobalDisplayName: false,
      useGlobalAbout: false
    };

    expect(createServerMemberProfileUpdate(inheritedProfile, draft)).toEqual({
      displayName: 'Server name',
      about: 'Server about',
      statusText: 'In voice'
    });
  });

  test('returns individual and complete override state to inheritance', () => {
    const overridden = {
      ...inheritedProfile,
      displayName: 'Server name',
      about: 'Server about',
      statusText: 'Busy',
      inheritance: {
        displayName: false,
        avatar: false,
        banner: false,
        about: false
      }
    };
    const draft = {
      ...createServerMemberProfileDraft(overridden),
      statusText: '',
      useGlobalDisplayName: true,
      useGlobalAbout: true
    };

    expect(createServerMemberProfileUpdate(overridden, draft)).toEqual({
      useGlobalDisplayName: true,
      useGlobalAbout: true,
      clearStatusText: true
    });
    expect(createServerProfileAssetReset('avatar')).toEqual({
      useGlobalAvatar: true
    });
    expect(createServerProfileAssetReset('banner')).toEqual({
      useGlobalBanner: true
    });
    expect(hasServerMemberProfileOverrides(overridden)).toBe(true);
  });

  test('requires meaningful custom display name and about values', () => {
    const draft = {
      ...createServerMemberProfileDraft(inheritedProfile),
      displayName: ' ',
      useGlobalDisplayName: false
    };

    expect(validateServerMemberProfileDraft(draft)).toBe(
      'display-name-required'
    );
    expect(
      validateServerMemberProfileDraft({
        ...draft,
        displayName: 'Server name',
        about: ' ',
        useGlobalAbout: false
      })
    ).toBe('about-required');
    expect(
      createServerMemberProfileUpdate(inheritedProfile, {
        ...draft,
        displayName: 'Server name',
        about: ' ',
        useGlobalAbout: false
      })
    ).toBeNull();
  });
});
