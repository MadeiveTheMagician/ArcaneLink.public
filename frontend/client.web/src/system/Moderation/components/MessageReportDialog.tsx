import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { apiJson } from '../../../shared/api/api'
import type { SpaceMessageResponse } from '../../../shared/types'
import { SystemCloseIcon } from '../../shared/icons/components/SystemCloseIcon'
import buttonStyles from '../../shared/styles/Button.module.css'
import dialogStyles from '../../shared/styles/Dialog.module.css'
import { moderationCopy, moderationReasonOptions } from '../moderationCopy.ru'
import type {
  ModerationReasonCode,
  ModerationReportResponse,
} from '../moderationTypes'
import type { ServerMessageReportContext } from '../models/messageReportModel'
import styles from './MessageReportDialog.module.css'

type MessageReportDialogProps = {
  context: ServerMessageReportContext
  message: SpaceMessageResponse
  onClose: () => void
}

export function MessageReportDialog({
  context,
  message,
  onClose,
}: MessageReportDialogProps) {
  const [reasonCode, setReasonCode] =
    useState<ModerationReasonCode>('spam')
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedReport, setSubmittedReport] =
    useState<ModerationReportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reasonRef = useRef<HTMLSelectElement | null>(null)

  useEffect(() => {
    reasonRef.current?.focus()

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    window.addEventListener('keydown', closeFromKeyboard)
    return () => window.removeEventListener('keydown', closeFromKeyboard)
  }, [isSubmitting, onClose])

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const report = await apiJson<ModerationReportResponse>(
        `/api/servers/${context.serverId}/spaces/${context.spaceId}/messages/${message.id}/reports`,
        {
          method: 'POST',
          accessToken: context.accessToken,
          body: {
            reasonCode,
            details: details.trim() || null,
          },
        },
      )
      setSubmittedReport(report)
    } catch (requestError) {
      setError(
        requestError instanceof Error && requestError.message
          ? requestError.message
          : moderationCopy.report.failed,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className={dialogStyles.backdrop} role="presentation">
      <section
        className={`${dialogStyles.dialog} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-report-title"
        aria-describedby="message-report-description"
      >
        <header className={styles.header}>
          <div>
            <h2 id="message-report-title">{moderationCopy.report.title}</h2>
            <p id="message-report-description">
              {moderationCopy.report.description}
            </p>
          </div>
          <button
            type="button"
            aria-label={moderationCopy.report.close}
            disabled={isSubmitting}
            onClick={onClose}
          >
            <SystemCloseIcon size="medium" />
          </button>
        </header>

        {submittedReport ? (
          <div className={styles.success} role="status">
            <strong>{moderationCopy.report.successTitle}</strong>
            <p>{moderationCopy.report.successBody}</p>
            <button
              className={`${buttonStyles.button} ${buttonStyles.primary}`}
              type="button"
              onClick={onClose}
            >
              {moderationCopy.report.close}
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submitReport}>
            <blockquote>
              <strong>
                {moderationCopy.report.messageFrom(message.senderDisplayName)}
              </strong>
              <span>{message.body || moderationCopy.report.emptyMessage}</span>
            </blockquote>

            <label>
              <span>{moderationCopy.report.reason}</span>
              <select
                ref={reasonRef}
                value={reasonCode}
                disabled={isSubmitting}
                onChange={(event) =>
                  setReasonCode(event.target.value as ModerationReasonCode)
                }
              >
                {moderationReasonOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{moderationCopy.report.details}</span>
              <small>{moderationCopy.report.detailsHint}</small>
              <textarea
                value={details}
                maxLength={1000}
                rows={5}
                disabled={isSubmitting}
                placeholder={moderationCopy.report.detailsPlaceholder}
                onChange={(event) => setDetails(event.target.value)}
              />
              <em>{details.length}/1000</em>
            </label>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <div className={dialogStyles.actions}>
              <button
                className={`${buttonStyles.button} ${buttonStyles.ghost}`}
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
              >
                {moderationCopy.report.cancel}
              </button>
              <button
                className={`${buttonStyles.button} ${buttonStyles.primary}`}
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? moderationCopy.report.submitting
                  : moderationCopy.report.submit}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>,
    document.body,
  )
}
