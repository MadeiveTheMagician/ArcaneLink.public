import type { ServerInvitePreviewResponse } from '../../../../shared/types';

export const SERVER_INVITE_POLL_INTERVAL_MS = 2 * 60 * 1000;
export const SERVER_INVITE_ATTENTION_MIN_AGE_MS = 15 * 1000;

const expirySettleDelayMs = 100;
const minimumTimerDelayMs = 250;

export function resolveServerInviteClientExpiration(
  preview: ServerInvitePreviewResponse,
  nowMs: number
): ServerInvitePreviewResponse {
  if (!preview.isActive || !preview.expiresAt) {
    return preview;
  }

  const expiresAtMs = Date.parse(preview.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs > nowMs) {
    return preview;
  }

  return {
    ...preview,
    isActive: false,
    invalidReason: 'expired'
  };
}

export function getServerInviteRefreshDelayMs(
  preview: ServerInvitePreviewResponse,
  nowMs: number
) {
  const effectivePreview = resolveServerInviteClientExpiration(preview, nowMs);
  if (!effectivePreview.isActive) {
    return null;
  }

  if (!effectivePreview.expiresAt) {
    return SERVER_INVITE_POLL_INTERVAL_MS;
  }

  const expiresAtMs = Date.parse(effectivePreview.expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return SERVER_INVITE_POLL_INTERVAL_MS;
  }

  return Math.min(
    SERVER_INVITE_POLL_INTERVAL_MS,
    Math.max(minimumTimerDelayMs, expiresAtMs - nowMs + expirySettleDelayMs)
  );
}

export function shouldRefreshServerInviteOnAttention(
  preview: ServerInvitePreviewResponse | null,
  lastRequestedAtMs: number,
  nowMs: number
) {
  if (!preview?.isActive) {
    return false;
  }

  return nowMs - lastRequestedAtMs >= SERVER_INVITE_ATTENTION_MIN_AGE_MS;
}
