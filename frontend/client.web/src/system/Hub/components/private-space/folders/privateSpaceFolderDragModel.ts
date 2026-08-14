export type FolderDropPlacement = 'before' | 'after'

export type DragPoint = {
  x: number
  y: number
}

export type DragRect = {
  top: number
  left: number
  width: number
  height: number
}

type DropAxis = 'horizontal' | 'vertical'

const earlySwitchRatio = 0.45

export function resolvePointerDropPlacement({
  pointer,
  targetRect,
  axis,
}: {
  pointer: DragPoint
  targetRect: DragRect
  axis: DropAxis
}): FolderDropPlacement {
  const start = axis === 'horizontal' ? targetRect.left : targetRect.top
  const length = axis === 'horizontal' ? targetRect.width : targetRect.height
  const coordinate = axis === 'horizontal' ? pointer.x : pointer.y

  if (!Number.isFinite(length) || length <= 0) {
    return 'before'
  }

  return coordinate < start + length * earlySwitchRatio
    ? 'before'
    : 'after'
}

export function resolveFolderChipDropPlacement({
  pointer,
  targetRect,
  activeRect,
}: {
  pointer: DragPoint
  targetRect: DragRect
  activeRect?: DragRect | null
}): FolderDropPlacement {
  const targetCenterY = targetRect.top + targetRect.height / 2
  const activeCenterY = activeRect
    ? activeRect.top + activeRect.height / 2
    : targetCenterY
  const isSameRow =
    Math.abs(activeCenterY - targetCenterY) < targetRect.height * 0.7

  return resolvePointerDropPlacement({
    pointer,
    targetRect,
    axis: isSameRow ? 'horizontal' : 'vertical',
  })
}
