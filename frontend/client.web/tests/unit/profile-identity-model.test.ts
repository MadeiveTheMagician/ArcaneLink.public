import { expect, test } from '@playwright/test';

import {
  createProfileDisplayNameUpdate,
  normalizeProfileDisplayName,
  profileDisplayNameMaxLength,
  validateProfileDisplayName
} from '../../src/system/Hub/components/settings/profileIdentityModel';

test.describe('profile identity model', () => {
  test('normalizes the public name without changing the account login', () => {
    expect(normalizeProfileDisplayName('  Arcane User  ')).toBe('Arcane User');
    expect(createProfileDisplayNameUpdate(' Arcane User ', 'Old name')).toEqual(
      {
        displayName: 'Arcane User'
      }
    );
  });

  test('does not send an empty, overlong or unchanged display name', () => {
    expect(validateProfileDisplayName('   ')).toBe('required');
    expect(
      validateProfileDisplayName('a'.repeat(profileDisplayNameMaxLength + 1))
    ).toBe('too-long');
    expect(
      createProfileDisplayNameUpdate('Same name', ' Same name ')
    ).toBeNull();
  });
});
