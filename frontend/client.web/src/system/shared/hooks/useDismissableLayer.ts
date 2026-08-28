import { useEffect, type RefObject } from 'react'

type DismissableLayerBoundary = EventTarget & {
  contains?: (target: Node) => boolean
}

type DismissableLayerEvent = Pick<Event, 'composedPath' | 'target'>

const dismissableLayerBranchAttribute = 'data-dismissable-layer-branch'

export function isPointerEventOutsideDismissableLayer(
  event: DismissableLayerEvent,
  layer: DismissableLayerBoundary | null,
  trigger: DismissableLayerBoundary | null = null,
) {
  return (
    !isEventInsideBoundary(event, layer) &&
    !isEventInsideBoundary(event, trigger) &&
    !isEventInsideDismissableLayerBranch(event)
  )
}

function isEventInsideDismissableLayerBranch(event: DismissableLayerEvent) {
  return event.composedPath().some(
    (target) =>
      'hasAttribute' in target &&
      typeof target.hasAttribute === 'function' &&
      target.hasAttribute(dismissableLayerBranchAttribute),
  )
}

export function isDismissableLayerEscapeKey(
  event: Pick<KeyboardEvent, 'defaultPrevented' | 'key'>,
) {
  return event.key === 'Escape' && !event.defaultPrevented
}

function isEventInsideBoundary(
  event: DismissableLayerEvent,
  boundary: DismissableLayerBoundary | null,
) {
  if (!boundary) return false

  if (event.composedPath().includes(boundary)) {
    return true
  }

  return (
    typeof Node !== 'undefined' &&
    event.target instanceof Node &&
    Boolean(boundary.contains?.(event.target))
  )
}

export function useDismissableLayer({
  isOpen,
  layerRef,
  onDismiss,
  triggerRef,
}: {
  isOpen: boolean
  layerRef: RefObject<HTMLElement | null>
  onDismiss: () => void
  triggerRef?: RefObject<HTMLElement | null>
}) {
  useEffect(() => {
    if (!isOpen) return undefined

    function dismissFromOutside(event: PointerEvent) {
      if (
        isPointerEventOutsideDismissableLayer(
          event,
          layerRef.current,
          triggerRef?.current,
        )
      ) {
        onDismiss()
      }
    }

    function dismissFromKeyboard(event: KeyboardEvent) {
      if (!isDismissableLayerEscapeKey(event)) return

      event.preventDefault()
      const trigger = triggerRef?.current
      onDismiss()
      trigger?.focus()
    }

    document.addEventListener('pointerdown', dismissFromOutside, true)
    document.addEventListener('keydown', dismissFromKeyboard)

    return () => {
      document.removeEventListener('pointerdown', dismissFromOutside, true)
      document.removeEventListener('keydown', dismissFromKeyboard)
    }
  }, [isOpen, layerRef, onDismiss, triggerRef])
}
