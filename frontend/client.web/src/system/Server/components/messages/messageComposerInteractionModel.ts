export type MessageComposerFocusState = {
  hasHandledInitialFocus: boolean
  handledRequestId: number
}

type MessageComposerFocusInput = {
  autoFocusOnMount: boolean
  focusRequestId: number
  canFocus: boolean
}

export function createMessageComposerFocusState(): MessageComposerFocusState {
  return {
    hasHandledInitialFocus: false,
    handledRequestId: 0,
  }
}

export function advanceMessageComposerFocus(
  state: MessageComposerFocusState,
  input: MessageComposerFocusInput,
) {
  if (!input.canFocus) {
    return { state, shouldFocus: false }
  }

  const shouldHandleInitialFocus =
    input.autoFocusOnMount && !state.hasHandledInitialFocus
  const shouldHandleRequest = input.focusRequestId > state.handledRequestId

  return {
    state: {
      hasHandledInitialFocus:
        state.hasHandledInitialFocus || shouldHandleInitialFocus,
      handledRequestId: shouldHandleRequest
        ? input.focusRequestId
        : state.handledRequestId,
    },
    shouldFocus: shouldHandleInitialFocus || shouldHandleRequest,
  }
}

type InsertMessageEmojiInput = {
  text: string
  emoji: string
  selectionStart: number
  selectionEnd: number
  maximumLength?: number
}

export type InsertMessageEmojiResult = {
  text: string
  caret: number
  didInsert: boolean
}

function clampSelection(value: number, textLength: number) {
  if (!Number.isFinite(value)) return textLength
  return Math.min(Math.max(Math.trunc(value), 0), textLength)
}

export function insertMessageEmoji({
  text,
  emoji,
  selectionStart,
  selectionEnd,
  maximumLength = 4000,
}: InsertMessageEmojiInput): InsertMessageEmojiResult {
  const left = clampSelection(selectionStart, text.length)
  const right = clampSelection(selectionEnd, text.length)
  const start = Math.min(left, right)
  const end = Math.max(left, right)
  const nextText = `${text.slice(0, start)}${emoji}${text.slice(end)}`

  if (!emoji || nextText.length > maximumLength) {
    return {
      text,
      caret: end,
      didInsert: false,
    }
  }

  return {
    text: nextText,
    caret: start + emoji.length,
    didInsert: true,
  }
}
