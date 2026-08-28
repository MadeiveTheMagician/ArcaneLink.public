import { useLayoutEffect, useRef, useState } from 'react';

import type { SpaceMessageAssetResponse } from '../../../../shared/types';
import { SystemIcon, serverCopy } from '../../../shared';
import { resolveAttachmentLayoutTransition } from './messageAttachmentLayoutModel';
import {
  formatFileSize,
  isArchiveAsset,
  isImageAsset,
  isVideoAsset
} from './messageUtils';

import styles from './MessageAttachmentGallery.module.css';

type AttachmentDensity = 'featured' | 'preview' | 'full';

type MessageAttachmentGalleryProps = {
  assets: SpaceMessageAssetResponse[];
  defaultExpanded: boolean;
  fillAvailableWidth?: boolean;
  onOpenPreview: (asset: SpaceMessageAssetResponse) => void;
  onRequestDownload: (asset: SpaceMessageAssetResponse) => void;
};

export function MessageAttachmentGallery({
  assets,
  defaultExpanded,
  fillAvailableWidth = false,
  onOpenPreview,
  onRequestDownload
}: MessageAttachmentGalleryProps) {
  const [layoutOverride, setLayoutOverride] = useState<boolean | null>(null);
  const isExpanded = layoutOverride ?? defaultExpanded;
  const layoutViewportRef = useRef<HTMLDivElement | null>(null);
  const layoutContentRef = useRef<HTMLDivElement | null>(null);
  const previousLayoutHeightRef = useRef<number | null>(null);
  const pendingLayoutHeightRef = useRef<number | null>(null);
  const hasSeveralAssets = assets.length > 1;
  const onlyAsset = assets[0];
  const isSingleFile =
    assets.length === 1 &&
    onlyAsset &&
    !isImageAsset(onlyAsset) &&
    !isVideoAsset(onlyAsset);
  const canFillAvailableWidth =
    fillAvailableWidth && assets.every((asset) => !isVideoAsset(asset));
  const previewAssets = assets.slice(1, 10);
  const hiddenAssetCount = Math.max(0, assets.length - 10);

  useLayoutEffect(() => {
    const viewport = layoutViewportRef.current;
    const content = layoutContentRef.current;
    if (!viewport || !content) return undefined;
    const activeViewport = viewport;
    const activeContent = content;

    const toHeight = activeContent.getBoundingClientRect().height;
    const transition = resolveAttachmentLayoutTransition({
      fromHeight:
        pendingLayoutHeightRef.current ?? previousLayoutHeightRef.current,
      toHeight,
      prefersReducedMotion: window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    });

    pendingLayoutHeightRef.current = null;
    previousLayoutHeightRef.current = transition.toHeight;
    if (!transition.shouldAnimate) return undefined;

    activeViewport.style.height = `${transition.fromHeight}px`;
    activeViewport.style.overflow = 'clip';
    activeViewport.style.willChange = 'height';
    activeContent.style.willChange = 'opacity, transform';

    const heightAnimation = activeViewport.animate(
      [
        { height: `${transition.fromHeight}px` },
        { height: `${transition.toHeight}px` }
      ],
      {
        duration: 220,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
      }
    );
    const contentAnimation = activeContent.animate(
      [
        {
          opacity: 0.58,
          transform: `translateY(${isExpanded ? '-6px' : '6px'})`
        },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 180,
        easing: 'ease-out'
      }
    );

    function clearAnimationStyles() {
      activeViewport.style.removeProperty('height');
      activeViewport.style.removeProperty('overflow');
      activeViewport.style.removeProperty('will-change');
      activeContent.style.removeProperty('will-change');
    }

    heightAnimation.addEventListener('finish', clearAnimationStyles, {
      once: true
    });

    return () => {
      heightAnimation.cancel();
      contentAnimation.cancel();
      clearAnimationStyles();
    };
  }, [isExpanded]);

  function toggleAttachmentLayout() {
    pendingLayoutHeightRef.current =
      layoutViewportRef.current?.getBoundingClientRect().height ?? null;
    setLayoutOverride(!isExpanded);
  }

  if (isSingleFile) {
    return (
      <section
        className={`${styles.gallery} ${
          canFillAvailableWidth ? styles.galleryFullWidth : ''
        }`}
      >
        <SingleFileAttachment
          asset={onlyAsset}
          onRequestDownload={onRequestDownload}
        />
      </section>
    );
  }

  return (
    <section
      className={`${styles.gallery} ${
        canFillAvailableWidth ? styles.galleryFullWidth : ''
      }`}
      data-expanded={isExpanded ? 'true' : 'false'}
    >
      {hasSeveralAssets && (
        <button
          className={styles.layoutToggle}
          type="button"
          aria-pressed={isExpanded}
          onClick={toggleAttachmentLayout}
        >
          <SystemIcon
            name={isExpanded ? 'chevron-down' : 'chevron-right'}
            size={15}
          />
          {isExpanded
            ? serverCopy.messages.collapseAttachments
            : serverCopy.messages.expandAttachments}
        </button>
      )}

      <div className={styles.layoutViewport} ref={layoutViewportRef}>
        <div className={styles.layoutContent} ref={layoutContentRef}>
          {isExpanded || !hasSeveralAssets ? (
            <div className={styles.fullGrid}>
              {assets.map((asset) => (
                <AttachmentTile
                  key={asset.assetId}
                  asset={asset}
                  density="full"
                  onOpenPreview={onOpenPreview}
                  onRequestDownload={onRequestDownload}
                />
              ))}
            </div>
          ) : (
            <div className={styles.compactGrid}>
              <AttachmentTile
                asset={assets[0]}
                density="featured"
                onOpenPreview={onOpenPreview}
                onRequestDownload={onRequestDownload}
              />
              <div
                className={`${styles.previewGrid} ${styles[`previewCount${previewAssets.length}`]}`}
              >
                {previewAssets.map((asset, index) => (
                  <div className={styles.previewSlot} key={asset.assetId}>
                    <AttachmentTile
                      asset={asset}
                      density="preview"
                      onOpenPreview={onOpenPreview}
                      onRequestDownload={onRequestDownload}
                    />
                    {hiddenAssetCount > 0 &&
                      index === previewAssets.length - 1 && (
                        <button
                          className={styles.overflowCount}
                          type="button"
                          onClick={() => {
                            pendingLayoutHeightRef.current =
                              layoutViewportRef.current?.getBoundingClientRect()
                                .height ?? null;
                            setLayoutOverride(true);
                          }}
                          aria-label={serverCopy.messages.expandAttachments}
                        >
                          +{hiddenAssetCount}
                        </button>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AttachmentTile({
  asset,
  density,
  onOpenPreview,
  onRequestDownload
}: {
  asset: SpaceMessageAssetResponse;
  density: AttachmentDensity;
  onOpenPreview: (asset: SpaceMessageAssetResponse) => void;
  onRequestDownload: (asset: SpaceMessageAssetResponse) => void;
}) {
  const [isRevealed, setIsRevealed] = useState(!asset.isSpoiler);
  const assetUrl = `/api/assets/${asset.assetId}/content`;
  const isImage = isImageAsset(asset);
  const isVideo = isVideoAsset(asset);
  const isPreview = density === 'preview';
  const tileClassName = `${styles.tile} ${styles[density]} ${
    asset.isSpoiler ? styles.spoiler : ''
  } ${asset.isSpoiler && !isRevealed ? styles.concealed : ''}`;

  function revealOr(action: () => void) {
    if (asset.isSpoiler && !isRevealed) {
      setIsRevealed(true);
      return;
    }

    action();
  }

  if (isImage || isVideo) {
    return (
      <button
        className={tileClassName}
        type="button"
        onClick={() => revealOr(() => onOpenPreview(asset))}
      >
        {isVideo ? (
          <video src={assetUrl} muted preload="metadata" playsInline />
        ) : (
          <img
            src={assetUrl}
            alt={asset.fileName || serverCopy.messages.attachedImage}
            loading="lazy"
          />
        )}
        {isVideo && (
          <span className={styles.videoPlay} aria-hidden="true">
            <SystemIcon name="video" size={isPreview ? 18 : 22} />
          </span>
        )}
        <SpoilerLabel visible={asset.isSpoiler && !isRevealed} />
      </button>
    );
  }

  return (
    <button
      className={`${tileClassName} ${styles.fileTile}`}
      type="button"
      onClick={() => onRequestDownload(asset)}
    >
      <SystemIcon
        name={isArchiveAsset(asset) ? 'archive' : 'file'}
        size={isPreview ? 23 : 34}
        glow
      />
      <span className={styles.fileText}>
        <strong>{asset.fileName || serverCopy.messages.attachment}</strong>
        {!isPreview && (
          <small>
            {asset.mimeType || 'application/octet-stream'} -{' '}
            {formatFileSize(asset.sizeBytes)}
          </small>
        )}
      </span>
    </button>
  );
}

function SingleFileAttachment({
  asset,
  onRequestDownload
}: {
  asset: SpaceMessageAssetResponse;
  onRequestDownload: (asset: SpaceMessageAssetResponse) => void;
}) {
  return (
    <button
      className={styles.singleFile}
      type="button"
      onClick={() => onRequestDownload(asset)}
    >
      <span className={styles.singleFileIcon}>
        <SystemIcon
          name={isArchiveAsset(asset) ? 'archive' : 'file'}
          size={27}
          glow
        />
      </span>
      <span className={styles.fileText}>
        <strong>{asset.fileName || serverCopy.messages.attachment}</strong>
        <small>
          {asset.mimeType || 'application/octet-stream'} -{' '}
          {formatFileSize(asset.sizeBytes)}
        </small>
      </span>
      <SystemIcon name="download" size={17} />
    </button>
  );
}

function SpoilerLabel({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <span className={styles.spoilerLabel}>
      <SystemIcon name="eye" size={18} /> {serverCopy.messages.showSpoiler}
    </span>
  );
}
