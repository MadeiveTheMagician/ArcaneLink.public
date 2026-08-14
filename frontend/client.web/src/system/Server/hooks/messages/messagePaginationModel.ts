import type { SpaceMessageResponse } from '../../../../shared/types'

export const messageHistoryPageSize = 100

export type MessageHistoryCursor = {
  createdAt: string
  id: string
}

export function getOldestMessageCursor(
  messages: readonly SpaceMessageResponse[],
): MessageHistoryCursor | null {
  const oldestMessage = messages[0]

  return oldestMessage
    ? {
        createdAt: oldestMessage.createdAt,
        id: oldestMessage.id,
      }
    : null
}

export function hasOlderMessagePage(
  page: readonly SpaceMessageResponse[],
): boolean {
  return page.length === messageHistoryPageSize
}

export function prependOlderMessagePage(
  current: readonly SpaceMessageResponse[],
  olderPage: readonly SpaceMessageResponse[],
): SpaceMessageResponse[] {
  if (olderPage.length === 0) {
    return [...current]
  }

  const currentIds = new Set(current.map((message) => message.id))
  return [
    ...olderPage.filter((message) => !currentIds.has(message.id)),
    ...current,
  ]
}

export function mergeLatestMessagePage(
  current: readonly SpaceMessageResponse[],
  latestPage: readonly SpaceMessageResponse[],
): SpaceMessageResponse[] {
  if (latestPage.length === 0) {
    return [...latestPage]
  }

  const oldestLatestMessage = latestPage[0]
  return [
    ...current.filter(
      (message) => compareMessages(message, oldestLatestMessage) < 0,
    ),
    ...latestPage,
  ]
}

function compareMessages(
  left: SpaceMessageResponse,
  right: SpaceMessageResponse,
) {
  const createdAtDifference =
    Date.parse(left.createdAt) - Date.parse(right.createdAt)
  return createdAtDifference || left.id.localeCompare(right.id)
}
