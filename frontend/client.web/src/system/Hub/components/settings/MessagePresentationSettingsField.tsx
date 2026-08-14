import type { MessageDisplayFormat } from '../../../../shared/types'
import {
  normalizeMessageBubbleAlignment,
  normalizeMessageBubbleWidth,
  normalizeMessageDisplayFormat,
  SystemSelect,
} from '../../../shared'
import type {
  MessageBubbleAlignment,
  MessageBubbleWidth,
} from '../../../shared'
import { settingsCopy } from '../../../shared/copy'
import styles from './SystemSettingsInterface.module.css'

type MessagePresentationSettingsFieldProps = {
  title: string
  description: string
  format: MessageDisplayFormat
  bubbleAlignment: MessageBubbleAlignment
  bubbleWidth: MessageBubbleWidth
  onFormatChange: (value: MessageDisplayFormat) => void
  onBubbleAlignmentChange: (value: MessageBubbleAlignment) => void
  onBubbleWidthChange: (value: MessageBubbleWidth) => void
}

export function MessagePresentationSettingsField({
  title,
  description,
  format,
  bubbleAlignment,
  bubbleWidth,
  onFormatChange,
  onBubbleAlignmentChange,
  onBubbleWidthChange,
}: MessagePresentationSettingsFieldProps) {
  return (
    <div className={styles.messageFormatField}>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <label className={styles.messageFormatControl}>
        <span>{settingsCopy.interface.messageDisplayFormatMode}</span>
        <SystemSelect
          value={format}
          onChange={(event) =>
            onFormatChange(
              normalizeMessageDisplayFormat(event.currentTarget.value),
            )
          }
        >
          <option value="wall-scroll">
            {settingsCopy.interface.messageDisplayFormatWallScroll}
          </option>
          <option value="bubble">
            {settingsCopy.interface.messageDisplayFormatBubble}
          </option>
        </SystemSelect>
      </label>
      {format === 'bubble' ? (
        <div className={styles.messageBubbleSettings}>
          <label className={styles.messageFormatControl}>
            <span>{settingsCopy.interface.messageBubbleAlignment}</span>
            <SystemSelect
              value={bubbleAlignment}
              onChange={(event) =>
                onBubbleAlignmentChange(
                  normalizeMessageBubbleAlignment(event.currentTarget.value),
                )
              }
            >
              <option value="one-side-left">
                {settingsCopy.interface.messageBubbleOneSideLeft}
              </option>
              <option value="one-side-right">
                {settingsCopy.interface.messageBubbleOneSideRight}
              </option>
              <option value="own-left">
                {settingsCopy.interface.messageBubbleOwnLeft}
              </option>
              <option value="own-right">
                {settingsCopy.interface.messageBubbleOwnRight}
              </option>
            </SystemSelect>
          </label>
          <label className={styles.messageFormatControl}>
            <span>{settingsCopy.interface.messageBubbleWidth}</span>
            <SystemSelect
              value={bubbleWidth}
              onChange={(event) =>
                onBubbleWidthChange(
                  normalizeMessageBubbleWidth(event.currentTarget.value),
                )
              }
            >
              <option value="standard">
                {settingsCopy.interface.messageBubbleWidthStandard}
              </option>
              <option value="full-width">
                {settingsCopy.interface.messageBubbleWidthFull}
              </option>
            </SystemSelect>
          </label>
        </div>
      ) : null}
    </div>
  )
}
