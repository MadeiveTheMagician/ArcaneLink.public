export type SystemSelectPhase = 'closed' | 'opening' | 'open' | 'closing'

export type SystemSelectPlacement = 'top' | 'bottom'

export type SystemSelectPopupPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: SystemSelectPlacement
}

type ResolveSystemSelectPopupPositionOptions = {
  trigger: {
    top: number
    bottom: number
    left: number
    width: number
  }
  viewportWidth: number
  viewportHeight: number
  contentHeight: number
  gap?: number
  margin?: number
  maxHeight?: number
  minWidth?: number
}

export const systemSelectTransitionDurationMs = 160

export function getSystemSelectCloseDelayMs(prefersReducedMotion: boolean) {
  return prefersReducedMotion ? 0 : systemSelectTransitionDurationMs
}

export function getNextSystemSelectOptionIndex({
  activeIndex,
  direction,
  disabled,
}: {
  activeIndex: number
  direction: 1 | -1
  disabled: readonly boolean[]
}) {
  if (disabled.length === 0) return -1

  let nextIndex = activeIndex >= 0 ? activeIndex : direction === 1 ? -1 : 0

  for (let attempt = 0; attempt < disabled.length; attempt += 1) {
    nextIndex = (nextIndex + direction + disabled.length) % disabled.length
    if (!disabled[nextIndex]) return nextIndex
  }

  return -1
}

export function resolveSystemSelectPopupPosition({
  trigger,
  viewportWidth,
  viewportHeight,
  contentHeight,
  gap = 6,
  margin = 8,
  maxHeight = 320,
  minWidth = 160,
}: ResolveSystemSelectPopupPositionOptions): SystemSelectPopupPosition {
  const safeViewportWidth = Math.max(0, viewportWidth)
  const safeViewportHeight = Math.max(0, viewportHeight)
  const availableViewportWidth = Math.max(0, safeViewportWidth - margin * 2)
  const width = Math.min(
    Math.max(0, trigger.width, Math.min(minWidth, availableViewportWidth)),
    availableViewportWidth,
  )
  const left = clamp(
    trigger.left,
    margin,
    Math.max(margin, safeViewportWidth - margin - width),
  )
  const availableBelow = Math.max(
    0,
    safeViewportHeight - margin - trigger.bottom - gap,
  )
  const availableAbove = Math.max(0, trigger.top - margin - gap)
  const desiredHeight = Math.min(Math.max(0, contentHeight), maxHeight)
  const placement: SystemSelectPlacement =
    desiredHeight <= availableBelow || availableBelow >= availableAbove
      ? 'bottom'
      : 'top'
  const availableHeight =
    placement === 'bottom' ? availableBelow : availableAbove
  const resolvedMaxHeight = Math.min(maxHeight, availableHeight)
  const renderedHeight = Math.min(desiredHeight, resolvedMaxHeight)
  const top =
    placement === 'bottom'
      ? trigger.bottom + gap
      : trigger.top - gap - renderedHeight

  return {
    top: clamp(top, margin, Math.max(margin, safeViewportHeight - margin)),
    left,
    width,
    maxHeight: resolvedMaxHeight,
    placement,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}
