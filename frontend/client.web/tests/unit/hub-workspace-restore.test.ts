import { expect, test } from '@playwright/test';

import { resolveHubWorkspaceRestore } from '../../src/system/Hub/components/shell/useHubWorkspaceRestore';

test.describe('hub workspace restore', () => {
  test('falls back to profile after a successful zero-membership load', () => {
    expect(
      resolveHubWorkspaceRestore({
        activeWorkspace: 'server',
        activeServerId: 'removed-server',
        hasSelectedServerMembership: false,
        serverIds: [],
        hasLoadedServers: true
      })
    ).toBe('show-profile');
  });

  test('waits for memberships and restores an existing server', () => {
    const base = {
      activeWorkspace: 'server' as const,
      activeServerId: 'server-1',
      hasSelectedServerMembership: false,
      serverIds: [] as string[]
    };

    expect(
      resolveHubWorkspaceRestore({
        ...base,
        hasLoadedServers: false
      })
    ).toBe('none');
    expect(
      resolveHubWorkspaceRestore({
        ...base,
        serverIds: ['server-1'],
        hasLoadedServers: true
      })
    ).toBe('load-server-members');
  });
});
