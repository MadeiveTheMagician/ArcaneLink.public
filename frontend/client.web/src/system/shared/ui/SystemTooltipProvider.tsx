import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { getContextMenuGridSector } from '../services/contextMenuPositioning'
import styles from './SystemTooltip.module.css'

const showDelayMs = 420
const viewportPadding = 12

type TooltipState = {
  content: string
  left: number
  top: number
  placement: 'above' | 'below'
  row: number
  column: number
}

function findTooltipTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null

  return target.closest<HTMLElement>('[data-tooltip], [title]')
}

function getTooltipContent(target: HTMLElement) {
  return target.dataset.tooltip?.trim() || target.getAttribute('title')?.trim() || ''
}

export function SystemTooltipProvider({ children }: { children: ReactNode }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const activeTargetRef = useRef<HTMLElement | null>(null)
  const nativeTitleRef = useRef<string | null>(null)
  const showTimerRef = useRef<number | null>(null)

  useEffect(() => {
    function clearTimer() {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current)
        showTimerRef.current = null
      }
    }

    function restoreNativeTitle() {
      const activeTarget = activeTargetRef.current
      const nativeTitle = nativeTitleRef.current

      if (activeTarget && nativeTitle !== null) {
        activeTarget.setAttribute('title', nativeTitle)
      }

      nativeTitleRef.current = null
    }

    function hideTooltip() {
      clearTimer()
      restoreNativeTitle()
      activeTargetRef.current = null
      setTooltip(null)
    }

    function showTooltip(target: HTMLElement) {
      const content = getTooltipContent(target)
      if (!content || target === activeTargetRef.current) return

      hideTooltip()
      activeTargetRef.current = target

      const nativeTitle = target.getAttribute('title')
      if (nativeTitle !== null) {
        nativeTitleRef.current = nativeTitle
        target.removeAttribute('title')
      }

      showTimerRef.current = window.setTimeout(() => {
        if (activeTargetRef.current !== target || !target.isConnected) return

        const rect = target.getBoundingClientRect()
        const estimatedTooltipWidth = Math.min(
          280,
          Math.max(48, content.length * 7 + 18),
        )
        const horizontalInset = viewportPadding + estimatedTooltipWidth / 2
        const targetCenterX = rect.left + rect.width / 2
        const sector = getContextMenuGridSector(
          targetCenterX,
          rect.top + rect.height / 2,
          window.innerWidth,
          window.innerHeight,
        )
        const preferredCenterX = sector.column === 4
          ? rect.left + estimatedTooltipWidth / 2
          : sector.column === 1
            ? rect.right - estimatedTooltipWidth / 2
            : targetCenterX
        const left = Math.min(
          window.innerWidth - horizontalInset,
          Math.max(horizontalInset, preferredCenterX),
        )
        const placement = sector.row === 1 ? 'below' : 'above'

        setTooltip({
          content,
          left,
          top: placement === 'above' ? rect.top : rect.bottom,
          placement,
          ...sector,
        })
      }, showDelayMs)
    }

    function handlePointerOver(event: PointerEvent) {
      const target = findTooltipTarget(event.target)
      if (target) showTooltip(target)
    }

    function handlePointerOut(event: PointerEvent) {
      const activeTarget = activeTargetRef.current
      if (!activeTarget || activeTarget.contains(event.relatedTarget as Node | null)) return

      hideTooltip()
    }

    function handleFocusIn(event: FocusEvent) {
      const target = findTooltipTarget(event.target)
      if (target) showTooltip(target)
    }

    function handleFocusOut(event: FocusEvent) {
      const activeTarget = activeTargetRef.current
      if (!activeTarget || activeTarget.contains(event.relatedTarget as Node | null)) return

      hideTooltip()
    }

    document.addEventListener('pointerover', handlePointerOver)
    document.addEventListener('pointerout', handlePointerOut)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    window.addEventListener('scroll', hideTooltip, true)
    window.addEventListener('resize', hideTooltip)

    return () => {
      hideTooltip()
      document.removeEventListener('pointerover', handlePointerOver)
      document.removeEventListener('pointerout', handlePointerOut)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      window.removeEventListener('scroll', hideTooltip, true)
      window.removeEventListener('resize', hideTooltip)
    }
  }, [])

  return (
    <>
      {children}
      {tooltip && createPortal(
        <div
          className={`${styles.tooltip} ${
            tooltip.placement === 'below' ? styles.below : ''
          }`}
          role="tooltip"
          data-tooltip-row={tooltip.row}
          data-tooltip-column={tooltip.column}
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          {tooltip.content}
        </div>,
        document.body,
      )}
    </>
  )
}
