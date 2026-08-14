import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

const PRIVATE_VOICE_PANEL_MIN_HEIGHT = 274
const PRIVATE_VOICE_PANEL_CLOSE_DURATION_MS = 220
const PRIVATE_VOICE_PANEL_MAX_VIEWPORT_RATIO = 0.7

export function usePrivateVoicePanel(shouldShow: boolean) {
  const [isRendered, setIsRendered] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [height, setHeight] = useState(PRIVATE_VOICE_PANEL_MIN_HEIGHT)

  useEffect(() => {
    if (shouldShow) {
      setHeight((current) =>
        Math.max(PRIVATE_VOICE_PANEL_MIN_HEIGHT, current),
      )
      setIsRendered(true)
      setIsClosing(false)
      return undefined
    }

    if (!isRendered) return undefined

    setIsClosing(true)
    const timeoutId = window.setTimeout(() => {
      setIsRendered(false)
      setIsClosing(false)
    }, PRIVATE_VOICE_PANEL_CLOSE_DURATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [isRendered, shouldShow])

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = height
    const maxHeight = Math.max(
      PRIVATE_VOICE_PANEL_MIN_HEIGHT,
      Math.round(window.innerHeight * PRIVATE_VOICE_PANEL_MAX_VIEWPORT_RATIO),
    )
    setIsResizing(true)

    event.currentTarget.setPointerCapture?.(event.pointerId)

    function clampHeight(value: number) {
      return Math.min(
        Math.max(PRIVATE_VOICE_PANEL_MIN_HEIGHT, value),
        maxHeight,
      )
    }

    function handlePointerMove(pointerEvent: globalThis.PointerEvent) {
      pointerEvent.preventDefault()
      setHeight(clampHeight(startHeight + pointerEvent.clientY - startY))
    }

    function finishResize(pointerEvent: globalThis.PointerEvent) {
      pointerEvent.preventDefault()
      setHeight(clampHeight(startHeight + pointerEvent.clientY - startY))
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishResize)
      window.removeEventListener('pointercancel', finishResize)
      setIsResizing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishResize)
    window.addEventListener('pointercancel', finishResize)
  }

  return {
    height,
    isClosing,
    isRendered,
    isResizing,
    startResize,
  }
}
