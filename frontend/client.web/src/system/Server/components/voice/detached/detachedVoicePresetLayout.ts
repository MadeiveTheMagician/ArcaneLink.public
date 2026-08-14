import { voiceCopy } from '../../../../shared/index'
import {
  normalizeDetachedVoiceSlot,
  syncDetachedSlotAssignments,
} from './detachedVoiceLayoutModel'
import {
  bringDetachedSlotToFront,
  getDetachedSlotVisualZIndex,
} from './detachedVoiceLayoutState'
import type {
  DetachedVoiceLayoutPreset,
  DetachedVoiceLayoutSlot,
  DetachedVoiceWorkspaceLayoutState,
} from './detachedVoiceLayoutTypes'
import {
  createDetachedCardArticle,
  createDetachedVoiceCardKey,
} from './detachedVoiceCards'
import type { VoiceParticipantCard } from './detachedVoiceWorkspaceTypes'

type DetachedVoicePresetLayoutOptions = {
  document: Document
  grid: HTMLElement
  layoutState: DetachedVoiceWorkspaceLayoutState
  activePreset: DetachedVoiceLayoutPreset
  visibleCards: VoiceParticipantCard[]
  cleanupCallbacks: Array<() => void>
  fallbackAccent: string
  onSelectSlotWithoutWorkspaceRender: (slotIndex: number) => void
  getSlot: (slotIndex: number) => DetachedVoiceLayoutSlot | null
  onSlotMoved: (
    slotIndex: number,
    patch: Partial<DetachedVoiceLayoutSlot>,
  ) => void
}

export function applyDetachedVoiceSlotStyle(
  article: HTMLElement,
  layoutState: DetachedVoiceWorkspaceLayoutState,
  preset: DetachedVoiceLayoutPreset,
  slot: DetachedVoiceLayoutSlot,
) {
  article.style.removeProperty('left')
  article.style.removeProperty('top')
  article.style.setProperty(
    '--detached-slot-left',
    `${slot.x * preset.cellSizePx}px`,
  )
  article.style.setProperty(
    '--detached-slot-top',
    `${slot.y * preset.cellSizePx}px`,
  )
  article.style.setProperty(
    '--detached-slot-width',
    `${slot.width * preset.cellSizePx}px`,
  )
  article.style.setProperty(
    '--detached-slot-height',
    `${slot.height * preset.cellSizePx}px`,
  )
  article.style.setProperty(
    '--detached-slot-z',
    String(getDetachedSlotVisualZIndex(layoutState, slot)),
  )
  article.style.setProperty('--detached-card-radius', `${slot.borderRadius}px`)
}

