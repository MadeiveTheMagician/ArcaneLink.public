import { expect, test } from '@playwright/test';

import {
  defaultDirectMessagePermission,
  mergeDirectMessagePermission,
  normalizeDirectMessagePermission,
  selectDirectMessageGlobal,
  serializeDirectMessagePrivacy,
  toDirectMessagePrivacyDraft,
  toggleDirectMessageCategory
} from '../../src/system/Hub/components/settings/directMessagePrivacyModel';
import type { ProfileSettingsDraft } from '../../src/system/Profile/hooks/useProfileSettings';

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
  presenceVisibility: 'friends',
  showLastSeen: false,
  presenceMode: 'invisible'
};

test.describe('direct message privacy model', () => {
  test('accepts legacy values and canonicalizes custom categories', () => {
    expect(normalizeDirectMessagePermission('everyone')).toBe('everyone');
    expect(normalizeDirectMessagePermission('friends')).toBe('friends');
    expect(normalizeDirectMessagePermission('shared_servers')).toBe(
      'shared_servers'
    );
    expect(normalizeDirectMessagePermission('nobody')).toBe('nobody');
    expect(
      normalizeDirectMessagePermission(
        ' CUSTOM:shared_servers, friends_of_friends, friends '
      )
    ).toBe('custom:friends,friends_of_friends,shared_servers');
  });

  test('fails closed to the client default for malformed custom values', () => {
    expect(normalizeDirectMessagePermission(undefined)).toBe(
      defaultDirectMessagePermission
    );
    expect(normalizeDirectMessagePermission('custom:')).toBe(
      defaultDirectMessagePermission
    );
    expect(normalizeDirectMessagePermission('custom:friends,friends')).toBe(
      defaultDirectMessagePermission
    );
    expect(normalizeDirectMessagePermission('custom:followers')).toBe(
      defaultDirectMessagePermission
    );
  });

  test('maps legacy permissions into the new custom selection', () => {
    expect(toDirectMessagePrivacyDraft('friends')).toEqual({
      mode: 'custom',
      friends: true,
      friendsOfFriends: false,
      sharedServers: false
    });
    expect(toDirectMessagePrivacyDraft('shared_servers')).toEqual({
      mode: 'custom',
      friends: false,
      friendsOfFriends: false,
      sharedServers: true
    });
  });

  test('keeps global choices exclusive from custom categories', () => {
    let draft = selectDirectMessageGlobal('everyone');
    draft = toggleDirectMessageCategory(draft, 'friends', true);
    draft = toggleDirectMessageCategory(draft, 'friends_of_friends', true);

    expect(draft.mode).toBe('custom');
    expect(serializeDirectMessagePrivacy(draft)).toBe(
      'custom:friends,friends_of_friends'
    );

    draft = selectDirectMessageGlobal('nobody');
    expect(draft).toEqual({
      mode: 'nobody',
      friends: false,
      friendsOfFriends: false,
      sharedServers: false
    });
  });

  test('turns an empty custom selection into nobody', () => {
    const custom = toggleDirectMessageCategory(
      selectDirectMessageGlobal('nobody'),
      'shared_servers',
      true
    );
    const empty = toggleDirectMessageCategory(custom, 'shared_servers', false);

    expect(empty.mode).toBe('nobody');
    expect(serializeDirectMessagePrivacy(empty)).toBe('nobody');
  });

  test('merges a custom selection without changing other settings', () => {
    let privacy = toggleDirectMessageCategory(
      selectDirectMessageGlobal('nobody'),
      'friends',
      true
    );
    privacy = toggleDirectMessageCategory(privacy, 'shared_servers', true);

    expect(
      mergeDirectMessagePermission(profileSettings, privacy)
    ).toMatchObject({
      directMessagePermission: 'custom:friends,shared_servers',
      presenceVisibility: 'friends',
      showLastSeen: false,
      presenceMode: 'invisible',
      selectedThemeCode: 'sapphire'
    });
  });
});
