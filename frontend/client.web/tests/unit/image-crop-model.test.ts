import { expect, test } from '@playwright/test';

import {
  getImageCropWheelZoom,
  imageCropMaxZoom,
  imageCropMinZoom
} from '../../src/shared/media/imageCropModel';

test.describe('image crop zoom model', () => {
  test('zooms smoothly in and out from wheel deltas', () => {
    const zoomedIn = getImageCropWheelZoom(1, -60);
    const zoomedOut = getImageCropWheelZoom(1, 60);

    expect(zoomedIn).toBeGreaterThan(1);
    expect(zoomedIn).toBeLessThan(1.2);
    expect(zoomedOut).toBeLessThan(1);
    expect(zoomedOut).toBeGreaterThan(0.8);
  });

  test('clamps wheel zoom to the same limits as the range control', () => {
    expect(getImageCropWheelZoom(1, -100_000)).toBe(imageCropMaxZoom);
    expect(getImageCropWheelZoom(1, 100_000)).toBe(imageCropMinZoom);
  });

  test('normalizes line-based wheel deltas', () => {
    expect(getImageCropWheelZoom(1, -3, 1)).toBeGreaterThan(1);
    expect(getImageCropWheelZoom(1, 3, 1)).toBeLessThan(1);
  });
});
