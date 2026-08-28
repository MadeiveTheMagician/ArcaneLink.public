import { useEffect, useRef, useState, type FormEvent } from 'react'
import { apiRequest, readJsonResponse } from '../../../shared/api/api'
import {
  getModerationCaseStatusLabel,
  getModerationReasonLabel,
  moderationCaseStatusOptions,
  moderationCopy,
} from '../moderationCopy.ru'
import type {
  ModerationCaseStatus,
  ModerationEvidenceAssetResponse,
} from '../moderationTypes'
import type { ModerationCaseFilter } from '../models/moderationCaseModel'
import {
  isExpectedModerationEvidenceResponseUrl,
  isMatchingModerationEvidenceSha256,
  resolveModerationEvidenceContentUrl,
  sanitizeModerationEvidenceFileName,
  validateModerationEvidenceResponse,
  type ModerationEvidenceTransferMode,
} from '../models/moderationEvidenceAssetModel'
import { useServerModeration } from '../hooks/useServerModeration'
import { SystemSelect } from '../../shared/ui/SystemSelect'
import styles from './ServerModerationPanel.module.css'

export function ServerModerationPanel({
  accessToken,
  serverId,
}: {
  accessToken: string
  serverId: string
}) {
  const moderation = useServerModeration({ accessToken, serverId })
  const [statusDraft, setStatusDraft] =
    useState<ModerationCaseStatus>('open')
  const [noteDraft, setNoteDraft] = useState('')
  const [loadingEvidenceAssetId, setLoadingEvidenceAssetId] = useState<
    string | null
  >(null)
  const [evidenceAssetError, setEvidenceAssetError] = useState<{
    evidenceAssetId: string
    message: string
  } | null>(null)
  const evidenceTransferSequenceRef = useRef(0)
  const evidenceObjectUrlsRef = useRef(new Set<string>())
  const evidenceObjectUrlTimeoutsRef = useRef(new Map<string, number>())
  const selectedCaseId = moderation.selectedCase?.caseId ?? null

  useEffect(() => {
    if (moderation.selectedCase) {
      setStatusDraft(moderation.selectedCase.status)
      setNoteDraft('')
    }
  }, [moderation.selectedCase])

  useEffect(() => {
    evidenceTransferSequenceRef.current += 1
    setLoadingEvidenceAssetId(null)
    setEvidenceAssetError(null)
  }, [selectedCaseId])

  useEffect(() => {
    const evidenceObjectUrls = evidenceObjectUrlsRef.current
    const evidenceObjectUrlTimeouts = evidenceObjectUrlTimeoutsRef.current

    return () => {
      evidenceTransferSequenceRef.current += 1

      for (const timeoutId of evidenceObjectUrlTimeouts.values()) {
        window.clearTimeout(timeoutId)
      }

      for (const objectUrl of evidenceObjectUrls) {
        URL.revokeObjectURL(objectUrl)
      }

      evidenceObjectUrlTimeouts.clear()
      evidenceObjectUrls.clear()
    }
  }, [])

  async function submitStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (await moderation.updateCase(statusDraft, noteDraft)) {
      setNoteDraft('')
    }
  }

  async function transferEvidenceAsset(
    asset: ModerationEvidenceAssetResponse,
  ) {
    const selectedCase = moderation.selectedCase
    if (!selectedCase || loadingEvidenceAssetId) {
      return
    }

    const transferSequence = ++evidenceTransferSequenceRef.current
    setLoadingEvidenceAssetId(asset.evidenceAssetId)
    setEvidenceAssetError(null)
    let objectUrl: string | null = null

    try {
      const contentUrl = resolveModerationEvidenceContentUrl({
        contentUrl: asset.contentUrl,
        origin: window.location.origin,
        serverId,
        caseId: selectedCase.caseId,
        evidenceAssetId: asset.evidenceAssetId,
      })

      if (!contentUrl) {
        throw new Error(moderationCopy.cases.invalidAttachmentUrl)
      }

      const response = await apiRequest(contentUrl, {
        accessToken,
        cache: 'no-store',
        headers: {
          Accept: `${asset.mimeType}, application/octet-stream`,
        },
        redirect: 'error',
      })

      if (evidenceTransferSequenceRef.current !== transferSequence) {
        return
      }

      if (!response.ok) {
        await readJsonResponse<unknown>(response)
        throw new Error(moderationCopy.cases.attachmentTransferFailed)
      }

      if (
        response.status !== 200 ||
        !isExpectedModerationEvidenceResponseUrl({
          responseUrl: response.url,
          requestPath: contentUrl,
          origin: window.location.origin,
        })
      ) {
        throw new Error(moderationCopy.cases.invalidAttachmentResponse)
      }

      const blob = await response.blob()

      if (evidenceTransferSequenceRef.current !== transferSequence) {
        return
      }

      const validation = validateModerationEvidenceResponse({
        recordedMimeType: asset.mimeType,
        recordedSizeBytes: asset.sizeBytes,
        responseContentType: response.headers.get('Content-Type'),
        responseContentDisposition: response.headers.get(
          'Content-Disposition',
        ),
        responseSizeBytes: blob.size,
      })

      if (!validation.ok) {
        throw new Error(moderationCopy.cases.invalidAttachmentResponse)
      }

      const actualSha256 = await calculateBlobSha256(blob)

      if (evidenceTransferSequenceRef.current !== transferSequence) {
        return
      }

      if (!isMatchingModerationEvidenceSha256(asset.sha256, actualSha256)) {
        throw new Error(moderationCopy.cases.attachmentIntegrityFailed)
      }

      objectUrl = URL.createObjectURL(blob)
      evidenceObjectUrlsRef.current.add(objectUrl)
      triggerEvidenceAssetTransfer(
        objectUrl,
        validation.mode,
        asset.fileName,
      )
      scheduleEvidenceObjectUrlRevocation(objectUrl, validation.mode)
      objectUrl = null
    } catch (error) {
      if (objectUrl) {
        revokeEvidenceObjectUrl(objectUrl)
      }

      if (evidenceTransferSequenceRef.current === transferSequence) {
        setEvidenceAssetError({
          evidenceAssetId: asset.evidenceAssetId,
          message:
            error instanceof Error && error.message
              ? error.message
              : moderationCopy.cases.attachmentTransferFailed,
        })
      }
    } finally {
      if (evidenceTransferSequenceRef.current === transferSequence) {
        setLoadingEvidenceAssetId(null)
      }
    }
  }

  function scheduleEvidenceObjectUrlRevocation(
    objectUrl: string,
    mode: ModerationEvidenceTransferMode,
  ) {
    const timeoutId = window.setTimeout(
      () => revokeEvidenceObjectUrl(objectUrl),
      mode === 'open' ? 60_000 : 5_000,
    )
    evidenceObjectUrlTimeoutsRef.current.set(objectUrl, timeoutId)
  }

  function revokeEvidenceObjectUrl(objectUrl: string) {
    const timeoutId = evidenceObjectUrlTimeoutsRef.current.get(objectUrl)
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
      evidenceObjectUrlTimeoutsRef.current.delete(objectUrl)
    }

    if (evidenceObjectUrlsRef.current.delete(objectUrl)) {
      URL.revokeObjectURL(objectUrl)
    }
  }

  return (
    <section
      className={styles.panel}
      aria-labelledby="server-moderation-title"
    >
      <header className={styles.heading}>
        <div>
          <h3 id="server-moderation-title">{moderationCopy.cases.title}</h3>
          <p>{moderationCopy.cases.description}</p>
        </div>
        <label>
          <span>{moderationCopy.cases.filter}</span>
          <SystemSelect
            aria-label={moderationCopy.cases.filter}
            value={moderation.statusFilter}
            onValueChange={(value) =>
              moderation.setStatusFilter(
                value as ModerationCaseFilter,
              )
            }
          >
            <option value="all">{moderationCopy.cases.allStatuses}</option>
            {moderationCaseStatusOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </SystemSelect>
        </label>
      </header>

      <div className={styles.workspace}>
        <div
          className={styles.caseColumn}
          aria-busy={moderation.isLoadingCases}
          aria-label={moderationCopy.cases.title}
        >
          <div className={styles.feedback} aria-live="polite">
            {moderation.isLoadingCases && moderationCopy.cases.loading}
            {!moderation.isLoadingCases && moderation.listError && (
              <>
                <span role="alert">{moderation.listError}</span>
                <button
                  type="button"
                  onClick={() => void moderation.loadCases()}
                >
                  {moderationCopy.cases.retry}
                </button>
              </>
            )}
          </div>

          {!moderation.isLoadingCases &&
            !moderation.listError &&
            moderation.cases.length === 0 && (
              <p className={styles.empty}>{moderationCopy.cases.empty}</p>
            )}

          {moderation.cases.length > 0 && (
            <div className={styles.caseList}>
              {moderation.cases.map((item) => {
                const isSelected =
                  moderation.selectedCaseId?.toLowerCase() ===
                  item.caseId.toLowerCase()

                return (
                  <button
                    key={item.caseId}
                    className={isSelected ? styles.selectedCase : ''}
                    type="button"
                    aria-current={isSelected ? 'true' : undefined}
                    aria-label={`${moderationCopy.cases.openCase}: ${item.reportedUserDisplayName}, ${getModerationCaseStatusLabel(item.status)}, ${moderationCopy.cases.submissions(item.submissionCount)}`}
                    onClick={() =>
                      void moderation.loadCaseDetail(item.caseId)
                    }
                  >
                    <span className={styles.caseTitle}>
                      <strong>{item.reportedUserDisplayName}</strong>
                      <em data-status={item.status}>
                        {getModerationCaseStatusLabel(item.status)}
                      </em>
                    </span>
                    <span className={styles.caseMeta}>
                      {moderationCopy.cases.submissions(item.submissionCount)}
                      {' · '}
                      {formatDateTime(item.updatedAt)}
                    </span>
                    <span className={styles.reasons}>
                      {item.reasonCodes
                        .map(getModerationReasonLabel)
                        .join(', ')}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {moderation.nextCursor && !moderation.listError && (
            <button
              className={styles.loadMore}
              type="button"
              disabled={moderation.isLoadingMore}
              onClick={() =>
                void moderation.loadCases({ append: true })
              }
            >
              {moderation.isLoadingMore
                ? moderationCopy.cases.loading
                : moderationCopy.cases.loadMore}
            </button>
          )}
        </div>

        <div className={styles.detailColumn}>
          {moderation.isLoadingDetail && (
            <p className={styles.detailFeedback} aria-live="polite">
              {moderationCopy.cases.loading}
            </p>
          )}

          {!moderation.isLoadingDetail && moderation.detailError && (
            <div className={styles.detailFeedback} role="alert">
              <span>{moderation.detailError}</span>
              {moderation.selectedCaseId && (
                <button
                  type="button"
                  onClick={() =>
                    void moderation.loadCaseDetail(
                      moderation.selectedCaseId!,
                    )
                  }
                >
                  {moderationCopy.cases.retry}
                </button>
              )}
            </div>
          )}

          {!moderation.isLoadingDetail && moderation.selectedCase && (
            <article
              className={styles.caseDetail}
              aria-labelledby="moderation-case-detail-title"
            >
              <header>
                <div>
                  <h4 id="moderation-case-detail-title">
                    {moderation.selectedCase.reportedUserDisplayName}
                  </h4>
                  <span>
                    {getModerationCaseStatusLabel(
                      moderation.selectedCase.status,
                    )}
                    {' · '}
                    {formatDateTime(moderation.selectedCase.updatedAt)}
                  </span>
                </div>
                <button type="button" onClick={moderation.closeCase}>
                  {moderationCopy.cases.closeCase}
                </button>
              </header>

              <dl className={styles.identifiers}>
                <div>
                  <dt>{moderationCopy.cases.reportedUser}</dt>
                  <dd>{moderation.selectedCase.reportedUserId}</dd>
                </div>
                <div>
                  <dt>Message ID</dt>
                  <dd>{moderation.selectedCase.messageId}</dd>
                </div>
              </dl>

              <form className={styles.decision} onSubmit={submitStatus}>
                <label>
                  <span>{moderationCopy.cases.updateStatus}</span>
                  <SystemSelect
                    aria-label={moderationCopy.cases.updateStatus}
                    value={statusDraft}
                    disabled={moderation.isUpdatingCase}
                    onValueChange={(value) =>
                      setStatusDraft(
                        value as ModerationCaseStatus,
                      )
                    }
                  >
                    {moderationCaseStatusOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </SystemSelect>
                </label>
                <label>
                  <span>{moderationCopy.cases.decisionNote}</span>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={noteDraft}
                    disabled={moderation.isUpdatingCase}
                    placeholder={moderationCopy.cases.decisionNotePlaceholder}
                    onChange={(event) => setNoteDraft(event.target.value)}
                  />
                </label>
                {moderation.updateError && (
                  <p role="alert">{moderation.updateError}</p>
                )}
                <button
                  type="submit"
                  disabled={
                    moderation.isUpdatingCase ||
                    (statusDraft === moderation.selectedCase.status &&
                      !noteDraft.trim())
                  }
                >
                  {moderation.isUpdatingCase
                    ? moderationCopy.cases.saving
                    : moderationCopy.cases.save}
                </button>
              </form>

              <section className={styles.evidenceSection}>
                <h5>{moderationCopy.cases.evidence}</h5>
                {moderation.selectedCase.evidence.map((evidence) => (
                  <article
                    className={styles.evidence}
                    key={evidence.evidenceId}
                  >
                    <header>
                      <strong>
                        {getModerationReasonLabel(evidence.reasonCode)}
                      </strong>
                      <time dateTime={evidence.submittedAt}>
                        {formatDateTime(evidence.submittedAt)}
                      </time>
                    </header>
                    {evidence.details && <p>{evidence.details}</p>}
                    <div className={styles.snapshot}>
                      <strong>{moderationCopy.cases.messageSnapshot}</strong>
                      <p>
                        {evidence.bodyExcerpt ||
                          moderationCopy.cases.noMessageText}
                      </p>
                    </div>
                    {evidence.payloadExcerpt && (
                      <div className={styles.snapshot}>
                        <strong>{moderationCopy.cases.payloadSnapshot}</strong>
                        <pre>{evidence.payloadExcerpt}</pre>
                      </div>
                    )}
                    <details>
                      <summary>{moderationCopy.cases.integrity}</summary>
                      <code>{evidence.contentSha256}</code>
                    </details>
                    {evidence.assets.length > 0 && (
                      <div className={styles.assets}>
                        <strong>{moderationCopy.cases.attachments}</strong>
                        {[...evidence.assets]
                          .sort(
                            (first, second) =>
                              first.displayOrder - second.displayOrder,
                          )
                          .map((asset) => {
                            const isLoading =
                              loadingEvidenceAssetId ===
                              asset.evidenceAssetId

                            return (
                              <button
                                key={asset.evidenceAssetId}
                                type="button"
                                aria-busy={isLoading}
                                aria-label={`${moderationCopy.cases.openAttachment}: ${moderationCopy.cases.attachment(asset.fileName)}`}
                                disabled={Boolean(loadingEvidenceAssetId)}
                                onClick={() =>
                                  void transferEvidenceAsset(asset)
                                }
                              >
                                <span>
                                  {moderationCopy.cases.attachment(
                                    asset.fileName,
                                  )}
                                </span>
                                <small>
                                  {asset.mimeType} ·{' '}
                                  {formatFileSize(asset.sizeBytes)} ·{' '}
                                  {isLoading
                                    ? moderationCopy.cases.loadingAttachment
                                    : moderationCopy.cases.openAttachment}
                                </small>
                              </button>
                            )
                          })}
                        {evidenceAssetError &&
                          evidence.assets.some(
                            (asset) =>
                              asset.evidenceAssetId ===
                              evidenceAssetError.evidenceAssetId,
                          ) && (
                            <p className={styles.assetError} role="alert">
                              {evidenceAssetError.message}
                            </p>
                          )}
                      </div>
                    )}
                  </article>
                ))}
              </section>

              <section className={styles.actionSection}>
                <h5>{moderationCopy.cases.actions}</h5>
                {moderation.selectedCase.actions.length === 0 ? (
                  <p>{moderationCopy.cases.noActions}</p>
                ) : (
                  <ol>
                    {moderation.selectedCase.actions.map((action) => (
                      <li key={action.actionId}>
                        <strong>
                          {getModerationCaseStatusLabel(action.fromStatus)} →{' '}
                          {getModerationCaseStatusLabel(action.toStatus)}
                        </strong>
                        <time dateTime={action.createdAt}>
                          {formatDateTime(action.createdAt)}
                        </time>
                        {action.note && <p>{action.note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </article>
          )}

          {!moderation.selectedCaseId && (
            <p className={styles.detailPlaceholder}>
              {moderationCopy.cases.openCase}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

async function calculateBlobSha256(blob: Blob) {
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    await blob.arrayBuffer(),
  )

  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')
}

function triggerEvidenceAssetTransfer(
  objectUrl: string,
  mode: ModerationEvidenceTransferMode,
  fileName: string,
) {
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.hidden = true

  if (mode === 'open') {
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
  } else {
    anchor.download = sanitizeModerationEvidenceFileName(fileName)
  }

  document.body.append(anchor)

  try {
    anchor.click()
  } finally {
    anchor.remove()
  }
}
