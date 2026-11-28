import { useEffect, useRef, type PointerEvent } from 'react'
import { SystemIcon, voiceCopy } from '../../shared'
import styles from './MobileVoiceDock.module.css'

export type DockPosition = { x: number; y: number }

type Gesture = {
  pointerId: number
  startX: number
  startY: number
  origin: DockPosition
  moved: boolean
}

const edge = 12
const minimumDrag = 6

function clampPosition(position: DockPosition, width: number, height: number): DockPosition {
  return {
    x: Math.max(edge, Math.min(position.x, window.innerWidth - width - edge)),
    y: Math.max(edge, Math.min(position.y, window.innerHeight - height - edge)),
  }
}

export function MobileCollapsedVoiceDock({
  avatarSrc, position, isClosing, onMove, onExpand,
}: {
  avatarSrc: string
  position: DockPosition | null
  isClosing: boolean
  onMove: (position: DockPosition) => void
  onExpand: () => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const gesture = useRef<Gesture | null>(null)

  const hasPosition = position !== null
  useEffect(() => {
    if (!hasPosition) return
    function fitViewport() {
      const button = buttonRef.current
      if (!button) return
      const rect = button.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const next = clampPosition({ x: rect.left, y: rect.top }, rect.width, rect.height)
      if (next.x !== rect.left || next.y !== rect.top) onMove(next)
    }
    window.addEventListener('resize', fitViewport)
    fitViewport()
    return () => window.removeEventListener('resize', fitViewport)
  }, [hasPosition, onMove])

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary) return
    const bounds = event.currentTarget.getBoundingClientRect()
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: bounds.left, y: bounds.top },
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    const dx = event.clientX - active.startX
    const dy = event.clientY - active.startY
    if (!active.moved && Math.hypot(dx, dy) < minimumDrag) return
    active.moved = true
    const { width, height } = event.currentTarget.getBoundingClientRect()
    onMove(clampPosition({ x: active.origin.x + dx, y: active.origin.y + dy }, width, height))
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.pointerId === event.pointerId) gesture.current = null
  }

  return (
    <button
      ref={buttonRef}
      className={`${styles.collapsedDock} ${isClosing ? styles.closing : ''}`}
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
      type="button"
      disabled={isClosing}
      data-mobile-voice-collapsed="true"
      aria-label={voiceCopy.channel.expandConnectionPanel}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={(event) => {
        const active = gesture.current
        endDrag(event)
        if (active?.pointerId === event.pointerId && !active.moved) onExpand()
      }}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onClick={(event) => {
        if (event.detail === 0) onExpand()
      }}
    >
      <img src={avatarSrc} alt="" draggable={false} />
      <span className={styles.collapsedCallIcon} aria-hidden="true">
        <SystemIcon name="phone-call" size={14} />
      </span>
    </button>
  )
}
