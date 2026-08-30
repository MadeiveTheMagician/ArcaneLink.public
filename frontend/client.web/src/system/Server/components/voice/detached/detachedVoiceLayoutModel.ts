import type {
  DetachedVoiceLayoutPreset,
  DetachedVoiceLayoutSlot,
  DetachedVoiceLayoutSlotAspectRatio
} from './detachedVoiceLayoutTypes';

export const detachedVoiceLayoutDefaultColumns = 90;
export const detachedVoiceLayoutDefaultRows = 44;
export const detachedVoiceLayoutMaxColumns = 120;
export const detachedVoiceLayoutMaxRows = 54;
export const detachedVoiceLayoutMinSlotSize = 1;
export const detachedVoiceLayoutDefaultCellSizePx = 17;
export const detachedVoiceLayoutMinCellSizePx = 6;
export const detachedVoiceLayoutMaxCellSizePx = 32;
const detachedVoiceSlotDefaultScale = 0.75;
const detachedVoiceSlotAspectRatios: Record<
  Exclude<DetachedVoiceLayoutSlotAspectRatio, 'free'>,
  number
> = {
  '16:9': 16 / 9,
  '21:9': 21 / 9,
  '4:3': 4 / 3
};
const detachedVoiceSlotDefaultAspectRatio: Exclude<
  DetachedVoiceLayoutSlotAspectRatio,
  'free'
> = '16:9';
export const detachedVoiceSlotDefaultBorderRadius = 8;
export const detachedVoiceSlotMaxBorderRadius = 360;

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function syncDetachedSlotAssignments(
  assignments: Record<number, string>,
  cardKeys: string[],
  slots: DetachedVoiceLayoutSlot[]
) {
  const visibleKeys = new Set(cardKeys);
  const slotIndexes = new Set(slots.map((slot) => slot.index));
  const assignedKeys = new Set<string>();

  Object.entries(assignments).forEach(([slotIndex, cardKey]) => {
    const numericSlotIndex = Number(slotIndex);

    if (!slotIndexes.has(numericSlotIndex) || !visibleKeys.has(cardKey)) {
      delete assignments[numericSlotIndex];
      return;
    }

    assignedKeys.add(cardKey);
  });

  cardKeys.forEach((cardKey) => {
    if (assignedKeys.has(cardKey)) {
      return;
    }

    const freeSlot = slots.find((slot) => !assignments[slot.index]);
    if (!freeSlot) {
      return;
    }

    assignments[freeSlot.index] = cardKey;
    assignedKeys.add(cardKey);
  });
}

function getDetachedSlotQuadrant(
  slot: DetachedVoiceLayoutSlot,
  gridColumns: number,
  gridRows: number
) {
  const centerX = slot.x + slot.width / 2;
  const centerY = slot.y + slot.height / 2;
  const isLeft = centerX < gridColumns / 2;
  const isTop = centerY < gridRows / 2;

  if (isTop && isLeft) {
    return 1;
  }

  if (isTop) {
    return 2;
  }

  return isLeft ? 4 : 3;
}

export function getDetachedSlotMenuPlacementStyle(
  slot: DetachedVoiceLayoutSlot,
  gridColumns: number,
  gridRows: number
) {
  const quadrant = getDetachedSlotQuadrant(slot, gridColumns, gridRows);

  if (quadrant === 1) {
    return `
      top: 18px;
      right: clamp(12px, 2vw, 18px);
      transform-origin: 100% 0;
    `;
  }

  if (quadrant === 2) {
    return `
      top: 18px;
      left: clamp(12px, 2vw, 18px);
      transform-origin: 0 0;
    `;
  }

  if (quadrant === 3) {
    return `
      bottom: 88px;
      left: clamp(12px, 2vw, 18px);
      transform-origin: 0 100%;
    `;
  }

  return `
    right: clamp(12px, 2vw, 18px);
    bottom: 88px;
    transform-origin: 100% 100%;
  `;
}

