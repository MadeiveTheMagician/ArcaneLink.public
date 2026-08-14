import { expect, test } from '@playwright/test'

import {
  detachedVoiceLayoutDefaultColumns,
  detachedVoiceLayoutDefaultRows,
  getDetachedSlotMenuPlacementStyle,
  normalizeDetachedVoicePreset,
  normalizeDetachedVoiceSlot,
  normalizeDetachedVoiceSlotAspectRatio,
  normalizeDetachedVoiceSlotChange,
  resizeDetachedVoicePresetSlots,
  syncDetachedSlotAssignments,
} from '../../src/system/Server/components/voice/detached/detachedVoiceLayoutModel'
import {
  bringDetachedSlotToFront,
  createDetachedWorkspaceLayoutState,
  getDetachedSlotVisualZIndex,
} from '../../src/system/Server/components/voice/detached/detachedVoiceLayoutState'
import {
  loadDetachedVoiceLayoutStorage,
  saveDetachedVoiceLayoutStorage,
} from '../../src/system/Server/components/voice/detached/detachedVoiceLayoutStorage'
import type {
  DetachedVoiceLayoutPreset,
  DetachedVoiceLayoutSlot,
} from '../../src/system/Server/components/voice/detached/detachedVoiceLayoutTypes'

function createSlot(
  patch: Partial<DetachedVoiceLayoutSlot> = {},
): DetachedVoiceLayoutSlot {
  return {
    index: 1,
    preserveAspectRatio: true,
    aspectRatio: '16:9',
    x: 0,
    y: 0,
    width: 32,
    height: 18,
    borderRadius: 8,
    zIndex: 1,
    mode: 'grid',
    ...patch,
  }
}

function createPreset(
  patch: Partial<DetachedVoiceLayoutPreset> = {},
): DetachedVoiceLayoutPreset {
  return {
    id: 'preset-test',
    name: 'Preset test',
    cellSizePx: 17,
    gridColumns: detachedVoiceLayoutDefaultColumns,
    gridRows: detachedVoiceLayoutDefaultRows,
    isPinned: false,
    isPersisted: false,
    showParticipantsWithoutVideo: true,
    hideServiceInfo: false,
    slots: [createSlot()],
    ...patch,
  }
}

function installMemoryLocalStorage() {
  const values = new Map<string, string>()
  const localStorage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
    get length() {
      return values.size
    },
  } satisfies Storage

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  })

  return localStorage
}

