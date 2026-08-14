import { expect, test } from '@playwright/test'
import type { ProfileSettingsDraft } from '../../src/system/Profile/hooks/useProfileSettings'
import {
  buildPresenceSettingsRequest,
  isPresenceSettingsDraft,
  mergePresenceSettings,
  toPresenceSettingsDraft,
} from '../../src/system/Hub/components/settings/presenceSettingsModel'

const profileSettings: ProfileSettingsDraft = {
  interfaceScale: 1,
  fontScale: 1,
  serverInterfaceScale: 1,
  isServerRailPinned: false,
  showPrivateReadAllButton: true,
  serverMessageDisplayFormat: 'wall-scroll',
  privateMessageDisplayFormat: 'wall-scroll',
  serverMessageBubbleAlignment: 'own-right',
  privateMessageBubbleAlignment: 'own-right',
  serverMessageBubbleWidth: 'standard',
  privateMessageBubbleWidth: 'standard',
  expandMessageAttachmentsByDefault: false,
  loadExternalMediaPreviews: true,
  horizontalVideoCardSize: 3,
  verticalVideoCardSize: 3,
  selectedThemeCode: 'sapphire',
  profileColor: null,
  profileBackgroundAssetId: null,
  applySystemThemeToOtherProfiles: true,
  directMessagePermission: 'everyone',
  presenceVisibility: 'everyone',
  showLastSeen: true,
  presenceMode: 'automatic',
}

test.describe('presence settings model', () => {
  test('normalizes legacy or invalid settings to privacy-safe contract defaults', () => {
    expect(toPresenceSettingsDraft({})).toEqual({
      presenceVisibility: 'everyone',
      showLastSeen: true,
      presenceMode: 'automatic',
    })
    expect(
      toPresenceSettingsDraft({
        presenceVisibility: 'invalid' as 'everyone',
        showLastSeen: false,
        presenceMode: 'invalid' as 'automatic',
      }),
    ).toEqual({
      presenceVisibility: 'everyone',
      showLastSeen: false,
      presenceMode: 'automatic',
    })
  })

  test('validates and builds the exact update contract', () => {
    const draft = {
      presenceVisibility: 'friends',
      showLastSeen: false,
      presenceMode: 'invisible',
    } as const

    expect(isPresenceSettingsDraft(draft)).toBe(true)
    expect(isPresenceSettingsDraft({ ...draft, presenceMode: 'away' })).toBe(
      false,
    )
    expect(buildPresenceSettingsRequest(draft)).toEqual(draft)
  })

  test('accepts a canonical custom visibility contract', () => {
    const draft = {
      presenceVisibility:
        'custom:friends,friends_of_friends,shared_servers',
      showLastSeen: true,
      presenceMode: 'automatic',
    } as const

    expect(isPresenceSettingsDraft(draft)).toBe(true)
    expect(toPresenceSettingsDraft(draft)).toEqual(draft)
  })

  test('merges privacy fields without changing unrelated profile settings', () => {
    const merged = mergePresenceSettings(profileSettings, {
      presenceVisibility: 'nobody',
      showLastSeen: false,
      presenceMode: 'invisible',
    })

    expect(merged).toMatchObject({
      interfaceScale: 1,
      selectedThemeCode: 'sapphire',
      presenceVisibility: 'nobody',
      showLastSeen: false,
      presenceMode: 'invisible',
    })
  })
})