export function normalizeDetachedVoiceSlotAspectRatio(
  value: unknown,
  preserveAspectRatio: boolean
): DetachedVoiceLayoutSlotAspectRatio {
  if (
    value === '16:9' ||
    value === '21:9' ||
    value === '4:3' ||
    value === 'free'
  ) {
    return value;
  }

  return preserveAspectRatio ? detachedVoiceSlotDefaultAspectRatio : 'free';
}

function getDetachedVoiceSlotAspectRatioValue(
  aspectRatio: DetachedVoiceLayoutSlotAspectRatio | undefined
) {
  if (!aspectRatio || aspectRatio === 'free') {
    return null;
  }

  return detachedVoiceSlotAspectRatios[aspectRatio];
}

export function normalizeDetachedVoiceSlot(
  slot: DetachedVoiceLayoutSlot,
  gridColumns: number,
  gridRows: number
): DetachedVoiceLayoutSlot {
  const aspectRatio = normalizeDetachedVoiceSlotAspectRatio(
    slot.aspectRatio,
    slot.preserveAspectRatio
  );
  const aspectRatioValue = getDetachedVoiceSlotAspectRatioValue(aspectRatio);
  let width = clampNumber(
    Number.isFinite(slot.width) ? slot.width : detachedVoiceLayoutMinSlotSize,
    detachedVoiceLayoutMinSlotSize,
    gridColumns
  );
  let height = clampNumber(
    Number.isFinite(slot.height) ? slot.height : detachedVoiceLayoutMinSlotSize,
    detachedVoiceLayoutMinSlotSize,
    gridRows
  );

  if (aspectRatioValue) {
    const widthDrivenHeight = Math.max(
      detachedVoiceLayoutMinSlotSize,
      width / aspectRatioValue
    );
    const heightDrivenWidth = Math.max(
      detachedVoiceLayoutMinSlotSize,
      height * aspectRatioValue
    );

    if (heightDrivenWidth <= gridColumns && heightDrivenWidth <= width) {
      width = heightDrivenWidth;
    } else if (widthDrivenHeight <= gridRows) {
      height = widthDrivenHeight;
    } else {
      width = Math.min(width, gridColumns);
      height = Math.min(gridRows, width / aspectRatioValue);
    }
  }

  return {
    ...slot,
    preserveAspectRatio: aspectRatio !== 'free',
    aspectRatio,
    x: clampNumber(
      Number.isFinite(slot.x) ? slot.x : 0,
      0,
      gridColumns - width
    ),
    y: clampNumber(Number.isFinite(slot.y) ? slot.y : 0, 0, gridRows - height),
    width,
    height,
    borderRadius: clampNumber(
      Number.isFinite(slot.borderRadius)
        ? slot.borderRadius
        : detachedVoiceSlotDefaultBorderRadius,
      0,
      detachedVoiceSlotMaxBorderRadius
    ),
    zIndex: clampNumber(
      Number.isFinite(slot.zIndex) ? Math.round(slot.zIndex) : slot.index,
      0,
      999
    )
  };
}

export function normalizeDetachedVoiceSlotChange(
  slot: DetachedVoiceLayoutSlot,
  field: 'x' | 'y' | 'width' | 'height',
  value: number,
  gridColumns: number,
  gridRows: number
) {
  const nextSlot = {
    ...slot,
    [field]: value
  };
  const aspectRatioValue = getDetachedVoiceSlotAspectRatioValue(
    normalizeDetachedVoiceSlotAspectRatio(
      slot.aspectRatio,
      slot.preserveAspectRatio
    )
  );

  if (aspectRatioValue && field === 'width') {
    nextSlot.height = value / aspectRatioValue;
  }

  if (aspectRatioValue && field === 'height') {
    nextSlot.width = value * aspectRatioValue;
  }

  return normalizeDetachedVoiceSlot(nextSlot, gridColumns, gridRows);
}

