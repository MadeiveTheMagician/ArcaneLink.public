import type { SpaceMessageResponse } from '../../../../shared/types'

export type FirstUnreadNavigationTarget = {
  messageId: string | null
  needsOlderMessages: boolean
}

export function shouldHoldInitialUnreadPosition({
  hasFocusedMessage,
  unreadCount,
  isLoading,
  isLoadingOlderMessages,
  needsOlderMessages,
}: {
  hasFocusedMessage: boolean
  unreadCount: number
  isLoading: boolean
  isLoadingOlderMessages: boolean
  needsOlderMessages: boolean
}) {
  return (
    !hasFocusedMessage &&
    Number.isFinite(unreadCount) &&
    unreadCount > 0 &&
    (isLoading || isLoadingOlderMessages || needsOlderMessages)
  )
}

export function getLatestUnreadMessageId(
  messages: readonly SpaceMessageResponse[],
  currentUserId: string,
  unreadCount: number,
) {
  if (unreadCount <= 0) {
    return null
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (!message.deletedAt && message.senderUserId !== currentUserId) {
      return message.id
    }
  }

  return null
}

export function getFirstUnreadNavigationTarget(
  messages: readonly SpaceMessageResponse[],
  currentUserId: string,
  unreadCount: number,
  hasOlderMessages: boolean,
): FirstUnreadNavigationTarget {
  const normalizedUnreadCount = Number.isFinite(unreadCount)
    ? Math.max(0, Math.floor(unreadCount))
    : 0

  if (normalizedUnreadCount === 0) {
    return {
      messageId: null,
      needsOlderMessages: false,
    }
  }

  let loadedUnreadCount = 0
  let oldestLoadedUnreadMessageId: string | null = null

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (
      !message.deletedAt &&
      message.senderUserId !== currentUserId
    ) {
      loadedUnreadCount += 1
      oldestLoadedUnreadMessageId = message.id

      if (loadedUnreadCount === normalizedUnreadCount) {
        return {
          messageId: message.id,
          needsOlderMessages: false,
        }
      }
    }
  }

  if (hasOlderMessages) {
    return {
      messageId: null,
      needsOlderMessages: true,
    }
  }

  // The unread count and the visible history can briefly disagree after a
  // deletion or realtime refresh. Once history is exhausted, the oldest
  // available incoming message is the safest recoverable boundary.
  return {
    messageId: oldestLoadedUnreadMessageId,
    needsOlderMessages: false,
  }
}