export function renderDetachedVoicePresetLayout({
  document,
  grid,
  layoutState,
  activePreset,
  visibleCards,
  cleanupCallbacks,
  fallbackAccent,
  onSelectSlotWithoutWorkspaceRender,
  getSlot,
  onSlotMoved,
}: DetachedVoicePresetLayoutOptions) {
  grid.classList.add('arcane-detached-preset-grid')
  grid.dataset.edit = layoutState.editMode ? 'true' : 'false'
  grid.style.setProperty(
    '--detached-layout-width',
    `${activePreset.gridColumns * activePreset.cellSizePx}px`,
  )
  grid.style.setProperty(
    '--detached-layout-height',
    `${activePreset.gridRows * activePreset.cellSizePx}px`,
  )
  grid.style.setProperty('--detached-cell-size', `${activePreset.cellSizePx}px`)

  syncDetachedSlotAssignments(
    layoutState.slotAssignments,
    visibleCards.map(createDetachedVoiceCardKey),
    activePreset.slots,
  )

  if (layoutState.editMode) {
    const verticalCenterLine = document.createElement('span')
    verticalCenterLine.className = 'arcane-detached-center-line'
    verticalCenterLine.dataset.axis = 'vertical'
    verticalCenterLine.setAttribute('aria-hidden', 'true')

    const horizontalCenterLine = document.createElement('span')
    horizontalCenterLine.className = 'arcane-detached-center-line'
    horizontalCenterLine.dataset.axis = 'horizontal'
    horizontalCenterLine.setAttribute('aria-hidden', 'true')
    grid.append(verticalCenterLine, horizontalCenterLine)
  }

  const cardByKey = new Map(
    visibleCards.map((card) => [createDetachedVoiceCardKey(card), card]),
  )

  activePreset.slots.forEach((slot) => {
    const assignedCardKey = layoutState.slotAssignments[slot.index]
    const assignedCard = assignedCardKey ? cardByKey.get(assignedCardKey) : null
    const accent = assignedCard?.isSpeaking && assignedCard.mediaKind === 'camera'
      ? '80, 214, 143'
      : assignedCard?.accent ?? fallbackAccent
    const article = assignedCard
      ? createDetachedCardArticle(document, assignedCard, {
          accent: activePreset.hideServiceInfo ? assignedCard.accent : accent,
          borderRadius: slot.borderRadius,
          cleanupCallbacks,
          hideServiceInfo: activePreset.hideServiceInfo,
          screenSuffix: voiceCopy.channel.screenSuffix,
        })
      : document.createElement('article')

    if (!assignedCard && !layoutState.editMode) {
      return
    }

    if (!assignedCard) {
      article.className = 'arcane-detached-empty-slot'
      article.textContent = voiceCopy.detached.slotTitle(slot.index)
    }

    article.classList.add('arcane-detached-slot')
    article.dataset.slotIndex = String(slot.index)
    article.dataset.edit = layoutState.editMode ? 'true' : 'false'
    article.dataset.selectedSlot =
      layoutState.selectedSlotIndex === slot.index ? 'true' : 'false'
    applyDetachedVoiceSlotStyle(article, layoutState, activePreset, slot)
    article.draggable = false
    article.addEventListener('dragstart', (event) => event.preventDefault())

    if (!layoutState.editMode) {
      grid.append(article)
      return
    }

    const badge = document.createElement('button')
    badge.type = 'button'
    badge.className = 'arcane-detached-slot-badge'
    badge.textContent = `№${slot.index}`
    badge.addEventListener('click', (event) => {
      event.stopPropagation()
      onSelectSlotWithoutWorkspaceRender(slot.index)
    })
    article.append(badge)

    let cleanupDrag: (() => void) | null = null

    article.addEventListener('pointerdown', (event) => {
      const popupView = document.defaultView
      const targetElement =
        popupView && event.target instanceof popupView.HTMLElement
          ? event.target
          : null

      if (!targetElement) {
        return
      }

      if (
        targetElement.tagName === 'BUTTON' ||
        targetElement.tagName === 'SELECT' ||
        targetElement.tagName === 'INPUT'
      ) {
        return
      }

      event.preventDefault()
      const startX = event.clientX
      const startY = event.clientY
      const startSlot = { ...(getSlot(slot.index) ?? slot) }
      let moved = false
      article.style.cursor = 'grabbing'

      cleanupDrag?.()

      const calculateSlotFromPointer = (clientX: number, clientY: number) => {
        const rect = grid.getBoundingClientRect()
        const deltaX = clientX - startX
        const deltaY = clientY - startY
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
          moved = true
        }

        const nextX = startSlot.mode === 'grid'
          ? Math.round(
              startSlot.x + (deltaX / rect.width) * activePreset.gridColumns,
            )
          : startSlot.x + (deltaX / rect.width) * activePreset.gridColumns
        const nextY = startSlot.mode === 'grid'
          ? Math.round(
              startSlot.y + (deltaY / rect.height) * activePreset.gridRows,
            )
          : startSlot.y + (deltaY / rect.height) * activePreset.gridRows

        return normalizeDetachedVoiceSlot(
          {
            ...startSlot,
            x: nextX,
            y: nextY,
          },
          activePreset.gridColumns,
          activePreset.gridRows,
        )
      }

      const moveSlot = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault()
        const previewSlot = calculateSlotFromPointer(
          moveEvent.clientX,
          moveEvent.clientY,
        )

        article.style.left = `${previewSlot.x * activePreset.cellSizePx}px`
        article.style.top = `${previewSlot.y * activePreset.cellSizePx}px`
      }

      const finishDrag = (upEvent: PointerEvent) => {
        upEvent.preventDefault()
        cleanupDrag?.()
        cleanupDrag = null
        article.style.cursor = 'grab'

        const movedSlot = calculateSlotFromPointer(
          upEvent.clientX,
          upEvent.clientY,
        )

        if (moved) {
          bringDetachedSlotToFront(layoutState, slot.index)
          layoutState.selectedSlotIndex = slot.index
          onSlotMoved(slot.index, {
            x: movedSlot.x,
            y: movedSlot.y,
          })
        } else {
          onSelectSlotWithoutWorkspaceRender(slot.index)
        }
      }

      document.addEventListener('pointermove', moveSlot)
      document.addEventListener('pointerup', finishDrag, { once: true })
      document.addEventListener('pointercancel', finishDrag, { once: true })
      cleanupDrag = () => {
        document.removeEventListener('pointermove', moveSlot)
        document.removeEventListener('pointerup', finishDrag)
        document.removeEventListener('pointercancel', finishDrag)
      }
      cleanupCallbacks.push(() => cleanupDrag?.())
    })

    grid.append(article)
  })
}
