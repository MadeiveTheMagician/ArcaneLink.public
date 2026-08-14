import { voiceCopy } from '../../../../shared/index'
import {
  clampNumber,
  detachedVoiceLayoutMinSlotSize,
  detachedVoiceSlotMaxBorderRadius,
  getDetachedSlotMenuPlacementStyle,
  normalizeDetachedVoiceSlot,
  normalizeDetachedVoiceSlotAspectRatio,
  normalizeDetachedVoiceSlotChange,
} from './detachedVoiceLayoutModel'
import type {
  DetachedVoiceLayoutPreset,
  DetachedVoiceLayoutSlot,
  DetachedVoiceWorkspaceLayoutState,
} from './detachedVoiceLayoutTypes'
import {
  createDetachedCheckboxLabel,
  createDetachedDropdownButton,
  createDetachedDropdownMenu,
  createDetachedFieldGrid,
  createDetachedIconButton,
  createDetachedLabeledField,
  createDetachedMenuOption,
  createDetachedNumberInput,
  createDetachedRadioGroup,
} from './detachedVoiceDom'
import { bindDetachedVoiceDropdown } from './detachedVoiceDropdown'
import { createDetachedVoiceCardKey } from './detachedVoiceCards'
import type { VoiceParticipantCard } from './detachedVoiceWorkspaceTypes'

type DetachedVoiceSlotMenuOptions = {
  document: Document
  host: HTMLElement
  layoutState: DetachedVoiceWorkspaceLayoutState
  selectedPreset: DetachedVoiceLayoutPreset | null
  selectedSlot: DetachedVoiceLayoutSlot | null | undefined
  cardOptions: VoiceParticipantCard[]
  onUpdateSlot: (
    slotIndex: number,
    patch: Partial<DetachedVoiceLayoutSlot>,
  ) => DetachedVoiceLayoutSlot | null
  onMenuRenderRequested: () => void
  onWorkspaceRenderRequested: () => void
  onMenuLockChange: (unlocked: boolean) => void
  onMenuPositionChange: (position: { x: number; y: number } | null) => void
}

function getDetachedCardOptionLabel(card: VoiceParticipantCard) {
  return card.mediaKind === 'screen'
    ? `${card.participant.displayName} · ${voiceCopy.channel.screenSuffix}`
    : card.participant.displayName
}