test.describe('detached voice layout model', () => {
  test('normalizes aspect-ratio defaults', () => {
    expect(normalizeDetachedVoiceSlotAspectRatio(undefined, true)).toBe('16:9')
    expect(normalizeDetachedVoiceSlotAspectRatio(undefined, false)).toBe('free')
    expect(normalizeDetachedVoiceSlotAspectRatio('21:9', false)).toBe('21:9')
  })

  test('clamps slot geometry and preserves the selected aspect ratio', () => {
    const slot = normalizeDetachedVoiceSlot(
      createSlot({
        x: -12,
        y: 100,
        width: 200,
        height: 70,
        borderRadius: 999,
        zIndex: 1000,
      }),
      90,
      44,
    )

    expect(slot.x).toBe(0)
    expect(slot.y).toBe(0)
    expect(slot.width / slot.height).toBeCloseTo(16 / 9)
    expect(slot.width).toBeLessThanOrEqual(90)
    expect(slot.height).toBeLessThanOrEqual(44)
    expect(slot.borderRadius).toBe(360)
    expect(slot.zIndex).toBe(999)
  })

  test('updates the paired dimension when a locked slot is resized', () => {
    const slot = normalizeDetachedVoiceSlotChange(
      createSlot({ aspectRatio: '21:9' }),
      'width',
      42,
      90,
      44,
    )

    expect(slot.width).toBe(42)
    expect(slot.height).toBe(18)
  })

  test('normalizes preset limits and every nested slot', () => {
    const preset = normalizeDetachedVoicePreset(
      createPreset({
        cellSizePx: 2,
        gridColumns: 500,
        gridRows: 1,
        isPinned: true,
        isPersisted: undefined,
        slots: [createSlot({ x: 999, y: 999, width: 999, height: 999 })],
      }),
    )

    expect(preset.cellSizePx).toBe(6)
    expect(preset.gridColumns).toBe(120)
    expect(preset.gridRows).toBe(2)
    expect(preset.isPinned).toBe(true)
    expect(preset.isPersisted).toBe(false)
    expect(preset.slots[0].x).toBeGreaterThanOrEqual(0)
    expect(preset.slots[0].x + preset.slots[0].width).toBeLessThanOrEqual(120)
    expect(preset.slots[0].y + preset.slots[0].height).toBeLessThanOrEqual(2)
  })

  test('resizes the preset while preserving existing slots by index', () => {
    const preset = createPreset({
      slots: [createSlot({ index: 1, x: 7, y: 5 })],
    })
    const expanded = resizeDetachedVoicePresetSlots(preset, 3)
    const contracted = resizeDetachedVoicePresetSlots(expanded, 1)

    expect(expanded.slots).toHaveLength(3)
    expect(expanded.slots[0]).toMatchObject({ index: 1, x: 7, y: 5 })
    expect(expanded.slots.map((slot) => slot.index)).toEqual([1, 2, 3])
    expect(contracted.slots).toHaveLength(1)
    expect(contracted.slots[0].index).toBe(1)
  })

  test('removes stale assignments and fills free slots deterministically', () => {
    const assignments: Record<number, string> = {
      1: 'removed-card',
      9: 'card-b',
    }
    const slots = [createSlot({ index: 1 }), createSlot({ index: 2 })]

    syncDetachedSlotAssignments(assignments, ['card-a', 'card-b'], slots)

    expect(assignments).toEqual({ 1: 'card-a', 2: 'card-b' })
  })

  test('uses explicit Z first and last interaction inside the same layer', () => {
    const state = createDetachedWorkspaceLayoutState({
      version: 1,
      presets: [],
      lastPresetId: null,
      showParticipantsWithoutVideo: true,
      showSelfCamera: true,
      isTableView: false,
    })
    const first = createSlot({ index: 1, zIndex: 4 })
    const second = createSlot({ index: 2, zIndex: 4 })
    const upperLayer = createSlot({ index: 3, zIndex: 5 })

    bringDetachedSlotToFront(state, first.index)
    bringDetachedSlotToFront(state, second.index)

    expect(getDetachedSlotVisualZIndex(state, second)).toBeGreaterThan(
      getDetachedSlotVisualZIndex(state, first),
    )
    expect(getDetachedSlotVisualZIndex(state, upperLayer)).toBeGreaterThan(
      getDetachedSlotVisualZIndex(state, second),
    )
  })

  test('places settings in the opposite screen quadrant', () => {
    const topLeft = getDetachedSlotMenuPlacementStyle(
      createSlot({ x: 0, y: 0, width: 10, height: 10 }),
      100,
      100,
    )
    const bottomRight = getDetachedSlotMenuPlacementStyle(
      createSlot({ x: 80, y: 80, width: 10, height: 10 }),
      100,
      100,
    )

    expect(topLeft).toContain('right:')
    expect(topLeft).toContain('top:')
    expect(bottomRight).toContain('left:')
    expect(bottomRight).toContain('bottom:')
  })
})

test.describe('detached voice layout storage', () => {
  test.beforeEach(() => {
    installMemoryLocalStorage()
  })

  test('returns defaults for an empty or malformed snapshot', () => {
    expect(loadDetachedVoiceLayoutStorage()).toEqual({
      version: 1,
      presets: [],
      lastPresetId: null,
      showParticipantsWithoutVideo: true,
      showSelfCamera: true,
      isTableView: true,
    })

    window.localStorage.setItem('arcanelink.detachedVoiceLayout.v1', '{broken')
    expect(loadDetachedVoiceLayoutStorage().presets).toEqual([])
  })

  test('round-trips a normalized layout snapshot', () => {
    saveDetachedVoiceLayoutStorage({
      version: 1,
      presets: [createPreset({ cellSizePx: 999 })],
      lastPresetId: 'preset-test',
      showParticipantsWithoutVideo: false,
      showSelfCamera: false,
      isTableView: false,
    })

    const restored = loadDetachedVoiceLayoutStorage()

    expect(restored.lastPresetId).toBe('preset-test')
    expect(restored.showParticipantsWithoutVideo).toBe(false)
    expect(restored.showSelfCamera).toBe(false)
    expect(restored.isTableView).toBe(false)
    expect(restored.presets[0].cellSizePx).toBe(32)
  })
})
