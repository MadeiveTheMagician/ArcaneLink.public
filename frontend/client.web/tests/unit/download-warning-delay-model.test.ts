import { expect, test } from '@playwright/test';

import {
  attachmentDownloadWarningDelayMs,
  canConfirmAttachmentDownload,
  getAttachmentDownloadWarningCountdownSeconds,
  getAttachmentDownloadWarningProgress,
  getAttachmentDownloadWarningRemainingMs
} from '../../src/system/Server/components/messages/downloadWarningDelayModel';

test.describe('attachment download warning delay', () => {
  const openedAtMs = 10_000;

  test('keeps confirmation locked for the complete first three seconds', () => {
    expect(canConfirmAttachmentDownload(openedAtMs, openedAtMs)).toBe(false);
    expect(
      canConfirmAttachmentDownload(
        openedAtMs,
        openedAtMs + attachmentDownloadWarningDelayMs - 1
      )
    ).toBe(false);
    expect(
      getAttachmentDownloadWarningRemainingMs(openedAtMs, openedAtMs + 2_999)
    ).toBe(1);
  });

  test('unlocks exactly at the three-second boundary', () => {
    expect(
      canConfirmAttachmentDownload(
        openedAtMs,
        openedAtMs + attachmentDownloadWarningDelayMs
      )
    ).toBe(true);
    expect(
      getAttachmentDownloadWarningRemainingMs(openedAtMs, openedAtMs + 9_000)
    ).toBe(0);
  });

  test('provides a visible three-step countdown and resists clock rollback', () => {
    expect(
      getAttachmentDownloadWarningCountdownSeconds(openedAtMs, openedAtMs)
    ).toBe(3);
    expect(
      getAttachmentDownloadWarningCountdownSeconds(
        openedAtMs,
        openedAtMs + 1_001
      )
    ).toBe(2);
    expect(
      getAttachmentDownloadWarningCountdownSeconds(openedAtMs, openedAtMs - 500)
    ).toBe(3);
  });

  test('exposes clamped left-to-right progress for the disabled action', () => {
    expect(getAttachmentDownloadWarningProgress(openedAtMs, openedAtMs)).toBe(
      0
    );
    expect(
      getAttachmentDownloadWarningProgress(openedAtMs, openedAtMs + 1_500)
    ).toBe(0.5);
    expect(
      getAttachmentDownloadWarningProgress(openedAtMs, openedAtMs + 9_000)
    ).toBe(1);
    expect(
      getAttachmentDownloadWarningProgress(openedAtMs, openedAtMs - 500)
    ).toBe(0);
  });
});
