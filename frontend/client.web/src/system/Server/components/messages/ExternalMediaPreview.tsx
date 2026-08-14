import { useMemo, type CSSProperties } from 'react'
import { findExternalMedia } from './externalMedia'
import {
  getExternalMediaPreviewListWidth,
  resolveExternalMediaPreviewLayout,
} from './externalMediaSizeModel'
import styles from './ExternalMediaPreview.module.css'

export function ExternalMediaPreviews({
  body,
  enabled,
  horizontalSize,
  verticalSize,
  isBubblePresentation = false,
}: {
  body: string | null
  enabled: boolean
  horizontalSize: number
  verticalSize: number
  isBubblePresentation?: boolean
}) {
  const previews = useMemo(
    () =>
      enabled
        ? findExternalMedia(body, window.location.hostname || 'localhost')
        : [],
    [body, enabled],
  )

  if (previews.length === 0) {
    return null
  }

  const configuredListWidth =
    getExternalMediaPreviewListWidth(
      previews,
      horizontalSize,
      verticalSize,
      isBubblePresentation,
    ) ?? 0

  return (
    <div
      className={`${styles.list} ${
        isBubblePresentation ? styles.bubbleList : ''
      }`}
      style={
        {
          '--external-media-list-width': `${configuredListWidth}px`,
        } as CSSProperties
      }
    >
      {previews.map((preview) => {
        const layout = resolveExternalMediaPreviewLayout(
          preview,
          horizontalSize,
          verticalSize,
          isBubblePresentation,
        )

        return (
          <figure
            className={`${styles.preview} ${
              layout.isPortrait ? styles.portrait : styles.landscape
            } ${layout.shouldCenter ? styles.centeredPortrait : ''} ${
              layout.shouldUseBackdrop ? styles.portraitBackdrop : ''
            }`}
            key={preview.id}
            style={
              {
                '--external-media-card-width': `${layout.cardWidth}px`,
                '--external-media-player-width': `${layout.playerWidth}px`,
                '--external-media-backdrop-image': preview.thumbnailUrl
                  ? `url("${preview.thumbnailUrl}")`
                  : 'none',
              } as CSSProperties
            }
          >
            <div className={styles.playerStage}>
              {layout.shouldUseBackdrop ? (
                <span className={styles.playerBackdrop} aria-hidden="true" />
              ) : null}
              <iframe
                className={styles.player}
                src={preview.embedUrl}
                title=""
                aria-label={`${preview.title}: встроенное видео`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <figcaption>
              <span>{preview.title}</span>
              <a href={preview.sourceUrl} target="_blank" rel="noreferrer">
                Открыть источник
              </a>
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}
