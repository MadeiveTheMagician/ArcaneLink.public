import { useCallback, useLayoutEffect, useRef } from 'react'
import type { ServerRailLayout } from './serverRailFolders'

type Position = { x: number; y: number }

export function useServerRailReflow(
  columns: number,
  layout: ServerRailLayout,
  expandedFolderId: string | null,
  isOpen: boolean,
  isLoading: boolean,
) {
  const listRef = useRef<HTMLDivElement>(null)
  const previous = useRef<{ columns: number; positions: Map<string, Position> } | null>(null)
  const animations = useRef(new Map<HTMLElement, Animation>())
  const stopReflow = useCallback(() => {
    for (const animation of animations.current.values()) animation.cancel()
    animations.current.clear()
  }, [])

  useLayoutEffect(() => {
    const list = listRef.current
    const rail = list?.parentElement
    const before = previous.current
    if (!list || !rail || !isOpen || isLoading) {
      stopReflow()
      previous.current = null
      return
    }

    const shouldAnimate = before && before.columns !== columns &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodes = Array.from(rail.querySelectorAll<HTMLElement>('[data-rail-item]'))
    const offsets = new Map<HTMLElement, Position>()
    if (shouldAnimate) {
      for (const node of nodes) {
        if (!animations.current.has(node)) continue
        const [x, y] = getComputedStyle(node).translate.split(' ').map(Number.parseFloat)
        offsets.set(node, { x: x || 0, y: y || 0 })
      }
    }
    stopReflow()

    const listRect = list.getBoundingClientRect()
    const railRect = rail.getBoundingClientRect()
    const positions = new Map<string, Position>()
    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      const enclosingFolder = node.parentElement?.closest('[data-rail-item]')
      const usesListOrigin = !enclosingFolder && list.contains(node)
      const origin = enclosingFolder?.getBoundingClientRect() ?? (usesListOrigin ? listRect : railRect)
      positions.set(node.dataset.railItem!, {
        x: rect.left - origin.left + (usesListOrigin ? list.scrollLeft : 0),
        y: rect.top - origin.top + (usesListOrigin ? list.scrollTop : 0),
      })
    }
    previous.current = { columns, positions }
    if (!shouldAnimate) return

    for (const node of nodes) {
      const key = node.dataset.railItem!
      const from = before.positions.get(key)
      const to = positions.get(key)!
      if (!from) continue

      const offset = offsets.get(node)
      const x = from.x - to.x + (offset?.x ?? 0)
      const y = from.y - to.y + (offset?.y ?? 0)
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) continue

      const animation = node.animate(
        [{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }],
        { duration: 220, easing: 'cubic-bezier(.22,.72,.26,1)' },
      )
      animations.current.set(node, animation)
      animation.onfinish = () => {
        if (animations.current.get(node) === animation) animations.current.delete(node)
      }
    }
  }, [columns, expandedFolderId, isLoading, isOpen, layout, stopReflow])

  useLayoutEffect(() => stopReflow, [stopReflow])
  return { listRef, stopReflow }
}
