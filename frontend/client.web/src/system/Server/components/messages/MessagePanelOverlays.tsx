import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type {
  SpaceMessageAssetResponse,
  SpaceMessageResponse,
} from '../../../../shared/types'
import { createPortal } from 'react-dom'
import { MessageReportDialog } from '../../../Moderation/components/MessageReportDialog'
import type { ServerMessageReportContext } from '../../../Moderation/models/messageReportModel'
import { commonCopy, serverCopy } from '../../../shared'
import { AssetPreviewOverlay } from '../../../shared/components/asset-preview/AssetPreviewOverlay'
import { ContextMenu, type ContextMenuItem } from '../../../shared/components/context-menu/ContextMenu'
import { useAnimatedOverlayClose } from '../../../shared/hooks/useAnimatedOverlayClose'
import { useDismissableLayer } from '../../../shared/hooks/useDismissableLayer'
import { requestSystemSettingsNavigation } from '../../../shared/navigation/systemSettingsNavigation'
import { downloadWarningCloseDurationMs } from '../../../shared/overlays/animatedOverlayPhaseModel'
import styles from './MessagePanelOverlays.module.css'
import {
  getAttachmentDownloadWarningCountdownSeconds,
  getAttachmentDownloadWarningProgress,
  getAttachmentDownloadWarningRemainingMs,
} from './downloadWarningDelayModel'
import {
  formatFileSize,
  isVideoAsset,
  type DownloadWarningState,
} from './messageUtils'

export type MessageAssetPreviewState = {
  asset: SpaceMessageAssetResponse
  message: SpaceMessageResponse
}

export type MessageContextMenuState = {
  message: SpaceMessageResponse
  x: number
  y: number
  focusOnOpen: boolean
}

type MessagePanelOverlaysProps = {
  downloadWarning: DownloadWarningState | null
  messageContextMenu: MessageContextMenuState | null
  messageContextItems: ContextMenuItem[]
  previewAsset: MessageAssetPreviewState | null
  reportContext: ServerMessageReportContext | null
  reportMessage: SpaceMessageResponse | null
  onCloseDownloadWarning: () => void
  onCloseMessageContextMenu: () => void
  onClosePreview: () => void
  onCloseReport: () => void
  onConfirmAssetDownload: () => void
}

type AttachmentDownloadWarningDialogProps = {
  downloadWarning: DownloadWarningState
  onClose: () => void
  onConfirm: () => void
}

