import { expect, test } from '@playwright/test';

import { buildSpacePermissionOverrideRequest } from '../../src/system/Server/components/dialogs/space-permissions/spacePermissionEditorModel';

test.describe('space permission editor model', () => {
  test('builds an allow rule for exactly one role target', () => {
    expect(
      buildSpacePermissionOverrideRequest(
        'role',
        'role-1',
        'permission-1',
        'allow'
      )
    ).toEqual({
      roleId: 'role-1',
      memberId: null,
      permissionId: 'permission-1',
      allow: true,
      deny: false
    });
  });

  test('builds a deny rule for exactly one member target', () => {
    expect(
      buildSpacePermissionOverrideRequest(
        'member',
        'member-1',
        'permission-1',
        'deny'
      )
    ).toEqual({
      roleId: null,
      memberId: 'member-1',
      permissionId: 'permission-1',
      allow: false,
      deny: true
    });
  });

  test('rejects incomplete rules before making an API request', () => {
    expect(
      buildSpacePermissionOverrideRequest('role', '', 'permission-1', 'allow')
    ).toBeNull();
    expect(
      buildSpacePermissionOverrideRequest('member', 'member-1', '', 'deny')
    ).toBeNull();
  });
});
