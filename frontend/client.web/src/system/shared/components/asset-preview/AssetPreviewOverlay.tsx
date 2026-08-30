import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { SystemCloseIcon } from '../../icons/components/SystemCloseIcon';
import { assetPreviewCopy } from './assetPreview.copy.ts';

import styles from './AssetPreviewOverlay.module.css';

export type AssetPreviewAuthor = {
  displayName: string;
  avatarUrl: string | null;
  avatarCropOffsetX?: number;
  avatarCropOffsetY?: number;
  avatarCropZoom?: number;
};

export type AssetPreviewItem = {
  url: string;
  title: string;
  createdAt: string;
  sizeBytes?: number;
  mediaType?: 'image' | 'video';
};

type AssetPreviewOverlayProps = {
  asset: AssetPreviewItem;
  author: AssetPreviewAuthor;
  onClose: () => void;
  onNavigate?: (direction: 'previous' | 'next') => void;
};

export function AssetPreviewOverlay({
  asset,
  author,
  onClose,
  onNavigate
}: AssetPreviewOverlayProps) {
  const [isChromeVisible, setIsChromeVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const isClosingRef = useRef(false);

  const requestClose = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    setIsChromeVisible(false);
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      onClose();
    }, 240);
  }, [onClose]);

  useEffect(() => {
    function handleKeyboardNavigation(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        requestClose();
        return;
      }

      if (
        !onNavigate ||
        isClosingRef.current ||
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isNativeArrowKeyTarget(event.target)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        onNavigate(event.key === 'ArrowLeft' ? 'previous' : 'next');
      }
    }

    window.addEventListener('keydown', handleKeyboardNavigation);

    return () =>
      window.removeEventListener('keydown', handleKeyboardNavigation);
  }, [onNavigate, requestClose]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function toggleMobileChrome() {
    if (isClosingRef.current) {
      return;
    }

    if (!window.matchMedia('(max-width: 760px)').matches) {
      return;
    }

    setIsChromeVisible((current) => !current);
  }

  return createPortal(
    <div
      className={`${styles.backdrop} ${isClosing ? styles.closing : ''}`}
      role="presentation"
      onMouseDown={requestClose}
    >
      <section
        className={`${styles.viewer} ${
          isChromeVisible ? '' : styles.chromeHidden
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={asset.title}
        aria-keyshortcuts={
          onNavigate ? 'ArrowLeft ArrowRight Escape' : 'Escape'
        }
        onMouseDown={(event) => {
          event.stopPropagation();
          if (event.target === event.currentTarget) {
            requestClose();
          }
        }}
        onClick={toggleMobileChrome}
      >
        <header
          className={styles.meta}
          onClick={(event) => event.stopPropagation()}
        >
          <span className={styles.avatar}>
            {author.avatarUrl ? (
              <img
                className="ui-media-fit"
                src={author.avatarUrl}
                alt=""
                style={{
                  transform: `translate(${
                    (author.avatarCropOffsetX ?? 0) * 100
                  }%, ${(author.avatarCropOffsetY ?? 0) * 100}%) scale(${
                    author.avatarCropZoom ?? 1
                  })`
                }}
              />
            ) : (
              author.displayName.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className={styles.metaText}>
            <strong>{author.displayName}</strong>
            <time dateTime={asset.createdAt}>
              {formatAssetPreviewDate(asset.createdAt)}
            </time>
            <span>{asset.title}</span>
          </div>
        </header>
        <button
          className={styles.close}
          type="button"
          aria-label={assetPreviewCopy.aria.close}
          onClick={(event) => {
            event.stopPropagation();
            requestClose();
          }}
        >
          <SystemCloseIcon size="medium" />
        </button>
        <div className={styles.imageFrame}>
          {asset.mediaType === 'video' ? (
            <video
              className={styles.image}
              src={asset.url}
              aria-label={asset.title}
              controls
              playsInline
              preload="metadata"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <img
              className={styles.image}
              src={asset.url}
              alt={asset.title || assetPreviewCopy.imageAlt}
            />
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

function isNativeArrowKeyTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest('video, input, textarea, select, [contenteditable="true"]')
  );
}

function formatAssetPreviewDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
