export const attachmentDownloadWarningDelayMs = 3_000

export function getAttachmentDownloadWarningRemainingMs(
  openedAtMs: number,
  nowMs: number,
) {
  if (!Number.isFinite(openedAtMs) || !Number.isFinite(nowMs)) {
    return attachmentDownloadWarningDelayMs
  }

  const elapsedMs = Math.max(0, nowMs - openedAtMs)
  return Math.max(0, attachmentDownloadWarningDelayMs - elapsedMs)
}

export function getAttachmentDownloadWarningCountdownSeconds(
  openedAtMs: number,
  nowMs: number,
) {
  return Math.ceil(
    getAttachmentDownloadWarningRemainingMs(openedAtMs, nowMs) / 1_000,
  )
}

export function getAttachmentDownloadWarningProgress(
  openedAtMs: number,
  nowMs: number,
) {
  const remainingMs = getAttachmentDownloadWarningRemainingMs(
    openedAtMs,
    nowMs,
  )

  return Math.min(
    1,
    Math.max(
      0,
      (attachmentDownloadWarningDelayMs - remainingMs) /
        attachmentDownloadWarningDelayMs,
    ),
  )
}

export function canConfirmAttachmentDownload(
  openedAtMs: number,
  nowMs: number,
) {
  return getAttachmentDownloadWarningRemainingMs(openedAtMs, nowMs) === 0
}
