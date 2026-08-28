import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

import { commonCopy } from '../../system/shared/copy/common.ru';
import {
  clampImageCropZoom,
  getImageCropWheelZoom,
  imageCropMaxZoom,
  imageCropMinZoom
} from './imageCropModel';

import buttonStyles from '../../system/shared/styles/Button.module.css';
import styles from './ImageCropEditor.module.css';

export type ImageCrop = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

type ImageCropEditorProps = {
  imageUrl: string;
  title: string;
  description: string;
  shape: 'square' | 'rounded' | 'circle';
  aspectRatio?: string;
  frameLabel: string;
  initialCrop?: ImageCrop;
  isSaving: boolean;
  isInteractionDisabled?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (crop: ImageCrop) => void;
  onImageError?: () => void;
};

type Point = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ImageCropEditor({
  imageUrl,
  title,
  description,
  shape,
  aspectRatio = '1 / 1',
  frameLabel,
  initialCrop,
  isSaving,
  isInteractionDisabled = false,
  error,
  onCancel,
  onConfirm,
  onImageError
}: ImageCropEditorProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<Point | null>(null);
  const [frameSize, setFrameSize] = useState<Size>({
    width: 520,
    height: 520
  });
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [crop, setCrop] = useState<ImageCrop>(
    initialCrop ?? {
      offsetX: 0,
      offsetY: 0,
      zoom: 1
    }
  );
  const isDisabled = isSaving || isInteractionDisabled;

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const updateFrameSize = () => {
      const rect = frame.getBoundingClientRect();

      setFrameSize({
        width: rect.width,
        height: rect.height
      });
    };
    const observer = new ResizeObserver(updateFrameSize);

    updateFrameSize();
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const zoomByWheel = (event: WheelEvent) => {
      if (isDisabled) {
        return;
      }

      event.preventDefault();
      setCrop((current) => ({
        ...current,
        zoom: getImageCropWheelZoom(current.zoom, event.deltaY, event.deltaMode)
      }));
    };

    frame.addEventListener('wheel', zoomByWheel, { passive: false });
    return () => frame.removeEventListener('wheel', zoomByWheel);
  }, [isDisabled]);

  function updateCrop(nextCrop: ImageCrop) {
    setCrop({
      offsetX: clamp(nextCrop.offsetX, -1, 1),
      offsetY: clamp(nextCrop.offsetY, -1, 1),
      zoom: clampImageCropZoom(nextCrop.zoom)
    });
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (isDisabled) {
      return;
    }

    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragImage(event: PointerEvent<HTMLDivElement>) {
    if (isDisabled || !dragStartRef.current) {
      return;
    }

    const delta = {
      x: event.clientX - dragStartRef.current.x,
      y: event.clientY - dragStartRef.current.y
    };

    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY
    };

    updateCrop({
      ...crop,
      offsetX: crop.offsetX + delta.x / frameSize.width,
      offsetY: crop.offsetY + delta.y / frameSize.height
    });
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    dragStartRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const fittedImageSize = imageSize
    ? getContainedSize(imageSize, frameSize)
    : frameSize;

  return (
    <div className={styles.editor}>
      <div
        ref={frameRef}
        className={styles.frame}
        data-shape={shape}
        style={{
          aspectRatio
        }}
        aria-disabled={isDisabled}
        onPointerDown={startDrag}
        onPointerMove={dragImage}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <img
          className={styles.previewImage}
          src={imageUrl}
          alt=""
          draggable={false}
          style={{
            width: `${fittedImageSize.width}px`,
            height: `${fittedImageSize.height}px`,
            transform: `translate(-50%, -50%) translate(${
              crop.offsetX * frameSize.width
            }px, ${crop.offsetY * frameSize.height}px) scale(${crop.zoom})`
          }}
          onLoad={(event) =>
            setImageSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight
            })
          }
          onError={onImageError}
        />
        <div
          className={styles.mask}
          aria-hidden="true"
          data-label={frameLabel}
        />
      </div>

      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <label className={styles.control}>
        <span>{commonCopy.imageEditor.scale}</span>
        <input
          name="imageCropZoom"
          type="range"
          min={imageCropMinZoom}
          max={imageCropMaxZoom}
          step="0.01"
          value={crop.zoom}
          disabled={isDisabled}
          onChange={(event) =>
            updateCrop({
              ...crop,
              zoom: Number(event.target.value)
            })
          }
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button
          className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.actionButton}`}
          type="button"
          onClick={onCancel}
          disabled={isDisabled}
        >
          {commonCopy.actions.cancel}
        </button>
        <button
          className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.actionButton}`}
          type="button"
          onClick={() => onConfirm(crop)}
          disabled={isDisabled}
        >
          {isSaving ? commonCopy.imageEditor.saving : commonCopy.actions.apply}
        </button>
      </div>
    </div>
  );
}

function getContainedSize(imageSize: Size, frameSize: Size): Size {
  if (imageSize.width <= 0 || imageSize.height <= 0) {
    return frameSize;
  }

  const imageRatio = imageSize.width / imageSize.height;
  const frameRatio = frameSize.width / frameSize.height;

  if (imageRatio > frameRatio) {
    return {
      width: frameSize.width,
      height: frameSize.width / imageRatio
    };
  }

  return {
    width: frameSize.height * imageRatio,
    height: frameSize.height
  };
}