function AttachmentDownloadWarningDialog({
  downloadWarning,
  onClose,
  onConfirm,
}: AttachmentDownloadWarningDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [clockMs, setClockMs] = useState(() => performance.now())
  const { isClosing, requestClose } = useAnimatedOverlayClose(
    downloadWarningCloseDurationMs,
  )

  useEffect(() => {
    function updateClock() {
      setClockMs(performance.now())
    }

    updateClock()
    const remainingMs = getAttachmentDownloadWarningRemainingMs(
      downloadWarning.openedAtMs,
      performance.now(),
    )
    const unlockTimer = window.setTimeout(updateClock, remainingMs)
    const countdownTimer = window.setInterval(updateClock, 100)

    return () => {
      window.clearTimeout(unlockTimer)
      window.clearInterval(countdownTimer)
    }
  }, [downloadWarning.openedAtMs])

  const closeWarning = useCallback(() => {
    requestClose(onClose)
  }, [onClose, requestClose])

  useDismissableLayer({
    isOpen: !isClosing,
    layerRef: dialogRef,
    onDismiss: closeWarning,
  })

  const remainingMs = getAttachmentDownloadWarningRemainingMs(
    downloadWarning.openedAtMs,
    clockMs,
  )
  const isLocked = remainingMs > 0
  const countdownSeconds = getAttachmentDownloadWarningCountdownSeconds(
    downloadWarning.openedAtMs,
    clockMs,
  )
  const progress = getAttachmentDownloadWarningProgress(
    downloadWarning.openedAtMs,
    clockMs,
  )
  const overlayStyle = {
    '--attachment-warning-close-duration': `${downloadWarningCloseDurationMs}ms`,
  } as CSSProperties
  const downloadButtonStyle = {
    '--attachment-warning-progress': progress,
  } as CSSProperties

  return createPortal(
    <div
      className={`${styles.attachmentWarningOverlay} ${
        isClosing ? styles.attachmentWarningOverlayClosing : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="attachment-warning-title"
      style={overlayStyle}
    >
      <div
        ref={dialogRef}
        className={`${styles.attachmentWarningDialog} ${
          isClosing ? styles.attachmentWarningDialogClosing : ''
        }`}
      >
        <h2 id="attachment-warning-title">{downloadWarning.title}</h2>
        <p>{downloadWarning.body}</p>
        <dl>
          <div>
            <dt>{serverCopy.messages.file}</dt>
            <dd>
              {downloadWarning.asset.fileName ||
                serverCopy.messages.attachment}
            </dd>
          </div>
          <div>
            <dt>{serverCopy.messages.size}</dt>
            <dd>{formatFileSize(downloadWarning.asset.sizeBytes)}</dd>
          </div>
        </dl>
        <div className={styles.attachmentWarningActions}>
          <button
            type="button"
            disabled={isClosing}
            onClick={closeWarning}
          >
            {commonCopy.actions.cancel}
          </button>
          <button
            className={styles.attachmentWarningDownload}
            type="button"
            disabled={isLocked || isClosing}
            aria-label={
              isLocked
                ? serverCopy.messages.downloadAttachmentWaiting(
                    countdownSeconds,
                  )
                : serverCopy.messages.downloadAttachment
            }
            aria-live="polite"
            style={downloadButtonStyle}
            onClick={() => {
              if (!isLocked) {
                requestClose(onConfirm)
              }
            }}
          >
            <span aria-hidden="true">
              {serverCopy.messages.downloadAttachment}
            </span>
          </button>
        </div>
        <small className={styles.attachmentWarningHint}>
          {serverCopy.messages.downloadWarningSettingsHintBefore}
          <button
            type="button"
            disabled={isClosing}
            onClick={() => {
              requestClose(onClose, () => {
                requestSystemSettingsNavigation('dangerous-files-warning')
              })
            }}
          >
            {serverCopy.messages.downloadWarningSettingsLink}
          </button>
          {serverCopy.messages.downloadWarningSettingsHintAfter}
        </small>
      </div>
    </div>,
    document.body,
  )
}

export function MessagePanelOverlays({
  downloadWarning,
  messageContextMenu,
  messageContextItems,
  previewAsset,
  reportContext,
  reportMessage,
  onCloseDownloadWarning,
  onCloseMessageContextMenu,
  onClosePreview,
  onCloseReport,
  onConfirmAssetDownload,
}: MessagePanelOverlaysProps) {
  return (
    <>
      {messageContextMenu && (
        <ContextMenu
          x={messageContextMenu.x}
          y={messageContextMenu.y}
          items={messageContextItems}
          autoFocus={messageContextMenu.focusOnOpen}
          onClose={onCloseMessageContextMenu}
        />
      )}
      {previewAsset && (
        <AssetPreviewOverlay
          asset={{
            url: `/api/assets/${previewAsset.asset.assetId}/content`,
            title: previewAsset.asset.fileName || serverCopy.messages.image,
            createdAt: previewAsset.asset.createdAt,
            sizeBytes: previewAsset.asset.sizeBytes,
            mediaType: isVideoAsset(previewAsset.asset) ? 'video' : 'image',
          }}
          author={{
            displayName: previewAsset.message.senderDisplayName,
            avatarUrl: previewAsset.message.senderAvatarAssetId
              ? `/api/assets/${previewAsset.message.senderAvatarAssetId}/content`
              : null,
            avatarCropOffsetX: previewAsset.message.senderAvatarCropOffsetX,
            avatarCropOffsetY: previewAsset.message.senderAvatarCropOffsetY,
            avatarCropZoom: previewAsset.message.senderAvatarCropZoom,
          }}
          onClose={onClosePreview}
        />
      )}
      {reportContext && reportMessage && (
        <MessageReportDialog
          context={reportContext}
          message={reportMessage}
          onClose={onCloseReport}
        />
      )}
      {downloadWarning && (
        <AttachmentDownloadWarningDialog
          key={downloadWarning.openedAtMs}
          downloadWarning={downloadWarning}
          onClose={onCloseDownloadWarning}
          onConfirm={onConfirmAssetDownload}
        />
      )}
    </>
  )
}
