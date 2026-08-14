import { useState } from 'react'
import type { PointerEvent } from 'react'

export const defaultSidePanelWidth = 300
export const defaultMemberPanelWidth = 300

const sidePanelMinWidth = 250
const sidePanelMaxWidth = 520
const memberPanelMinWidth = 54
const memberPanelMaxWidth = 520
const memberPanelCompactWidth = 100

type PanelResizeOptions = {
  initialSidePanelWidth?: number
  initialMemberPanelWidth?: number
  onWidthsChange?: (widths: {
    sidePanelWidth: number
    memberPanelWidth: number
  }) => void
}

export function usePanelResize({
  initialSidePanelWidth = defaultSidePanelWidth,
  initialMemberPanelWidth = defaultMemberPanelWidth,
  onWidthsChange,
}: PanelResizeOptions = {}) {
  const [sidePanelWidth, setSidePanelWidth] = useState(initialSidePanelWidth)
  const [memberPanelWidth, setMemberPanelWidth] = useState(
    initialMemberPanelWidth,
  )

  const isMemberPanelCompact = memberPanelWidth <= memberPanelCompactWidth

  function startPaneResize(
    pane: 'spaces' | 'members' | 'hub',
    event: PointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault()

    const startX = event.clientX
    const startWidth = pane === 'members' ? memberPanelWidth : sidePanelWidth
    const pageElement = event.currentTarget.closest('.profile-page') as
      | HTMLElement
      | null

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // The window listeners below keep resize stable if capture is unavailable.
    }

    function resolveNextWidth(pointerEvent: globalThis.PointerEvent) {
      const rawWidth =
        pane === 'members'
          ? startWidth + startX - pointerEvent.clientX
          : startWidth + pointerEvent.clientX - startX

      return Math.round(
        pane === 'members'
          ? Math.min(Math.max(rawWidth, memberPanelMinWidth), memberPanelMaxWidth)
          : Math.min(Math.max(rawWidth, sidePanelMinWidth), sidePanelMaxWidth),
      )
    }

    function applyWidth(width: number) {
      if (!pageElement) {
        return
      }

      if (pane === 'members') {
        pageElement.style.setProperty('--profile-member-panel-width', `${width}px`)
        return
      }

      pageElement.style.setProperty('--profile-side-panel-width', `${width}px`)
      pageElement.style.setProperty('--profile-space-panel-width', `${width}px`)
    }

    function handlePointerMove(pointerEvent: globalThis.PointerEvent) {
      pointerEvent.preventDefault()
      applyWidth(resolveNextWidth(pointerEvent))
    }

    function finishResize(pointerEvent: globalThis.PointerEvent) {
      const nextWidth = resolveNextWidth(pointerEvent)

      applyWidth(nextWidth)

      if (pane === 'members') {
        setMemberPanelWidth(nextWidth)
        onWidthsChange?.({
          sidePanelWidth,
          memberPanelWidth: nextWidth,
        })
      } else {
        setSidePanelWidth(nextWidth)
        onWidthsChange?.({
          sidePanelWidth: nextWidth,
          memberPanelWidth,
        })
      }

      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishResize)
      window.removeEventListener('pointercancel', finishResize)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishResize)
    window.addEventListener('pointercancel', finishResize)
  }

  return {
    spacePanelWidth: sidePanelWidth,
    memberPanelWidth,
    hubPanelWidth: sidePanelWidth,
    isMemberPanelCompact,
    startPaneResize,
  }
}
