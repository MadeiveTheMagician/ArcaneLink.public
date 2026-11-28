import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'

const holdDuration = 500
const movementTolerance = 10

export function useMobileSpaceContextMenu(openMenu: (x: number, y: number, autoFocus: boolean) => void) {
  const press = useRef<{ x: number; y: number; pointerId: number; timer: number } | null>(null)
  const didHold = useRef(false)

  const cancelPress = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
  }, [])
  useEffect(() => cancelPress, [cancelPress])

  return {
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (!event.isPrimary) return
      didHold.current = false
      if (event.pointerType !== 'touch') return

      const { clientX: x, clientY: y, pointerId } = event
      cancelPress()
      press.current = {
        x, y, pointerId,
        timer: window.setTimeout(() => {
          didHold.current = true
          openMenu(x, y, false)
        }, holdDuration),
      }
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      const active = press.current
      if (active?.pointerId === event.pointerId &&
          Math.hypot(event.clientX - active.x, event.clientY - active.y) > movementTolerance) {
        cancelPress()
      }
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    onLostPointerCapture: cancelPress,
    onContextMenu(event: MouseEvent<HTMLButtonElement>) {
      event.preventDefault()
      didHold.current ||= Boolean(press.current)
      cancelPress()
      openMenu(event.clientX, event.clientY, false)
    },
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
      event.preventDefault()
      const bounds = event.currentTarget.getBoundingClientRect()
      openMenu(bounds.left, bounds.bottom, true)
    },
    suppressTap(detail: number) {
      return didHold.current && detail > 0
    },
  }
}
