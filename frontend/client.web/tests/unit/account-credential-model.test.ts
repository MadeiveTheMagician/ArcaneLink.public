import { expect, test } from '@playwright/test';

import {
  isValidEmailChange,
  isValidLoginChange,
  isValidPasswordChange
} from '../../src/system/Hub/components/settings/accountCredentialModel';

test.describe('account credential validation model', () => {
  test('requires a valid login and the current password', () => {
    expect(isValidLoginChange('new-login', 'Current1!')).toBe(true);
    expect(isValidLoginChange('ab', 'Current1!')).toBe(false);
    expect(isValidLoginChange('new-login', '')).toBe(false);
  });

  test('requires a valid email and the current password', () => {
    expect(isValidEmailChange('new@example.com', 'Current1!')).toBe(true);
    expect(isValidEmailChange('not-an-email', 'Current1!')).toBe(false);
    expect(isValidEmailChange('new@example.com', '')).toBe(false);
  });

  test('requires matching strong passwords', () => {
    expect(
      isValidPasswordChange('Current1!', 'NewPassword1!', 'NewPassword1!')
    ).toBe(true);
    expect(
      isValidPasswordChange('Current1!', 'NewPassword1!', 'different')
    ).toBe(false);
    expect(
      isValidPasswordChange('Current1!', 'weak-password', 'weak-password')
    ).toBe(false);
  });
});
