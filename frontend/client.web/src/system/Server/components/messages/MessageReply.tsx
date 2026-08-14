import type {
  SpaceMessageReplyResponse,
  SpaceMessageResponse,
} from '../../../../shared/types'
import { SystemIcon } from '../../../shared'
import { formatMessageTime } from './messageUtils'
import styles from './MessageReply.module.css'

type ReplyAvatarProps = {
  assetId: string | null
  displayName: string
  cropOffsetX: number
  cropOffsetY: number
  cropZoom: number
}

function ReplyAvatar({
  assetId,
  displayName,
  cropOffsetX,
  cropOffsetY,
  cropZoom,
}: ReplyAvatarProps) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {assetId ? (
        <img
          className="ui-media-fit"
          src={`/api/assets/${assetId}/content`}
          alt=""
          style={{
            transform: `translate(${cropOffsetX * 100}%, ${cropOffsetY * 100}%) scale(${cropZoom})`,
          }}
        />
      ) : (
        displayName.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}

function getSelectedReplyText(message: SpaceMessageResponse) {
  if (message.body?.trim()) return message.body
  if (message.assets.length > 0) return `Вложение: ${message.assets[0].fileName}`
  return 'Сообщение без текста'
}

function getStoredReplyText(reply: SpaceMessageReplyResponse) {
  if (reply.isUnavailable) return 'Исходное сообщение недоступно'
  return reply.body?.trim() || 'Сообщение без текста'
}

export function MessageReplyPreview({
  message,
  onCancel,
  disabled = false,
}: {
  message: SpaceMessageResponse
  onCancel: () => void
  disabled?: boolean
}) {
  return (
    <section className={styles.preview} aria-live="polite">
      <ReplyAvatar
        assetId={message.senderAvatarAssetId}
        displayName={message.senderDisplayName}
        cropOffsetX={message.senderAvatarCropOffsetX}
        cropOffsetY={message.senderAvatarCropOffsetY}
        cropZoom={message.senderAvatarCropZoom}
      />
      <span className={styles.previewText}>
        <span className={styles.previewHeading}>
          <strong>{message.senderDisplayName}</strong>
          <time dateTime={message.createdAt}>
            {formatMessageTime(message.createdAt)}
          </time>
        </span>
        <span className={styles.previewBody}>{getSelectedReplyText(message)}</span>
      </span>
      <button
        className={styles.cancel}
        type="button"
        onClick={onCancel}
        disabled={disabled}
        aria-label="Отменить ответ"
      >
        <SystemIcon name="close" size={18} />
      </button>
    </section>
  )
}

export function MessageReplyReference({
  reply,
  onOpen,
}: {
  reply: SpaceMessageReplyResponse
  onOpen?: () => void
}) {
  const senderName = reply.senderDisplayName ?? 'исходное сообщение'
  const content = (
    <>
      <span className={styles.referenceMark} aria-hidden="true">↩</span>
      <span className={styles.referenceText}>
        <span className={styles.referenceHeading}>
          Ответ: {senderName}
        </span>
        <span className={styles.referenceBody}>{getStoredReplyText(reply)}</span>
      </span>
    </>
  )

  if (onOpen && !reply.isUnavailable) {
    return (
      <button
        className={`${styles.reference} ${styles.referenceButton}`}
        type="button"
        onClick={onOpen}
        aria-label={`Открыть исходное сообщение от ${senderName}`}
      >
        {content}
      </button>
    )
  }

  return <div className={styles.reference}>{content}</div>
}
