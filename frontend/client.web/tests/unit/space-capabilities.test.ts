import { expect, test } from '@playwright/test';

import type {
  ReorderSpacesRequest,
  SpaceResponse
} from '../../src/shared/types';
import { buildSpaceContextMenuItems } from '../../src/system/Server/components/context-menus/serverWorkspaceContextMenuItems';
import {
  hasEffectiveServerPermission,
  hasManageServerAccess
} from '../../src/system/Server/hooks/workspace/useServerWorkspaceState';
import {
  canApplySpaceReorder,
  canConnectToVoiceSpace,
  canManageAnySpace,
  canManageSpace,
  canSendMessagesToSpace
} from '../../src/system/Server/utils/spaceCapabilities';

function createSpace(
  id: string,
  capabilities: Partial<SpaceResponse['effectiveCapabilities']> = {},
  options: {
    parentSpaceId?: string | null;
    typeCode?: SpaceResponse['typeCode'];
  } = {}
): SpaceResponse {
  const typeCode = options.typeCode ?? 'text_room';
  return {
    id,
    serverId: 'server-1',
    typeId: `type-${typeCode}`,
    typeCode,
    parentSpaceId: options.parentSpaceId ?? null,
    createdByUserId: 'user-1',
    title: id,
    description: null,
    requiredServerRoleId: null,
    position: 0,
    isSystem: false,
    createdAt: '2026-07-18T00:00:00Z',
    updatedAt: '2026-07-18T00:00:00Z',
    deletedAt: null,
    permissionOverrides: [],
    effectiveCapabilities: {
      canSendMessages: false,
      canConnectVoice: false,
      canManageSpace: false,
      ...capabilities
    }
  };
}

test.describe('effective space capabilities', () => {
  test('uses the effective member permission snapshot for server management', () => {
    expect(hasManageServerAccess(false, ['manage_server'])).toBe(true);
    expect(hasManageServerAccess(false, ['view_audit_log'])).toBe(false);
    expect(hasManageServerAccess(true, [])).toBe(true);
    expect(
      hasEffectiveServerPermission(false, ['manage_roles'], 'manage_roles')
    ).toBe(true);
    expect(
      hasEffectiveServerPermission(false, ['manage_server'], 'view_audit_log')
    ).toBe(true);
    expect(
      hasEffectiveServerPermission(false, ['manage_members'], 'manage_roles')
    ).toBe(false);
  });

  test('gates send, voice connect, and management independently', () => {
    const sendOnly = createSpace('send', { canSendMessages: true });
    const voiceOnly = createSpace('voice', { canConnectVoice: true });
    const manageOnly = createSpace('manage', { canManageSpace: true });

    expect(canSendMessagesToSpace(sendOnly)).toBe(true);
    expect(canConnectToVoiceSpace(sendOnly)).toBe(false);
    expect(canConnectToVoiceSpace(voiceOnly)).toBe(true);
    expect(canManageSpace(voiceOnly)).toBe(false);
    expect(canManageSpace(manageOnly)).toBe(true);
    expect(canSendMessagesToSpace(undefined)).toBe(false);
  });

  test('permits a reorder only when every changed space is manageable', () => {
    const manageable = createSpace('manageable', { canManageSpace: true });
    const restricted = createSpace('restricted');
    const request: ReorderSpacesRequest = {
      spaces: [
        {
          spaceId: manageable.id,
          parentSpaceId: null,
          position: 1
        }
      ]
    };

    expect(canApplySpaceReorder([manageable, restricted], request)).toBe(false);
    expect(canApplySpaceReorder([manageable, restricted], request, true)).toBe(
      true
    );
    expect(
      canApplySpaceReorder([manageable, restricted], {
        spaces: [
          ...request.spaces,
          {
            spaceId: restricted.id,
            parentSpaceId: null,
            position: 0
          }
        ]
      })
    ).toBe(false);
    expect(canManageAnySpace([restricted, manageable])).toBe(true);
    expect(canManageAnySpace([restricted])).toBe(false);
  });

  test('requires management of category descendants and destination ancestors', () => {
    const source = createSpace(
      'source',
      { canManageSpace: true },
      { typeCode: 'category' }
    );
    const restrictedChild = createSpace(
      'restricted-child',
      {},
      { parentSpaceId: source.id }
    );
    const destinationAncestor = createSpace(
      'destination-ancestor',
      { canManageSpace: true },
      { typeCode: 'category' }
    );
    const destination = createSpace(
      'destination',
      { canManageSpace: true },
      {
        parentSpaceId: destinationAncestor.id,
        typeCode: 'category'
      }
    );
    const request: ReorderSpacesRequest = {
      spaces: [
        {
          spaceId: source.id,
          parentSpaceId: destination.id,
          position: 0
        }
      ]
    };

    expect(
      canApplySpaceReorder(
        [source, restrictedChild, destinationAncestor, destination],
        request
      )
    ).toBe(false);

    const manageableChild = createSpace(
      restrictedChild.id,
      { canManageSpace: true },
      { parentSpaceId: source.id }
    );
    expect(
      canApplySpaceReorder(
        [source, manageableChild, destinationAncestor, destination],
        request
      )
    ).toBe(true);

    const restrictedAncestor = createSpace(
      destinationAncestor.id,
      {},
      { typeCode: 'category' }
    );
    expect(
      canApplySpaceReorder(
        [source, manageableChild, restrictedAncestor, destination],
        request
      )
    ).toBe(false);
  });

  test('does not expose space settings or mutations without management access', () => {
    const space = createSpace('restricted');
    const commonOptions = {
      space,
      spaces: [space],
      isMutatingSpaces: false,
      maxCategoryDepth: 3,
      onCreateSpace: () => undefined,
      onEditSpace: () => undefined,
      onDeleteSpace: () => undefined
    };

    expect(
      buildSpaceContextMenuItems({
        ...commonOptions,
        canManageSpace: false
      })
    ).toEqual([]);
    expect(
      buildSpaceContextMenuItems({
        ...commonOptions,
        canManageSpace: true
      })
    ).toHaveLength(2);
  });
});
