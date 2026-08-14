import {
  findExternalMedia,
  type ExternalMediaPreview,
} from './externalMedia'

const horizontalCardWidths = [400, 520, 640, 760, 880, 1000] as const
const verticalCardWidths = [220, 270, 320, 370, 420, 470] as const

function normalizeExternalMediaSize(size: number) {
  return Math.min(6, Math.max(1, Math.round(size)))
}

export function getHorizontalExternalMediaCardWidth(size: number) {
  return horizontalCardWidths[normalizeExternalMediaSize(size) - 1]
}

export function getVerticalExternalMediaCardWidth(size: number) {
  return verticalCardWidths[normalizeExternalMediaSize(size) - 1]
}

export function getPortraitExternalMediaBackdropWidth(playerWidth: number) {
  return Math.round(playerWidth * (16 / 9))
}

export function resolveExternalMediaPreviewLayout(
  preview: ExternalMediaPreview,
  horizontalSize: number,
  verticalSize: number,
  isBubblePresentation: boolean,
) {
  const isPortrait = preview.format === 'portrait'
  const playerWidth = isPortrait
    ? getVerticalExternalMediaCardWidth(verticalSize)
    : getHorizontalExternalMediaCardWidth(horizontalSize)
  const shouldUseBackdrop =
    isBubblePresentation && isPortrait && Boolean(preview.thumbnailUrl)

  return {
    cardWidth: shouldUseBackdrop
      ? getPortraitExternalMediaBackdropWidth(playerWidth)
      : playerWidth,
    playerWidth,
    isPortrait,
    shouldCenter: isBubblePresentation && isPortrait,
    shouldUseBackdrop,
  } as const
}

export function getExternalMediaPreviewListWidth(
  previews: readonly ExternalMediaPreview[],
  horizontalSize: number,
  verticalSize: number,
  isBubblePresentation = false,
) {
  if (previews.length === 0) {
    return null
  }

  return Math.max(
    ...previews.map(
      (preview) =>
        resolveExternalMediaPreviewLayout(
          preview,
          horizontalSize,
          verticalSize,
          isBubblePresentation,
        ).cardWidth,
    ),
  )
}

export function resolveExternalMediaBubbleWidth({
  body,
  enabled,
  parentHost,
  horizontalSize,
  verticalSize,
}: {
  body: string | null
  enabled: boolean
  parentHost: string
  horizontalSize: number
  verticalSize: number
}) {
  if (!enabled) {
    return null
  }

  return getExternalMediaPreviewListWidth(
    findExternalMedia(body, parentHost),
    horizontalSize,
    verticalSize,
    true,
  )
}
