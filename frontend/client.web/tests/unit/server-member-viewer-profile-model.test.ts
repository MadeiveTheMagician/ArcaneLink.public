import { expect, test } from '@playwright/test'
import type { ServerMemberViewerProfileResponse } from '../../src/shared/types'
import {
  buildServerMemberProfileStyle,
  isServerMemberProfileOwnedByViewer,
  isServerMemberMutualListTruncated,
  resolveCompactProfilePosition,
  resolveServerMemberMutualTabKey,
} from '../../src/system/Server/components/member-profile/serverMemberProfileModel'

const profile: ServerMemberViewerProfileResponse = {
  memberId: 'member-1',
  serverId: 'server-1',
  userId: 'user-1',
  login: 'arcane',
  displayName: 'Arcane',
  avatarAssetId: null,
  avatarCropOffsetX: 0,
  avatarCropOffsetY: 0,
  avatarCropZoom: 1,
  bannerAssetId: null,
  about: null,
  statusText: null,
  joinedAt: '2026-01-01T00:00:00Z',
  profileThemeCode: 'pink',
  profileColor: '#c07a9e',
  profileBackgroundAssetId: 'background-1',
  roles: [],
  mutualFriendCount: 0,
  mutualServerCount: 0,
  mutualFriends: [],
  mutualServers: [],
  updatedAt: '2026-01-01T00:00:00Z',
  inheritance: {
    displayName: true,
    avatar: true,
    banner: true,
    about: true,
  },
}

test.describe('server member viewer profile model', () => {
  test('keeps a compact profile inside the viewport and next to its row', () => {
    expect(resolveCompactProfilePosition(
      { left: 940, right: 1180, top: 680, bottom: 730 },
      { width: 1200, height: 800 },
    )).toEqual({ left: 572, top: 268, width: 356 })
  })

  test('uses the target profile color when viewer theme override is disabled', () => {
    const style = buildServerMemberProfileStyle(profile, {
      selectedThemeCode: 'sapphire',
      profileColor: '#7b61ff',
      applySystemThemeToOtherProfiles: false,
    }) as Record<string, string>

    expect(style['--profile-accent-color']).toBe('#c07a9e')
    expect(style['--server-member-profile-background']).toContain('background-1')
  })

  test('uses the viewer profile color when theme override is enabled', () => {
    const style = buildServerMemberProfileStyle(profile, {
      selectedThemeCode: 'sapphire',
      profileColor: '#7b61ff',
      applySystemThemeToOtherProfiles: true,
    }) as Record<string, string>

    expect(style['--profile-accent-color']).toBe('#7b61ff')
  })

  test('supports cyclic arrow and boundary keyboard navigation between mutual tabs', () => {
    expect(resolveServerMemberMutualTabKey('servers', 'ArrowLeft')).toBe('friends')
    expect(resolveServerMemberMutualTabKey('friends', 'ArrowRight')).toBe('servers')
    expect(resolveServerMemberMutualTabKey('friends', 'Home')).toBe('servers')
    expect(resolveServerMemberMutualTabKey('servers', 'End')).toBe('friends')
    expect(resolveServerMemberMutualTabKey('servers', 'Enter')).toBeNull()
  })

  test('marks a mutual list as partial only when the total exceeds returned items', () => {
    expect(isServerMemberMutualListTruncated(30, 24)).toBe(true)
    expect(isServerMemberMutualListTruncated(24, 24)).toBe(false)
    expect(isServerMemberMutualListTruncated(0, 0)).toBe(false)
  })

  test('identifies an own profile only by the viewer and profile user ids', () => {
    expect(isServerMemberProfileOwnedByViewer('user-1', 'user-1')).toBe(true)
    expect(isServerMemberProfileOwnedByViewer('user-1', 'user-2')).toBe(false)
    expect(isServerMemberProfileOwnedByViewer('user-1', '')).toBe(false)
  })
})
