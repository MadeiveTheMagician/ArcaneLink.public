import { expect, test } from '@playwright/test'

import { resolveWorkspaceTransitionKey } from '../../src/system/Hub/components/shell/workspaceTransitionModel'

test.describe('workspace transition key', () => {
  test('uses the system workspace as the stable transition key', () => {
    for (const activeWorkspace of [
      'profile',
      'servers',
      'friends',
      'invites',
    ] as const) {
      expect(
        resolveWorkspaceTransitionKey({
          activeWorkspace,
          activeServerId: 'server-1',
          activePrivateSpaceId: 'private-1',
        }),
      ).toBe(activeWorkspace)
    }
  })

  test('distinguishes server workspaces by server id', () => {
    expect(
      resolveWorkspaceTransitionKey({
        activeWorkspace: 'server',
        activeServerId: 'server-1',
        activePrivateSpaceId: null,
      }),
    ).toBe('server:server-1')
    expect(
      resolveWorkspaceTransitionKey({
        activeWorkspace: 'server',
        activeServerId: 'server-2',
        activePrivateSpaceId: null,
      }),
    ).toBe('server:server-2')
  })

  test('distinguishes private conversation content without keying its shell', () => {
    expect(
      resolveWorkspaceTransitionKey({
        activeWorkspace: 'private-space',
        activeServerId: null,
        activePrivateSpaceId: 'private-1',
      }),
    ).toBe('private-space:private-1')
    expect(
      resolveWorkspaceTransitionKey({
        activeWorkspace: 'private-space',
        activeServerId: null,
        activePrivateSpaceId: 'private-2',
      }),
    ).toBe('private-space:private-2')
  })

  test('keeps incomplete restored workspaces deterministic', () => {
    expect(
      resolveWorkspaceTransitionKey({
        activeWorkspace: 'server',
        activeServerId: null,
        activePrivateSpaceId: null,
      }),
    ).toBe('server:none')
    expect(
      resolveWorkspaceTransitionKey({
        activeWorkspace: 'private-space',
        activeServerId: null,
        activePrivateSpaceId: null,
      }),
    ).toBe('private-space:none')
  })
})
