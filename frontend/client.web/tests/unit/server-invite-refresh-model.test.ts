import { expect, test } from '@playwright/test'
import type { ServerInvitePreviewResponse } from '../../src/shared/types'
import {
  getServerInviteRefreshDelayMs,
  resolveServerInviteClientExpiration,
  SERVER_INVITE_ATTENTION_MIN_AGE_MS,
  SERVER_INVITE_POLL_INTERVAL_MS,
  shouldRefreshServerInviteOnAttention,
} from '../../src/system/Server/components/messages/serverInviteRefreshModel'

const nowMs = Date.parse('2026-07-28T12:00:00.000Z')

function preview(
  overrides: Partial<ServerInvitePreviewResponse> = {},
): ServerInvitePreviewResponse {
  return {
    code: 'invite-code',
    isActive: true,
    invalidReason: null,
    serverId: 'server-1',
    serverTitle: 'ArcaneLink',
    serverIconAssetId: null,
    serverIconCropOffsetX: 0,
    serverIconCropOffsetY: 0,
    serverIconCropZoom: 1,
    memberCount: 10,
    onlineCount: 4,
    maxUses: null,
    usedCount: 0,
    expiresAt: null,
    ...overrides,
  }
}

test.describe('server invite message-card refresh model', () => {
  test('polls active invitations rarely and stops for inactive ones', () => {
    expect(getServerInviteRefreshDelayMs(preview(), nowMs)).toBe(
      SERVER_INVITE_POLL_INTERVAL_MS,
    )
    expect(
      getServerInviteRefreshDelayMs(
        preview({ isActive: false, invalidReason: 'revoked' }),
        nowMs,
      ),
    ).toBeNull()
  })

  test('schedules the nearest expiry before the regular poll', () => {
    expect(
      getServerInviteRefreshDelayMs(
        preview({ expiresAt: '2026-07-28T12:00:10.000Z' }),
        nowMs,
      ),
    ).toBe(10_100)
    expect(
      getServerInviteRefreshDelayMs(
        preview({ expiresAt: '2026-07-28T13:00:00.000Z' }),
        nowMs,
      ),
    ).toBe(SERVER_INVITE_POLL_INTERVAL_MS)
  })

  test('expires a stale active preview locally without mutating it', () => {
    const stalePreview = preview({
      expiresAt: '2026-07-28T11:59:59.000Z',
    })
    const resolved = resolveServerInviteClientExpiration(stalePreview, nowMs)

    expect(resolved).toEqual({
      ...stalePreview,
      isActive: false,
      invalidReason: 'expired',
    })
    expect(stalePreview.isActive).toBe(true)
    expect(
      getServerInviteRefreshDelayMs(stalePreview, nowMs),
    ).toBeNull()
  })

  test('throttles focus and visibility refreshes', () => {
    expect(
      shouldRefreshServerInviteOnAttention(
        preview(),
        nowMs - SERVER_INVITE_ATTENTION_MIN_AGE_MS,
        nowMs,
      ),
    ).toBe(true)
    expect(
      shouldRefreshServerInviteOnAttention(
        preview(),
        nowMs - SERVER_INVITE_ATTENTION_MIN_AGE_MS + 1,
        nowMs,
      ),
    ).toBe(false)
    expect(
      shouldRefreshServerInviteOnAttention(
        preview({ isActive: false, invalidReason: 'expired' }),
        0,
        nowMs,
      ),
    ).toBe(false)
  })
})
