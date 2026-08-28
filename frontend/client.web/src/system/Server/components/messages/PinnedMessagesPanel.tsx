import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import type {
  SpaceMessageAssetResponse,
  SpaceMessageResponse,
} from '../../../../shared/types'
import { commonCopy, serverCopy, SystemIcon } from '../../../shared'
import styles from './PinnedMessagesPanel.module.css'
import {
  formatFileSize,
  formatPinnedMessageDateTime,
  isImageAsset,
} from './messageUtils'
export function PinnedMessagesPanel({
  isOpen,
  isLoading,
  messages,
  onJumpToMessage,
  onRequestDownload,
  onClose,
}: {
  isOpen: boolean
  isLoading: boolean
  messages: SpaceMessageResponse[]
  onJumpToMessage: (messageId: string, createdAt?: string | null) => void
  onRequestDownload: (asset: SpaceMessageAssetResponse) => void
  onClose: () => void
}) {
  const [expandedAssetIds, setExpandedAssetIds] = useState<Set<string>>(
    () => new Set(),
  )

  function toggleAsset(
    event: ReactMouseEvent<HTMLElement>,
    assetId: string,
  ) {
    event.stopPropagation()
    setExpandedAssetIds((current) => {
      const next = new Set(current)

      if (next.has(assetId)) {
        next.delete(assetId)
      } else {
        next.add(assetId)
      }

      return next
    })
  }

  return (
    <aside
      className={`${styles.pinnedPanel} ${isOpen ? styles.open : ''}`}
      aria-label={serverCopy.messages.pinnedMessages}
    >
      <header>
        <div>
          <strong>{serverCopy.messages.pinned}</strong>
          <span>{messages.length}</span>
        </div>
        <button type="button" onClick={onClose} aria-label={serverCopy.messages.closePinned}>
          <SystemIcon name="close" />
        </button>
      </header>

      {isLoading ? (
        <p className={styles.pinnedEmpty}>{serverCopy.messages.loadingPinned}</p>
      ) : messages.length === 0 ? (
        <p className={styles.pinnedEmpty}>{serverCopy.messages.emptyPinned}</p>
      ) : (
        <div className={styles.pinnedList}>
          {messages.map((message) => {
            const avatarUrl = message.senderAvatarAssetId
              ? `/api/assets/${message.senderAvatarAssetId}/content`
              : null

            return (
              <article
                key={message.id}
                className={styles.pinnedCard}
                role="button"
                tabIndex={0}
                onClick={() => onJumpToMessage(message.id, message.createdAt)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onJumpToMessage(message.id, message.createdAt)
                  }
                }}
              >
                <header>
                  <span className={styles.pinnedAvatar}>
                    {avatarUrl ? (
                      <img
                        className="ui-media-fit"
                        src={avatarUrl}
                        alt=""
                        style={{
                          transform: `translate(${
                            message.senderAvatarCropOffsetX * 100
                          }%, ${message.senderAvatarCropOffsetY * 100}%) scale(${
                            message.senderAvatarCropZoom
                          })`,
                        }}
                      />
                    ) : (
                      message.senderDisplayName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div>
                    <strong>{message.senderDisplayName}</strong>
                    <time dateTime={message.createdAt}>
                      {formatPinnedMessageDateTime(message.createdAt)}
                    </time>
                  </div>
                </header>
                <p>{message.body ?? serverCopy.messages.emptyBody}</p>
                {message.assets.length > 0 && (
                  <div className={styles.pinnedAssets}>
                    {message.assets.map((asset) => {
                      const assetUrl = `/api/assets/${asset.assetId}/content`
                      const isExpanded = expandedAssetIds.has(asset.assetId)

                      return (
                        <section
                          key={asset.assetId}
                          className={styles.pinnedAsset}
                          data-expanded={isExpanded ? 'true' : 'false'}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(event) => toggleAsset(event, asset.assetId)}
                          >
                            <span>{asset.fileName || serverCopy.messages.attachment}</span>
                            <small>
                              {isExpanded
                                ? commonCopy.actions.collapse
                                : serverCopy.messages.expand}{' '}
                              ·{' '}
                              {formatFileSize(asset.sizeBytes)}
                            </small>
                          </button>
                          <div className={styles.pinnedAssetPreview}>
                            {isImageAsset(asset) ? (
                              <img
                                src={assetUrl}
                                alt={asset.fileName || serverCopy.messages.attachedImage}
                                loading="lazy"
                              />
                            ) : (
                              <button
                                type="button"
                                className={styles.pinnedAssetDownload}
                                onClick={() => onRequestDownload(asset)}
                              >
                                {serverCopy.messages.downloadAttachment}
                              </button>
                            )}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </aside>
  )
}
