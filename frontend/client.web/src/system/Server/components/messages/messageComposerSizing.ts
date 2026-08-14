export const desktopComposerWorkspaceRatio = 0.5
export const mobileComposerMaximumLineCount = 5

type MessageComposerMaximumHeightInput = {
  isMobile: boolean
  lineHeight: number
  minimumHeight: number
  verticalPadding: number
  workspaceHeight: number
}

export function getMessageComposerMaximumHeight({
  isMobile,
  lineHeight,
  minimumHeight,
  verticalPadding,
  workspaceHeight,
}: MessageComposerMaximumHeightInput) {
  if (isMobile) {
    return Math.max(
      minimumHeight,
      lineHeight * mobileComposerMaximumLineCount + verticalPadding,
    )
  }

  return Math.max(
    minimumHeight,
    Math.floor(workspaceHeight * desktopComposerWorkspaceRatio),
  )
}

export function getMessageComposerHeight(
  scrollHeight: number,
  minimumHeight: number,
  maximumHeight: number,
) {
  return Math.min(Math.max(scrollHeight, minimumHeight), maximumHeight)
}
