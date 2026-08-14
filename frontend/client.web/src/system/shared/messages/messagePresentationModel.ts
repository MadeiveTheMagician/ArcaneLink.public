import type {
  MessageBubbleAlignment,
  MessageBubbleWidth,
  MessageDisplayFormat,
} from '../../../shared/types'

export type {
  MessageBubbleAlignment,
  MessageBubbleWidth,
} from '../../../shared/types'

export type MessagePresentationSettings = Readonly<{
  format: MessageDisplayFormat
  bubbleAlignment: MessageBubbleAlignment
  bubbleWidth: MessageBubbleWidth
}>

export const defaultMessageDisplayFormat: MessageDisplayFormat = 'wall-scroll'
export const defaultMessageBubbleAlignment: MessageBubbleAlignment = 'own-right'
export const defaultMessageBubbleWidth: MessageBubbleWidth = 'standard'

export function normalizeMessageDisplayFormat(
  value: unknown,
): MessageDisplayFormat {
  return value === 'wall-scroll' || value === 'bubble'
    ? value
    : defaultMessageDisplayFormat
}

export function normalizeMessageBubbleAlignment(
  value: unknown,
): MessageBubbleAlignment {
  return value === 'one-side-left' ||
    value === 'one-side-right' ||
    value === 'own-left' ||
    value === 'own-right'
    ? value
    : defaultMessageBubbleAlignment
}

export function normalizeMessageBubbleWidth(
  value: unknown,
): MessageBubbleWidth {
  return value === 'standard' || value === 'full-width'
    ? value
    : defaultMessageBubbleWidth
}

export function createMessagePresentationSettings(
  format: unknown,
  bubbleAlignment: unknown,
  bubbleWidth: unknown,
): MessagePresentationSettings {
  return {
    format: normalizeMessageDisplayFormat(format),
    bubbleAlignment: normalizeMessageBubbleAlignment(bubbleAlignment),
    bubbleWidth: normalizeMessageBubbleWidth(bubbleWidth),
  }
}

export function isMessageBubbleRightAligned(
  alignment: MessageBubbleAlignment,
  isOwnMessage: boolean,
) {
  return alignment === 'one-side-right' ||
    (alignment === 'own-right' && isOwnMessage) ||
    (alignment === 'own-left' && !isOwnMessage)
}

export function startsMessageBubbleSequence(
  currentSenderUserId: string,
  previousSenderUserId: string | null,
  startsNewTimeSection: boolean,
) {
  return startsNewTimeSection ||
    previousSenderUserId === null ||
    previousSenderUserId !== currentSenderUserId
}
