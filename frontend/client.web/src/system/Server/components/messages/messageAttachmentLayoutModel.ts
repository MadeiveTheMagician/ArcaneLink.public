export type ScrollToBottomPlacement =
  | 'above-attachment-drafts'
  | 'default'

export function getScrollToBottomPlacement(
  selectedAttachmentCount: number,
): ScrollToBottomPlacement {
  return selectedAttachmentCount > 0
    ? 'above-attachment-drafts'
    : 'default'
}

export type AttachmentLayoutTransition = {
  fromHeight: number
  shouldAnimate: boolean
  toHeight: number
}

export function resolveAttachmentLayoutTransition({
  fromHeight,
  prefersReducedMotion,
  toHeight,
}: {
  fromHeight: number | null
  prefersReducedMotion: boolean
  toHeight: number
}): AttachmentLayoutTransition {
  const safeFromHeight = normalizeHeight(fromHeight)
  const safeToHeight = normalizeHeight(toHeight) ?? 0

  return {
    fromHeight: safeFromHeight ?? safeToHeight,
    shouldAnimate:
      !prefersReducedMotion &&
      safeFromHeight != null &&
      safeToHeight > 0 &&
      Math.abs(safeFromHeight - safeToHeight) >= 1,
    toHeight: safeToHeight,
  }
}

function normalizeHeight(value: number | null) {
  return value != null && Number.isFinite(value) && value > 0
    ? value
    : null
}
