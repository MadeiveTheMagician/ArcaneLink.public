export type MessageFocusRequest = {
  messageId: string
  spaceId: string
  createdAt: string
}

type MessageFocusSource = {
  id: string
  spaceId: string
  createdAt: string
}

export type MessageFocusNavigation =
  | { kind: 'latest' }
  | { kind: 'search-result'; message: MessageFocusSource }

export function resolveMessageFocus(
  navigation: MessageFocusNavigation,
): MessageFocusRequest | null {
  if (navigation.kind === 'latest') {
    return null
  }

  return {
    messageId: navigation.message.id,
    spaceId: navigation.message.spaceId,
    createdAt: navigation.message.createdAt,
  }
}
