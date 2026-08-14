import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type { PrivateSpaceTooltipModel } from './directMessageModel'
import styles from './PrivateSpaceListTooltip.module.css'

const showDelayMs = 320
const viewportGutter = 8
const anchorGap = 10

type PrivateSpaceListTooltipProps = {
  anchorRef: RefObject<HTMLElement | null>
  id: string
  isOpen: boolean
  model: PrivateSpaceTooltipModel
}

export function PrivateSpaceListTooltip({
  anchorRef,
  id,
  isOpen,
  model,
}: PrivateSpaceListTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    placement: 'right' as 'left' | 'right',
  })

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false)
      return undefined
    }

    const showTimer = window.setTimeout(() => setIsVisible(true), showDelayMs)
    return () => window.clearTimeout(showTimer)
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isVisible) return undefined

    function updatePosition() {
      const anchor = anchorRef.current
      const tooltip = tooltipRef.current
      if (!anchor || !tooltip) return

      const anchorRect = anchor.getBoundingClientRect()
      const tooltipWidth = tooltip.offsetWidth
      const tooltipHeight = tooltip.offsetHeight
      const hasRoomOnRight =
        window.innerWidth - anchorRect.right >=
        tooltipWidth + anchorGap + viewportGutter
      const placement = hasRoomOnRight ? 'right' : 'left'
      const left =
        placement === 'right'
          ? anchorRect.right + anchorGap
          : Math.max(
              viewportGutter,
              anchorRect.left - tooltipWidth - anchorGap,
            )
      const preferredTop =
        anchorRect.top + (anchorRect.height - tooltipHeight) / 2

      setPosition({
        left,
        top: Math.min(
          window.innerHeight - tooltipHeight - viewportGutter,
          Math.max(viewportGutter, preferredTop),
        ),
        placement,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, isVisible, model.note, model.title])

  if (!isVisible) return null

  return createPortal(
    <div
      ref={tooltipRef}
      className={styles.tooltip}
      id={id}
      role="tooltip"
      data-placement={position.placement}
      style={{ left: position.left, top: position.top }}
    >
      <strong>{model.title}</strong>
      {model.note && (
        <>
          <span className={styles.separator} aria-hidden="true" />
          <p>{model.note}</p>
        </>
      )}
    </div>,
    document.body,
  )
}