export function normalizeDetachedVoicePreset(
  preset: DetachedVoiceLayoutPreset
): DetachedVoiceLayoutPreset {
  const cellSizePx = clampNumber(
    Math.round(preset.cellSizePx || detachedVoiceLayoutDefaultCellSizePx),
    detachedVoiceLayoutMinCellSizePx,
    detachedVoiceLayoutMaxCellSizePx
  );
  const gridColumns = clampNumber(
    Math.round(preset.gridColumns || detachedVoiceLayoutDefaultColumns),
    2,
    detachedVoiceLayoutMaxColumns
  );
  const gridRows = clampNumber(
    Math.round(preset.gridRows || detachedVoiceLayoutDefaultRows),
    2,
    detachedVoiceLayoutMaxRows
  );

  return {
    ...preset,
    cellSizePx,
    gridColumns,
    gridRows,
    isPinned: Boolean(preset.isPinned),
    isPersisted: Boolean(preset.isPersisted),
    hideServiceInfo: Boolean(preset.hideServiceInfo),
    slots: preset.slots.map((slot) =>
      normalizeDetachedVoiceSlot(slot, gridColumns, gridRows)
    )
  };
}

function createDetachedVoiceSlotAtIndex(
  index: number,
  slotCount: number,
  gridColumns: number,
  gridRows: number
): DetachedVoiceLayoutSlot {
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(slotCount))));
  const rows = Math.max(1, Math.ceil(slotCount / columns));
  const slotWidth = Math.max(
    detachedVoiceLayoutMinSlotSize,
    Math.floor((gridColumns / columns) * detachedVoiceSlotDefaultScale)
  );
  const slotHeight = Math.max(
    detachedVoiceLayoutMinSlotSize,
    Math.floor((gridRows / rows) * detachedVoiceSlotDefaultScale)
  );
  const column = (index - 1) % columns;
  const row = Math.floor((index - 1) / columns);

  return normalizeDetachedVoiceSlot(
    {
      index,
      preserveAspectRatio: true,
      aspectRatio: detachedVoiceSlotDefaultAspectRatio,
      x: column * slotWidth,
      y: row * slotHeight,
      width: slotWidth,
      height:
        slotWidth /
        detachedVoiceSlotAspectRatios[detachedVoiceSlotDefaultAspectRatio],
      borderRadius: detachedVoiceSlotDefaultBorderRadius,
      zIndex: index,
      mode: 'grid'
    },
    gridColumns,
    gridRows
  );
}

export function resizeDetachedVoicePresetSlots(
  preset: DetachedVoiceLayoutPreset,
  slotCount: number
): DetachedVoiceLayoutPreset {
  const normalizedPreset = normalizeDetachedVoicePreset(preset);
  const nextSlotCount = clampNumber(Math.round(slotCount), 1, 64);
  const slots = Array.from({ length: nextSlotCount }, (_, index) => {
    const slotIndex = index + 1;
    const existingSlot = normalizedPreset.slots.find(
      (slot) => slot.index === slotIndex
    );

    return existingSlot
      ? normalizeDetachedVoiceSlot(
          existingSlot,
          normalizedPreset.gridColumns,
          normalizedPreset.gridRows
        )
      : createDetachedVoiceSlotAtIndex(
          slotIndex,
          nextSlotCount,
          normalizedPreset.gridColumns,
          normalizedPreset.gridRows
        );
  });

  return {
    ...normalizedPreset,
    slots
  };
}

function createDetachedVoicePresetId() {
  if ('crypto' in globalThis && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `preset-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export function createDefaultDetachedVoicePreset(
  name: string,
  _cardCount: number,
  showParticipantsWithoutVideo: boolean
): DetachedVoiceLayoutPreset {
  const slotCount = 4;
  const gridColumns = detachedVoiceLayoutDefaultColumns;
  const gridRows = detachedVoiceLayoutDefaultRows;

  return {
    id: createDetachedVoicePresetId(),
    name,
    cellSizePx: detachedVoiceLayoutDefaultCellSizePx,
    gridColumns,
    gridRows,
    isPinned: false,
    isPersisted: false,
    showParticipantsWithoutVideo,
    hideServiceInfo: false,
    slots: Array.from({ length: slotCount }, (_, slotIndex) =>
      createDetachedVoiceSlotAtIndex(
        slotIndex + 1,
        slotCount,
        gridColumns,
        gridRows
      )
    )
  };
}
