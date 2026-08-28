import { type Page, expect, test } from '@playwright/test';

import type {
  CreateServerInviteRequest,
  ServerInviteResponse
} from '../src/shared/types';
import { serverCopy } from '../src/system/shared/copy';
import { mockArcaneLinkApi } from './fixtures/arcaneLinkApi';

const now = '2026-06-21T12:00:00.000Z';

function createActiveLinkInvite(): ServerInviteResponse {
  return {
    id: 'server-invite-active',
    serverId: 'server-palas',
    serverTitle: 'Palas',
    serverDescription: 'Smoke test server',
    serverIconAssetId: null,
    serverIconCropOffsetX: 0,
    serverIconCropOffsetY: 0,
    serverIconCropZoom: 1,
    memberCount: 1,
    onlineCount: 1,
    kindCode: 'link',
    code: 'palas-active',
    targetUserId: null,
    maxUses: null,
    usedCount: 0,
    expiresAt: null,
    createdAt: now,
    revokedAt: null,
    isActive: true
  };
}

async function signInAndOpenServer(page: Page) {
  await page.goto('/');
  await page.locator('input[autocomplete="username"]').fill('lara');
  await page.locator('input[autocomplete="current-password"]').fill('password');
  await page.locator('form').first().locator('button[type="submit"]').click();
  await page.getByRole('button', { name: /Palas/ }).click();
}

test('invite dialog uses a portal, tabs, scrolling and creates a link', async ({
  page
}) => {
  const createdRequests: CreateServerInviteRequest[] = [];
  let inviteLoadCount = 0;

  await mockArcaneLinkApi(page, {
    friendCount: 36,
    serverInviteLoadDelayMs: 1_500,
    onCreateServerInvite: (request) => createdRequests.push(request),
    onLoadServerInvites: () => {
      inviteLoadCount += 1;
    }
  });
  await signInAndOpenServer(page);

  const inviteTrigger = page.getByRole('button', {
    name: serverCopy.actions.inviteMembers
  });
  await inviteTrigger.click();

  const dialog = page.getByRole('dialog', {
    name: serverCopy.invites.inviteMembersTitle('Palas')
  });
  const closeButton = dialog.getByRole('button', {
    name: serverCopy.invites.close
  });
  const backdrop = dialog.locator('xpath=..');

  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await expect(backdrop).toHaveAttribute('data-state', 'open');
  await expect.poll(() => inviteLoadCount).toBe(1);

  const friendsTab = dialog.getByRole('tab', {
    name: new RegExp(serverCopy.invites.friendsTab)
  });
  const linkTab = dialog.getByRole('tab', {
    name: serverCopy.invites.linkTab,
    exact: true
  });
  await expect(friendsTab).toHaveAttribute('aria-selected', 'true');
  await linkTab.click();

  const inviteUrlInput = dialog.getByLabel(serverCopy.invites.linkPanelTitle);
  await expect(inviteUrlInput).toHaveValue(serverCopy.invites.linkLoading);
  await friendsTab.click();

  const portalState = await backdrop.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      isBodyChild: element.parentElement === document.body,
      backdropFilter:
        style.backdropFilter ||
        style.getPropertyValue('-webkit-backdrop-filter')
    };
  });
  expect(portalState.isBodyChild).toBe(true);
  expect(portalState.backdropFilter).toContain('blur(');
  await expect(friendsTab).toHaveAttribute('aria-selected', 'true');

  const friendsList = dialog.getByRole('list', {
    name: serverCopy.invites.friendsListAria
  });
  await expect(friendsList.getByRole('listitem')).toHaveCount(36);
  const scrollMetrics = await friendsList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(
    scrollMetrics.clientHeight
  );
  await friendsList.evaluate((element) =>
    element.scrollTo(0, element.scrollHeight)
  );
  await expect
    .poll(() => friendsList.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  await linkTab.click();
  await expect(linkTab).toHaveAttribute('aria-selected', 'true');
  await expect(inviteUrlInput).toHaveValue(serverCopy.invites.linkEmpty);
  await expect(
    dialog.getByText(serverCopy.invites.linkEmptyHint)
  ).toBeVisible();

  await dialog
    .getByLabel(serverCopy.invites.expirationLabel)
    .selectOption('never');
  await dialog.getByLabel(serverCopy.invites.maxUsesLabel).selectOption('5');
  await dialog
    .getByRole('button', { name: serverCopy.invites.submitNewLink })
    .click();

  await expect.poll(() => createdRequests.length).toBe(1);
  expect(createdRequests[0]).toEqual({
    kindCode: 'link',
    targetUserId: null,
    maxUses: 5,
    expiresAt: null
  });
  await expect(inviteUrlInput).toHaveValue(
    'http://127.0.0.1:5173/invite/palas-generated-1'
  );
  await expect(dialog.getByRole('status')).toHaveText(
    serverCopy.invites.created
  );

  await closeButton.click();
  await expect(backdrop).toHaveAttribute('data-state', 'closing');
  await expect(dialog).toBeHidden({ timeout: 1_000 });
  await expect(inviteTrigger).toBeFocused();
});

test('invite dialog separates load and clipboard errors and reloads on reopen', async ({
  page
}) => {
  let inviteLoadCount = 0;

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error('Clipboard denied'))
      }
    });
  });
  await mockArcaneLinkApi(page, {
    serverInvites: [createActiveLinkInvite()],
    serverInviteLoadFailures: 1,
    onLoadServerInvites: () => {
      inviteLoadCount += 1;
    }
  });
  await signInAndOpenServer(page);

  const inviteTrigger = page.getByRole('button', {
    name: serverCopy.actions.inviteMembers
  });
  await inviteTrigger.click();

  let dialog = page.getByRole('dialog', {
    name: serverCopy.invites.inviteMembersTitle('Palas')
  });
  await dialog
    .getByRole('tab', { name: serverCopy.invites.linkTab, exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText(
    serverCopy.invites.loadFailedTitle
  );
  await expect(dialog.getByRole('alert')).toContainText(
    serverCopy.invites.loadFailed
  );
  await expect.poll(() => inviteLoadCount).toBe(1);

  await dialog.getByRole('button', { name: serverCopy.invites.close }).click();
  await expect(dialog).toBeHidden({ timeout: 1_000 });

  await inviteTrigger.click();
  dialog = page.getByRole('dialog', {
    name: serverCopy.invites.inviteMembersTitle('Palas')
  });
  await dialog
    .getByRole('tab', { name: serverCopy.invites.linkTab, exact: true })
    .click();
  await expect.poll(() => inviteLoadCount).toBe(2);

  const inviteUrlInput = dialog.getByLabel(serverCopy.invites.linkPanelTitle);
  await expect(inviteUrlInput).toHaveValue(
    'http://127.0.0.1:5173/invite/palas-active'
  );
  await dialog.getByRole('button', { name: serverCopy.invites.copy }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    serverCopy.invites.copyFailed
  );
});
