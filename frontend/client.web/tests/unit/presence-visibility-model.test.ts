import { expect, test } from '@playwright/test';

import {
  defaultPresenceVisibility,
  normalizePresenceVisibility,
  selectPresenceVisibilityGlobal,
  serializePresenceVisibility,
  toPresenceVisibilityDraft,
  togglePresenceVisibilityCategory
} from '../../src/system/Hub/components/settings/presenceVisibilityModel';

test.describe('presence visibility model', () => {
  test('accepts legacy values and canonicalizes custom categories', () => {
    expect(normalizePresenceVisibility('everyone')).toBe('everyone');
    expect(normalizePresenceVisibility('friends')).toBe('friends');
    expect(normalizePresenceVisibility('nobody')).toBe('nobody');
    expect(
      normalizePresenceVisibility(
        ' CUSTOM:shared_servers, friends_of_friends, friends '
      )
    ).toBe('custom:friends,friends_of_friends,shared_servers');
  });

  test('falls back to the client default for malformed custom values', () => {
    expect(normalizePresenceVisibility(undefined)).toBe(
      defaultPresenceVisibility
    );
    expect(normalizePresenceVisibility('custom:')).toBe(
      defaultPresenceVisibility
    );
    expect(normalizePresenceVisibility('custom:friends,friends')).toBe(
      defaultPresenceVisibility
    );
    expect(normalizePresenceVisibility('custom:followers')).toBe(
      defaultPresenceVisibility
    );
  });

  test('maps legacy friends into a custom category selection', () => {
    expect(toPresenceVisibilityDraft('friends')).toEqual({
      mode: 'custom',
      friends: true,
      friendsOfFriends: false,
      sharedServers: false
    });
  });

  test('keeps global choices exclusive and serializes selected categories', () => {
    let draft = selectPresenceVisibilityGlobal('everyone');
    draft = togglePresenceVisibilityCategory(draft, 'friends_of_friends', true);
    draft = togglePresenceVisibilityCategory(draft, 'shared_servers', true);

    expect(draft.mode).toBe('custom');
    expect(serializePresenceVisibility(draft)).toBe(
      'custom:friends_of_friends,shared_servers'
    );

    expect(
      serializePresenceVisibility(selectPresenceVisibilityGlobal('nobody'))
    ).toBe('nobody');
  });

  test('turns an empty custom selection into nobody', () => {
    const selected = togglePresenceVisibilityCategory(
      selectPresenceVisibilityGlobal('nobody'),
      'friends',
      true
    );
    const empty = togglePresenceVisibilityCategory(selected, 'friends', false);

    expect(empty.mode).toBe('nobody');
    expect(serializePresenceVisibility(empty)).toBe('nobody');
  });
});
