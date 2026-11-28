import type { CSSProperties } from 'react'

export function getServerIconImageStyle(
  offsetX?: number | null,
  offsetY?: number | null,
  zoom?: number | null,
): CSSProperties {
  // Match the crop editor: fit inside the frame before applying its offsets.
  return {
    display: 'block',
    position: 'static',
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    borderRadius: 0,
    transformOrigin: 'center',
    transform: `translate(${(offsetX ?? 0) * 100}%, ${(offsetY ?? 0) * 100}%) scale(${zoom ?? 1})`,
  }
}
