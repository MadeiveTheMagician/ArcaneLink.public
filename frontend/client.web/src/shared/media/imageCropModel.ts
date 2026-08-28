export const imageCropMinZoom = 0.5;
export const imageCropMaxZoom = 3;

const wheelZoomSensitivity = 0.0015;
const wheelLinePixelSize = 16;
const wheelPagePixelSize = 120;

export function clampImageCropZoom(zoom: number) {
  return Math.min(Math.max(zoom, imageCropMinZoom), imageCropMaxZoom);
}

export function getImageCropWheelZoom(
  currentZoom: number,
  deltaY: number,
  deltaMode = 0
) {
  const deltaMultiplier =
    deltaMode === 1
      ? wheelLinePixelSize
      : deltaMode === 2
        ? wheelPagePixelSize
        : 1;
  const normalizedDelta = deltaY * deltaMultiplier;

  return clampImageCropZoom(
    currentZoom * Math.exp(-normalizedDelta * wheelZoomSensitivity)
  );
}
