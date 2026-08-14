import { expect, test } from '@playwright/test'
import type { SpaceMessageResponse } from '../../src/shared/types'
import { canReportServerMessage } from '../../src/system/Moderation/models/messageReportModel'

const context = {
  accessToken: 'token',
  serverId: 'server-1',
  spaceId: 'space-1',
}

function message(
  overrides: Partial<SpaceMessageResponse> = {},
): SpaceMessageResponse {
  return {
    id: 'message-1',
    serverId: 'server-1',
    spaceId: 'space-1',
    senderUserId: 'other-user',
    senderDisplayName: 'Other user',
    senderAvatarAssetId: null,
    senderAvatarCropOffsetX: 0,
    senderAvatarCropOffsetY: 0,
    senderAvatarCropZoom: 1,
    messageTypeId: 'message-type',
    messageTypeCode: 'text',
    body: 'Message',
    payload: null,
    replyToMessageId: null,
    createdAt: '2026-07-21T12:00:00.000Z',
    updatedAt: '2026-07-21T12:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    assets: [],
    reactions: [],
    ...overrides,
  }
}

test.describe('message report eligibility', () => {
  test('allows only another user non-deleted message in the active server space', () => {
    expect(
      canReportServerMessage({
        context,
        currentUserId: 'current-user',
        message: message(),
      }),
    ).toBe(true)
    expect(
      canReportServerMessage({
        context,
        currentUserId: 'CURRENT-USER',
        message: message({ senderUserId: 'current-user' }),
      }),
    ).toBe(false)
    expect(
      canReportServerMessage({
        context,
        currentUserId: 'current-user',
        message: message({ deletedAt: '2026-07-21T12:01:00.000Z' }),
      }),
    ).toBe(false)
  })

  test('never exposes reporting without server context or for a mismatched space', () => {
    expect(
      canReportServerMessage({
        currentUserId: 'current-user',
        message: message(),
      }),
    ).toBe(false)
    expect(
      canReportServerMessage({
        context,
        currentUserId: 'current-user',
        message: message({ spaceId: 'private-space' }),
      }),
    ).toBe(false)
  })
})
