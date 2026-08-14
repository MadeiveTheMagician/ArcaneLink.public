import {
  createDefaultDetachedVoicePreset,
  detachedVoiceLayoutDefaultColumns,
  detachedVoiceLayoutDefaultRows,
} from './detachedVoiceLayoutModel'
import { saveDetachedVoiceLayoutStorage } from './detachedVoiceLayoutStorage'
import type {
  DetachedVoiceLayoutPreset,
  DetachedVoiceLayoutSlot,
  DetachedVoiceLayoutStorage,
  DetachedVoiceWorkspaceLayoutState,
} from './detachedVoiceLayoutTypes'

export function createDetachedWorkspaceLayoutState(
  storage: DetachedVoiceLayoutStorage,
): DetachedVoiceWorkspaceLayoutState {
  return {
    activePresetId: null,
    editMode: false,
    gridColumns: detachedVoiceLayoutDefaultColumns,
    gridRows: detachedVoiceLayoutDefaultRows,
    settingsMenuOpen: false,
    presets: storage.presets,
    selectedSlotIndex: null,
    showParticipantsWithoutVideo: storage.showParticipantsWithoutVideo,
    showSelfCamera: storage.showSelfCamera,
    isTableView: storage.isTableView,
    mainCardKey: null,
    slotAssignments: {},
    slotInteractionCounter: 0,
    slotInteractionOrder: {},
    slotMenuPositionUnlocked: false,
    slotMenuPosition: null,
    slotMenuPlacementSlot: null,
  }
}

export function persistDetachedWorkspaceLayoutState(
  state: DetachedVoiceWorkspaceLayoutState,
) {
  saveDetachedVoiceLayoutStorage({
    version: 1,
    presets: state.presets,
    lastPresetId: state.activePresetId,
    showParticipantsWithoutVideo: state.showParticipantsWithoutVideo,
    showSelfCamera: state.showSelfCamera,
    isTableView: state.isTableView,
  })
}

export function getActiveDetachedVoicePreset(
  state: DetachedVoiceWorkspaceLayoutState,
) {
  return state.presets.find(
    (preset) => preset.id === state.activePresetId,
  ) ?? null
}

export function saveDetachedActivePreset(
  state: DetachedVoiceWorkspaceLayoutState,
  patch: Partial<DetachedVoiceLayoutPreset>,
) {
  const activePreset = getActiveDetachedVoicePreset(state)
  if (!activePreset) {
    return
  }

  state.presets = state.presets.map((preset) =>
    preset.id === activePreset.id
      ? {
          ...preset,
          ...patch,
        }
      : preset,
  )
  persistDetachedWorkspaceLayoutState(state)
}

export function updateDetachedActivePresetSlot(
  state: DetachedVoiceWorkspaceLayoutState,
  slotIndex: number,
  patch: Partial<DetachedVoiceLayoutSlot>,
) {
  const activePreset = getActiveDetachedVoicePreset(state)
  if (!activePreset) {
    return
  }

  saveDetachedActivePreset(state, {
    slots: activePreset.slots.map((slot) =>
      slot.index === slotIndex
        ? {
            ...slot,
            ...patch,
          }
        : slot,
    ),
  })
}

export function activateDetachedVoicePreset(
  state: DetachedVoiceWorkspaceLayoutState,
  presetId: string | null,
) {
  const preset = state.presets.find((item) => item.id === presetId) ?? null
  state.activePresetId = preset?.id ?? null
  state.editMode = false
  state.selectedSlotIndex = null
  state.slotMenuPositionUnlocked = false
  state.slotMenuPosition = null
  state.slotMenuPlacementSlot = null
  state.gridColumns = preset?.gridColumns ?? detachedVoiceLayoutDefaultColumns
  state.gridRows = preset?.gridRows ?? detachedVoiceLayoutDefaultRows
  state.showParticipantsWithoutVideo =
    preset?.showParticipantsWithoutVideo ?? state.showParticipantsWithoutVideo
  state.slotAssignments = {}
  persistDetachedWorkspaceLayoutState(state)
}

export function createDetachedPresetFromCards(
  state: DetachedVoiceWorkspaceLayoutState,
  {
    cardCount,
    namePrefix,
  }: {
    cardCount: number
    namePrefix: string
  },
) {
  const presetNamePattern = new RegExp(`^${namePrefix} (\\d+)$`, 'i')
  const existingNumbers = state.presets
    .map((preset) => presetNamePattern.exec(preset.name)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
  const nextNumber = Math.max(0, ...existingNumbers) + 1
  const name = `${namePrefix} ${nextNumber}`

  const preset = createDefaultDetachedVoicePreset(
    name,
    cardCount,
    state.showParticipantsWithoutVideo,
  )
  state.presets = [...state.presets, preset]
  activateDetachedVoicePreset(state, preset.id)
  persistDetachedWorkspaceLayoutState(state)
  return preset
}

export function deleteDetachedActivePreset(
  state: DetachedVoiceWorkspaceLayoutState,
) {
  const activePreset = getActiveDetachedVoicePreset(state)
  if (!activePreset) {
    return null
  }

  state.presets = state.presets.filter(
    (preset) => preset.id !== activePreset.id,
  )
  state.activePresetId = null
  state.editMode = false
  state.selectedSlotIndex = null
  state.slotMenuPositionUnlocked = false
  state.slotMenuPosition = null
  state.slotMenuPlacementSlot = null
  state.slotAssignments = {}
  persistDetachedWorkspaceLayoutState(state)
  return activePreset
}

export function resetDetachedActivePreset(
  state: DetachedVoiceWorkspaceLayoutState,
  cardCount: number,
) {
  const activePreset = getActiveDetachedVoicePreset(state)
  if (!activePreset) {
    return
  }

  const defaultPreset = createDefaultDetachedVoicePreset(
    activePreset.name,
    cardCount,
    state.showParticipantsWithoutVideo,
  )

  state.presets = state.presets.map((preset) =>
    preset.id === activePreset.id
      ? {
          ...defaultPreset,
          id: activePreset.id,
          name: activePreset.name,
          isPinned: false,
          isPersisted: activePreset.isPersisted,
        }
      : preset,
  )
  state.editMode = true
  state.selectedSlotIndex = null
  state.slotMenuPositionUnlocked = false
  state.slotMenuPosition = null
  state.slotMenuPlacementSlot = null
  state.slotAssignments = {}
  persistDetachedWorkspaceLayoutState(state)
}

export function getDetachedSlotStackOrder(
  layoutState: DetachedVoiceWorkspaceLayoutState,
  slotIndex: number,
) {
  return layoutState.slotInteractionOrder[slotIndex] ?? 0
}

export function getDetachedSlotVisualZIndex(
  layoutState: DetachedVoiceWorkspaceLayoutState,
  slot: DetachedVoiceLayoutSlot,
) {
  return slot.zIndex * 1000 + getDetachedSlotStackOrder(layoutState, slot.index)
}

export function bringDetachedSlotToFront(
  layoutState: DetachedVoiceWorkspaceLayoutState,
  slotIndex: number,
) {
  layoutState.slotInteractionCounter += 1
  layoutState.slotInteractionOrder[slotIndex] =
    layoutState.slotInteractionCounter
}