export function renderDetachedVoiceSlotMenu({
  document,
  host,
  layoutState,
  selectedPreset,
  selectedSlot,
  cardOptions,
  onUpdateSlot,
  onMenuRenderRequested,
  onWorkspaceRenderRequested,
  onMenuLockChange,
  onMenuPositionChange,
}: DetachedVoiceSlotMenuOptions) {
  host.replaceChildren()

  if (!layoutState.editMode || !selectedPreset || !selectedSlot) {
    return
  }

  const slotMenu = document.createElement('div')
  slotMenu.className = 'arcane-popover arcane-detached-slot-menu'
  slotMenu.dataset.detachedSlotMenu = 'true'
  const placementSlot = layoutState.slotMenuPlacementSlot ?? selectedSlot
  if (
    layoutState.slotMenuPositionUnlocked &&
    layoutState.slotMenuPosition
  ) {
    slotMenu.style.cssText = [
      `left:${layoutState.slotMenuPosition.x}px`,
      `top:${layoutState.slotMenuPosition.y}px`,
      'right:auto',
      'bottom:auto',
      'transform-origin:50% 0',
    ].join(';')
  } else {
    slotMenu.style.cssText = getDetachedSlotMenuPlacementStyle(
      placementSlot,
      selectedPreset.gridColumns,
      selectedPreset.gridRows,
    )
  }
  slotMenu.dataset.positionUnlocked = layoutState.slotMenuPositionUnlocked
    ? 'true'
    : 'false'

  let currentSlot = selectedSlot

  const title = document.createElement('strong')
  title.className = 'arcane-detached-panel-title'
  title.textContent = voiceCopy.detached.slotTitle(selectedSlot.index)

  const header = document.createElement('div')
  header.className = 'arcane-detached-slot-menu-header'
  const lockButton = createDetachedIconButton(document, {
    label: layoutState.slotMenuPositionUnlocked
      ? voiceCopy.detached.slotMenuLock
      : voiceCopy.detached.slotMenuUnlock,
    icon: layoutState.slotMenuPositionUnlocked ? 'unlock' : 'lock',
    onClick: () => {
      const nextUnlocked = !layoutState.slotMenuPositionUnlocked
      onMenuLockChange(nextUnlocked)
      if (!nextUnlocked) {
        onMenuPositionChange(null)
      }
      onMenuRenderRequested()
    },
  })
  lockButton.classList.add('arcane-detached-slot-menu-lock')
  header.append(title, lockButton)

  const assignmentDropdown = document.createElement('div')
  assignmentDropdown.className = 'arcane-detached-assignment-dropdown'
  assignmentDropdown.dataset.detachedSlotAssignmentDropdown = 'true'

  const selectedAssignmentKey =
    layoutState.slotAssignments[selectedSlot.index] ?? ''
  const selectedAssignmentCard = cardOptions.find(
    (card) => createDetachedVoiceCardKey(card) === selectedAssignmentKey,
  )
  const assignmentButton = createDetachedDropdownButton(document, {
    variant: 'slot',
    text: selectedAssignmentCard
      ? getDetachedCardOptionLabel(selectedAssignmentCard)
      : voiceCopy.detached.emptySlot,
  })

  const assignmentMenu = createDetachedDropdownMenu(document)
  const assignmentOptions = [
    { key: '', label: voiceCopy.detached.emptySlot },
    ...cardOptions.map((card) => ({
      key: createDetachedVoiceCardKey(card),
      label: getDetachedCardOptionLabel(card),
    })),
  ]

  assignmentOptions.forEach((option) => {
    const optionButton = createDetachedMenuOption(document, {
      text: option.label,
      active: selectedAssignmentKey === option.key,
      padding: '8px 9px',
      onSelect: () => {
        if (option.key) {
          Object.entries(layoutState.slotAssignments).forEach(
            ([slotIndex, cardKey]) => {
              if (cardKey === option.key) {
                delete layoutState.slotAssignments[Number(slotIndex)]
              }
            },
          )
          layoutState.slotAssignments[selectedSlot.index] = option.key
        } else {
          delete layoutState.slotAssignments[selectedSlot.index]
        }
        assignmentDropdownController.close()
        onWorkspaceRenderRequested()
      },
    })
    assignmentMenu.append(optionButton)
  })

  const assignmentDropdownController = bindDetachedVoiceDropdown({
    document,
    root: assignmentDropdown,
    trigger: assignmentButton,
    menu: assignmentMenu,
  })
  assignmentDropdown.append(assignmentButton, assignmentMenu)

  const geometryGrid = createDetachedFieldGrid(document, {
    columns: 5,
    maxColumnWidth: '48px',
  })
  const geometryLabels: Record<'x' | 'y' | 'width' | 'height', string> = {
    x: 'X',
    y: 'Y',
    width: voiceCopy.detached.widthShort,
    height: voiceCopy.detached.heightShort,
  }
  ;(['x', 'y', 'width', 'height'] as const).forEach((field) => {
    const input = createDetachedNumberInput(document, {
      value: selectedSlot[field],
      step: selectedSlot.mode === 'grid' ? '1' : '0.01',
      min: field === 'width' || field === 'height'
        ? detachedVoiceLayoutMinSlotSize
        : 0,
      title: field,
    })
    input.addEventListener('change', () => {
      const rawValue = Number(input.value)
      const normalizedSlot = normalizeDetachedVoiceSlotChange(
        currentSlot,
        field,
        Number.isFinite(rawValue) ? rawValue : currentSlot[field],
        selectedPreset.gridColumns,
        selectedPreset.gridRows,
      )
      currentSlot = onUpdateSlot(currentSlot.index, {
        x: normalizedSlot.x,
        y: normalizedSlot.y,
        width: normalizedSlot.width,
        height: normalizedSlot.height,
      }) ?? currentSlot
    })
    geometryGrid.append(
      createDetachedLabeledField(document, geometryLabels[field], input),
    )
  })

  const zInput = createDetachedNumberInput(document, {
    value: selectedSlot.zIndex,
    step: 1,
    min: 0,
    max: 999,
    title: voiceCopy.detached.slotZLayerTitle,
  })
  zInput.addEventListener('change', () => {
    const zIndex = clampNumber(Math.round(Number(zInput.value) || 0), 0, 999)
    currentSlot = onUpdateSlot(currentSlot.index, { zIndex }) ?? currentSlot
  })
  geometryGrid.append(createDetachedLabeledField(document, 'Z', zInput))

  const radiusInput = createDetachedNumberInput(document, {
    value: selectedSlot.borderRadius,
    min: 0,
    max: detachedVoiceSlotMaxBorderRadius,
    step: 1,
    title: voiceCopy.detached.borderRadiusTitle,
  })
  radiusInput.addEventListener('change', () => {
    const borderRadius = clampNumber(
      Math.round(Number(radiusInput.value) || 0),
      0,
      detachedVoiceSlotMaxBorderRadius,
    )
    currentSlot = onUpdateSlot(currentSlot.index, { borderRadius }) ?? currentSlot
  })

  const currentAspectRatio = normalizeDetachedVoiceSlotAspectRatio(
    selectedSlot.aspectRatio,
    selectedSlot.preserveAspectRatio,
  )
  const aspectRatioGroup = createDetachedRadioGroup(document, {
    legend: voiceCopy.detached.aspectRatioLegend,
    name: `slot-${selectedSlot.index}-aspect-ratio`,
    value: currentAspectRatio,
    items: [
      { value: '16:9', label: '16:9' },
      { value: '21:9', label: '21:9' },
      { value: '4:3', label: '4:3' },
      { value: 'free', label: voiceCopy.detached.freeAspectRatio },
    ],
    onChange: (value) => {
      const normalizedSlot = normalizeDetachedVoiceSlot(
        {
          ...currentSlot,
          aspectRatio: value,
          preserveAspectRatio: value !== 'free',
        },
        selectedPreset.gridColumns,
        selectedPreset.gridRows,
      )
      currentSlot = onUpdateSlot(currentSlot.index, {
        aspectRatio: value,
        preserveAspectRatio: value !== 'free',
        width: normalizedSlot.width,
        height: normalizedSlot.height,
        x: normalizedSlot.x,
        y: normalizedSlot.y,
      }) ?? currentSlot
      onMenuRenderRequested()
    },
  })

  const freeModeLabel = createDetachedCheckboxLabel(
    document,
    voiceCopy.detached.freeMovement,
    {
      checked: selectedSlot.mode === 'free',
      variant: 'inline',
      onChange: (checked) => {
        currentSlot = onUpdateSlot(currentSlot.index, {
          mode: checked ? 'free' : 'grid',
        }) ?? currentSlot
      },
    },
  )

  slotMenu.append(
    header,
    createDetachedLabeledField(
      document,
      voiceCopy.detached.slotOwner,
      assignmentDropdown,
    ),
    geometryGrid,
    createDetachedLabeledField(
      document,
      voiceCopy.detached.borderRadius,
      radiusInput,
    ),
    aspectRatioGroup,
    freeModeLabel,
  )
  host.append(slotMenu)

  let cleanupPanelDrag: (() => void) | null = null
  header.addEventListener('pointerdown', (event) => {
    if (
      !layoutState.slotMenuPositionUnlocked ||
      Boolean(event.target && lockButton.contains(event.target as Node))
    ) {
      return
    }

    event.preventDefault()
    const view = document.defaultView
    const rect = slotMenu.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const initialLeft = rect.left
    const initialTop = rect.top
    slotMenu.style.right = 'auto'
    slotMenu.style.bottom = 'auto'

    const movePanel = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      const maxX = Math.max(8, (view?.innerWidth ?? rect.right) - rect.width - 8)
      const maxY = Math.max(8, (view?.innerHeight ?? rect.bottom) - rect.height - 8)
      const x = clampNumber(initialLeft + moveEvent.clientX - startX, 8, maxX)
      const y = clampNumber(initialTop + moveEvent.clientY - startY, 8, maxY)
      slotMenu.style.left = `${x}px`
      slotMenu.style.top = `${y}px`
    }

    const finishPanelDrag = () => {
      cleanupPanelDrag?.()
      cleanupPanelDrag = null
      onMenuPositionChange({
        x: Number.parseFloat(slotMenu.style.left) || slotMenu.getBoundingClientRect().left,
        y: Number.parseFloat(slotMenu.style.top) || slotMenu.getBoundingClientRect().top,
      })
    }

    document.addEventListener('pointermove', movePanel)
    document.addEventListener('pointerup', finishPanelDrag, { once: true })
    document.addEventListener('pointercancel', finishPanelDrag, { once: true })
    cleanupPanelDrag = () => {
      document.removeEventListener('pointermove', movePanel)
      document.removeEventListener('pointerup', finishPanelDrag)
      document.removeEventListener('pointercancel', finishPanelDrag)
    }
  })

  return () => {
    cleanupPanelDrag?.()
    assignmentDropdownController.cleanup()
  }
}
