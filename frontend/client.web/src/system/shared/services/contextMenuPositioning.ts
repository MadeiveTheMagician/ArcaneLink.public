export type ContextMenuGridSector = {
  row: number;
  column: number;
};

export type ContextMenuPlacement = ContextMenuGridSector & {
  left: number;
  top: number;
  maxHeight: number;
  openSubmenuLeft: boolean;
};

type ResolveContextMenuPlacementOptions = {
  x: number;
  y: number;
  menuWidth: number;
  menuHeight: number;
  submenuWidth: number;
  viewportWidth: number;
  viewportHeight: number;
  gutter?: number;
};

const verticalSectors = 6;
const horizontalSectors = 4;
const defaultGutter = 8;

type ResolveContextMenuHeightOptions = {
  renderedHeight?: number;
  contentHeight?: number;
  estimatedHeight: number;
  viewportHeight: number;
  gutter?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function resolveContextMenuHeight({
  renderedHeight,
  contentHeight,
  estimatedHeight,
  viewportHeight,
  gutter = defaultGutter
}: ResolveContextMenuHeightOptions) {
  const hasMeasurement = renderedHeight != null || contentHeight != null;
  const measuredHeight = hasMeasurement
    ? Math.max(renderedHeight ?? 0, contentHeight ?? 0)
    : estimatedHeight;
  const availableHeight = Math.max(0, viewportHeight - gutter * 2);

  return Math.min(measuredHeight, availableHeight);
}

export function getContextMenuGridSector(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number
): ContextMenuGridSector {
  const row = clamp(
    Math.floor((y / Math.max(1, viewportHeight)) * verticalSectors) + 1,
    1,
    verticalSectors
  );

  const columnFromLeft = clamp(
    Math.floor((x / Math.max(1, viewportWidth)) * horizontalSectors) + 1,
    1,
    horizontalSectors
  );

  return {
    row,
    column: horizontalSectors - columnFromLeft + 1
  };
}

export function resolveContextMenuPlacement({
  x,
  y,
  menuWidth,
  menuHeight,
  submenuWidth,
  viewportWidth,
  viewportHeight,
  gutter = defaultGutter
}: ResolveContextMenuPlacementOptions): ContextMenuPlacement {
  const sector = getContextMenuGridSector(x, y, viewportWidth, viewportHeight);
  const shouldOpenLeft = sector.column <= 2;
  const shouldOpenUp = sector.row >= 5;
  const shouldCenterVertically = sector.row >= 3 && sector.row <= 4;

  const preferredLeft = shouldOpenLeft ? x - menuWidth : x;
  const preferredTop = shouldOpenUp
    ? y - menuHeight
    : shouldCenterVertically
      ? y - menuHeight / 2
      : y;

  const left = clamp(preferredLeft, gutter, viewportWidth - menuWidth - gutter);
  const top = clamp(preferredTop, gutter, viewportHeight - menuHeight - gutter);
  const submenuWouldOverflowRight =
    left + menuWidth + submenuWidth + gutter * 2 > viewportWidth;

  return {
    ...sector,
    left,
    top,
    maxHeight: Math.max(0, viewportHeight - top - gutter),
    openSubmenuLeft: shouldOpenLeft || submenuWouldOverflowRight
  };
}
