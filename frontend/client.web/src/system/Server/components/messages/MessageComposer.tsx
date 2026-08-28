import type {
  ChangeEvent,
  Dispatch,
  FormEvent,
  KeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SpaceMessageResponse } from '../../../../shared/types'
import { serverCopy, SystemIcon } from '../../../shared'
import { SystemPlusIcon } from '../../../shared/icons/components/SystemPlusIcon'
import workspaceStyles from '../shell/ServerWorkspace.module.css'
import type { MessageAttachmentDraft } from './messageAttachmentDraft'
import { MessageAttachmentDraftList } from './MessageAttachmentDraftList'
import { MessageReplyPreview } from './MessageReply'
import {
  MentionAutocomplete,
  flattenMentionSuggestions,
} from './MentionAutocomplete'
import { MessageComposerMentionOverlay } from './MessageComposerMentionOverlay'
import {
  buildMentionSuggestions,
  discoverDraftMentions,
  findActiveMentionQuery,
  insertMentionOption,
  isActiveMentionQueryResolved,
  reconcileDraftMentions,
  scheduleMentionCandidateQuery,
  type DraftMention,
  type MentionOption,
  type MentionRoleCandidate,
  type MentionUserCandidate,
} from './mentions'
import {
  getMessageComposerHeight,
  getMessageComposerMaximumHeight,
} from './messageComposerSizing'
import {
  advanceMessageComposerFocus,
  createMessageComposerFocusState,
  insertMessageEmoji,
} from './messageComposerInteractionModel'
import { MessageComposerEmojiPicker } from './MessageComposerEmojiPicker'
import styles from './MessageComposer.module.css'

type MessageComposerProps = {
  title: string
  draft: string
  editingMessage: SpaceMessageResponse | null
  fileInputRef: RefObject<HTMLInputElement | null>
  hasComposerContent: boolean
  isSending: boolean
  canSendMessages: boolean
  autoFocusOnMount?: boolean
  focusRequestId?: number
  replyTarget: SpaceMessageResponse | null
  draftMentions: readonly DraftMention[]
  mentionUsers: readonly MentionUserCandidate[]
  mentionRoles: readonly MentionRoleCandidate[]
  mentionInsertionRequest?: MessageComposerMentionInsertionRequest | null
  selectedAttachments: MessageAttachmentDraft[]
  onAddSelectedFiles: (files: FileList | null) => void
  onCancelComposerMode: () => void
  onCancelReply: () => void
  onRefreshMentionCandidates?: (
    query: string,
    signal: AbortSignal,
  ) => void
  onMentionInsertionRequestHandled?: (requestId: number) => void
  onOpenFilePicker: () => void
  onChangeSelectedAttachments: (attachments: MessageAttachmentDraft[]) => void
  onSetDraft: Dispatch<SetStateAction<string>>
  onSetDraftMentions: Dispatch<SetStateAction<DraftMention[]>>
  onSubmitMessage: (event: FormEvent<HTMLFormElement>) => void
}

export type MessageComposerMentionInsertionRequest = {
  id: number
  user: MentionUserCandidate
}

function resizeMessageBody(textarea: HTMLTextAreaElement) {
  const computedStyle = window.getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20
  const verticalPadding =
    (Number.parseFloat(computedStyle.paddingTop) || 0) +
    (Number.parseFloat(computedStyle.paddingBottom) || 0)
  const minimumHeight =
    Number.parseFloat(computedStyle.minHeight) || lineHeight + verticalPadding
  const workspaceHeight =
    textarea.form?.parentElement?.parentElement?.clientHeight ||
    textarea.form?.parentElement?.clientHeight ||
    window.innerHeight
  const maximumHeight = getMessageComposerMaximumHeight({
    isMobile: window.matchMedia('(max-width: 760px)').matches,
    lineHeight,
    minimumHeight,
    verticalPadding,
    workspaceHeight,
  })

  textarea.style.height = 'auto'
  const nextHeight = getMessageComposerHeight(
    textarea.scrollHeight,
    minimumHeight,
    maximumHeight,
  )
  textarea.style.height = `${nextHeight}px`
  textarea.style.overflowY =
    textarea.scrollHeight > maximumHeight ? 'auto' : 'hidden'
}

export function MessageComposer({
  title,
  draft,
  editingMessage,
  fileInputRef,
  hasComposerContent,
  isSending,
  canSendMessages,
  autoFocusOnMount = false,
  focusRequestId = 0,
  replyTarget,
  draftMentions,
  mentionUsers,
  mentionRoles,
  mentionInsertionRequest,
  selectedAttachments,
  onAddSelectedFiles,
  onCancelComposerMode,
  onCancelReply,
  onRefreshMentionCandidates,
  onMentionInsertionRequestHandled,
  onOpenFilePicker,
  onChangeSelectedAttachments,
  onSetDraft,
  onSetDraftMentions,
  onSubmitMessage,
}: MessageComposerProps) {
  const messageBodyRef = useRef<HTMLTextAreaElement | null>(null)
  const focusStateRef = useRef(createMessageComposerFocusState())
  const selectionRangeRef = useRef({ start: 0, end: 0 })
  const mentionOverlayRef = useRef<HTMLDivElement | null>(null)
  const isPastePendingRef = useRef(false)
  const scannedMentionCandidatesRef = useRef<string | null>(null)
  const refreshMentionCandidatesRef = useRef(onRefreshMentionCandidates)
  const handledMentionInsertionRequestIdRef = useRef<number | null>(null)
  const autocompleteId = `message-mentions-${useId().replace(/:/g, '')}`
  const [caretPosition, setCaretPosition] = useState(0)
  const [activeMentionIndex, setActiveMentionIndex] = useState(0)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [dismissedMentionQuery, setDismissedMentionQuery] = useState<
    string | null
  >(null)
  const activeMentionQuery = useMemo(() => {
    const query = findActiveMentionQuery(draft, caretPosition)
    return query && isActiveMentionQueryResolved(draft, query, draftMentions)
      ? null
      : query
  }, [caretPosition, draft, draftMentions])
  const mentionSuggestions = useMemo(
    () =>
      buildMentionSuggestions({
        query: activeMentionQuery?.query ?? '',
        users: mentionUsers,
        roles: mentionRoles,
      }),
    [activeMentionQuery?.query, mentionRoles, mentionUsers],
  )
  const mentionOptions = useMemo(
    () => flattenMentionSuggestions(mentionSuggestions),
    [mentionSuggestions],
  )

  useEffect(() => {
    if (
      !mentionInsertionRequest ||
      handledMentionInsertionRequestIdRef.current ===
        mentionInsertionRequest.id
    ) {
      return
    }

    handledMentionInsertionRequestIdRef.current = mentionInsertionRequest.id
    const separator = draft.length > 0 && !/\s$/u.test(draft) ? ' ' : ''
    const token = `@${mentionInsertionRequest.user.login}`
    const start = draft.length + separator.length
    const nextDraft = `${draft}${separator}${token} `
    const reconciledMentions = reconcileDraftMentions(
      draft,
      nextDraft,
      draftMentions,
    )
    const nextMentions = discoverDraftMentions(nextDraft, [], [
      ...reconciledMentions,
      {
        kind: 'user',
        targetId: mentionInsertionRequest.user.id,
        token,
        start,
        length: token.length,
      },
    ])

    onSetDraft(nextDraft)
    onSetDraftMentions(nextMentions)
    onMentionInsertionRequestHandled?.(mentionInsertionRequest.id)
    setCaretPosition(nextDraft.length)
    selectionRangeRef.current = {
      start: nextDraft.length,
      end: nextDraft.length,
    }
    window.requestAnimationFrame(() => {
      messageBodyRef.current?.focus({ preventScroll: true })
      messageBodyRef.current?.setSelectionRange(
        nextDraft.length,
        nextDraft.length,
      )
    })
  }, [
    draft,
    draftMentions,
    mentionInsertionRequest,
    onSetDraft,
    onSetDraftMentions,
    onMentionInsertionRequestHandled,
  ])
  const mentionQueryKey = activeMentionQuery
    ? `${activeMentionQuery.start}:${activeMentionQuery.query}`
    : null
  const isMentionAutocompleteOpen = Boolean(
    !isSending &&
      !isEmojiPickerOpen &&
      activeMentionQuery &&
      mentionOptions.length > 0 &&
      dismissedMentionQuery !== mentionQueryKey,
  )
  const safeActiveMentionIndex = Math.min(
    activeMentionIndex,
    Math.max(mentionOptions.length - 1, 0),
  )
  const mentionCandidatesRevision = useMemo(
    () =>
      JSON.stringify([
        mentionUsers.map((user) => [user.id, user.login, user.displayName]),
        mentionRoles.map((role) => [role.id, role.title]),
      ]),
    [mentionRoles, mentionUsers],
  )
  const activeMentionQueryText = activeMentionQuery?.query
  const activeMentionQueryStart = activeMentionQuery?.start

  useLayoutEffect(() => {
    refreshMentionCandidatesRef.current = onRefreshMentionCandidates
  }, [onRefreshMentionCandidates])

  useEffect(() => {
    if (isSending || !canSendMessages) {
      setIsEmojiPickerOpen(false)
    }
  }, [canSendMessages, isSending])

  useEffect(() => {
    if (!activeMentionQueryText || !refreshMentionCandidatesRef.current) {
      return undefined
    }

    return scheduleMentionCandidateQuery(
      (query, signal) =>
        refreshMentionCandidatesRef.current?.(query, signal),
      activeMentionQueryText,
    )
  }, [activeMentionQueryStart, activeMentionQueryText])

  useEffect(() => {
    if (scannedMentionCandidatesRef.current === mentionCandidatesRevision) {
      return
    }

    scannedMentionCandidatesRef.current = mentionCandidatesRevision
    const suggestions = buildMentionSuggestions({
      query: '',
      users: mentionUsers,
      roles: mentionRoles,
      maximumUsers: mentionUsers.length,
    })
    const options = flattenMentionSuggestions(suggestions)
    onSetDraftMentions((current) =>
      discoverDraftMentions(
        draft,
        options,
        current,
      ),
    )
  }, [draft, mentionCandidatesRevision, mentionRoles, mentionUsers, onSetDraftMentions])

  useLayoutEffect(() => {
    const textarea = messageBodyRef.current
    if (!textarea) return

    resizeMessageBody(textarea)
  }, [draft])

  useLayoutEffect(() => {
    const decision = advanceMessageComposerFocus(focusStateRef.current, {
      autoFocusOnMount,
      focusRequestId,
      canFocus: canSendMessages && !isSending,
    })
    focusStateRef.current = decision.state
    if (!decision.shouldFocus) return

    messageBodyRef.current?.focus({ preventScroll: true })
  }, [autoFocusOnMount, canSendMessages, focusRequestId, isSending])

  useLayoutEffect(() => {
    const textarea = messageBodyRef.current
    if (!textarea) return

    const workspace =
      textarea.form?.parentElement?.parentElement ??
      textarea.form?.parentElement
    const resize = () => resizeMessageBody(textarea)
    const resizeObserver =
      workspace && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(resize)
        : null

    if (workspace) resizeObserver?.observe(workspace)
    window.addEventListener('resize', resize)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [])

  function changeDraft(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextDraft = event.target.value
    const reconciledMentions = reconcileDraftMentions(
      draft,
      nextDraft,
      draftMentions,
    )
    const nextQuery = findActiveMentionQuery(
      nextDraft,
      event.target.selectionStart,
    )
    const isPaste = isPastePendingRef.current
    const discoveryOptions = isPaste
      ? flattenMentionSuggestions(
          buildMentionSuggestions({
            query: '',
            users: mentionUsers,
            roles: mentionRoles,
            maximumUsers: mentionUsers.length,
          }),
        )
      : []
    isPastePendingRef.current = false

    onSetDraft(nextDraft)
    onSetDraftMentions(
      isPaste
        ? discoverDraftMentions(
            nextDraft,
            discoveryOptions,
            reconciledMentions,
          )
        : reconciledMentions,
    )
    setCaretPosition(event.target.selectionStart)
    selectionRangeRef.current = {
      start: event.target.selectionStart,
      end: event.target.selectionEnd,
    }
    setActiveMentionIndex(0)
    const nextQueryKey = nextQuery
      ? `${nextQuery.start}:${nextQuery.query}`
      : null
    setDismissedMentionQuery((current) =>
      current === nextQueryKey ? current : null,
    )
  }

  function selectMention(option: MentionOption) {
    if (!activeMentionQuery) return

    const insertion = insertMentionOption(draft, activeMentionQuery, option)
    if (!insertion) return

    const reconciledMentions = reconcileDraftMentions(
      draft,
      insertion.text,
      draftMentions,
    )
    const nextMentions = discoverDraftMentions(
      insertion.text,
      [],
      [...reconciledMentions, insertion.mention],
    )

    onSetDraft(insertion.text)
    onSetDraftMentions(nextMentions)
    setCaretPosition(insertion.caret)
    selectionRangeRef.current = {
      start: insertion.caret,
      end: insertion.caret,
    }
    setActiveMentionIndex(0)
    const completedQuery = findActiveMentionQuery(
      insertion.text,
      insertion.caret,
    )
    setDismissedMentionQuery(
      completedQuery
        ? `${completedQuery.start}:${completedQuery.query}`
        : null,
    )

    window.requestAnimationFrame(() => {
      messageBodyRef.current?.focus({ preventScroll: true })
      messageBodyRef.current?.setSelectionRange(
        insertion.caret,
        insertion.caret,
      )
    })
  }

  function insertEmoji(emoji: string) {
    const textarea = messageBodyRef.current
    const selectionStart =
      textarea?.selectionStart ?? selectionRangeRef.current.start
    const selectionEnd =
      textarea?.selectionEnd ?? selectionRangeRef.current.end
    const insertion = insertMessageEmoji({
      text: draft,
      emoji,
      selectionStart,
      selectionEnd,
    })

    if (!insertion.didInsert) {
      textarea?.focus({ preventScroll: true })
      return
    }

    onSetDraft(insertion.text)
    onSetDraftMentions(
      reconcileDraftMentions(draft, insertion.text, draftMentions),
    )
    setCaretPosition(insertion.caret)
    const nextMentionQuery = findActiveMentionQuery(
      insertion.text,
      insertion.caret,
    )
    setDismissedMentionQuery(
      nextMentionQuery
        ? `${nextMentionQuery.start}:${nextMentionQuery.query}`
        : null,
    )
    selectionRangeRef.current = {
      start: insertion.caret,
      end: insertion.caret,
    }

    window.requestAnimationFrame(() => {
      messageBodyRef.current?.focus({ preventScroll: true })
      messageBodyRef.current?.setSelectionRange(
        insertion.caret,
        insertion.caret,
      )
    })
  }

  function changeEmojiPickerOpen(nextIsOpen: boolean) {
    if (nextIsOpen) {
      const textarea = messageBodyRef.current
      if (textarea) {
        selectionRangeRef.current = {
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
        }
      }
      setDismissedMentionQuery(mentionQueryKey)
    }

    setIsEmojiPickerOpen(nextIsOpen)
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return
    }

    if (isMentionAutocompleteOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const direction = event.key === 'ArrowDown' ? 1 : -1
        setActiveMentionIndex((current) => {
          const count = mentionOptions.length
          return count === 0 ? 0 : (current + direction + count) % count
        })
        return
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const selectedOption = mentionOptions[safeActiveMentionIndex]
        if (selectedOption) selectMention(selectedOption)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissedMentionQuery(mentionQueryKey)
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <>
      {replyTarget && !editingMessage && (
        <MessageReplyPreview
          message={replyTarget}
          onCancel={onCancelReply}
          disabled={isSending}
        />
      )}

      {editingMessage && (
        <div className={styles.composerContext}>
          <div>
            <strong>{serverCopy.messages.editing}</strong>
            <span>{editingMessage.body ?? serverCopy.messages.emptyBody}</span>
          </div>
          <button
            type="button"
            onClick={onCancelComposerMode}
            disabled={isSending}
            aria-label={serverCopy.messages.cancelComposerMode}
          >
            <SystemIcon name="close" />
          </button>
        </div>
      )}

      {!canSendMessages && (
        <p
          className={styles.composerRestriction}
          id="server-message-send-restriction"
          role="status"
        >
          {serverCopy.messages.sendRestricted}
        </p>
      )}

      {selectedAttachments.length > 0 && (
        <MessageAttachmentDraftList
          attachments={selectedAttachments}
          disabled={isSending || !canSendMessages}
          onChange={onChangeSelectedAttachments}
        />
      )}

      <div className={styles.composerInputRegion}>
        {isMentionAutocompleteOpen && (
          <MentionAutocomplete
            id={autocompleteId}
            suggestions={mentionSuggestions}
            activeIndex={safeActiveMentionIndex}
            onActivate={setActiveMentionIndex}
            onSelect={selectMention}
          />
        )}
        <form
          className={`${workspaceStyles.textComposer} ${styles.textComposer} ${
            replyTarget ? styles.textComposerWithReply : ''
          }`}
          onSubmit={onSubmitMessage}
        >
        <input
          ref={fileInputRef}
          className={styles.fileInput}
          name="messageAttachments"
          type="file"
          multiple
          disabled={isSending || !canSendMessages}
          onChange={(event) => onAddSelectedFiles(event.target.files)}
        />
        <button
          className={styles.attachButton}
          type="button"
          aria-label={serverCopy.messages.attachment}
          disabled={
            isSending || Boolean(editingMessage) || !canSendMessages
          }
          onClick={onOpenFilePicker}
        >
          <SystemPlusIcon size="medium" />
        </button>
          <span className={styles.messageInputShell}>
            <MessageComposerMentionOverlay
              text={draft}
              mentions={draftMentions}
              overlayRef={mentionOverlayRef}
            />
            <textarea
              ref={messageBodyRef}
              name="messageBody"
              value={draft}
              disabled={isSending || !canSendMessages}
              aria-autocomplete="list"
              aria-expanded={isMentionAutocompleteOpen}
              aria-controls={
                isMentionAutocompleteOpen ? autocompleteId : undefined
              }
              aria-activedescendant={
                isMentionAutocompleteOpen
                  ? `${autocompleteId}-option-${safeActiveMentionIndex}`
                  : undefined
              }
              aria-describedby={
                canSendMessages ? undefined : 'server-message-send-restriction'
              }
              onChange={changeDraft}
              onClick={(event) => {
                const { selectionStart, selectionEnd } = event.currentTarget
                setCaretPosition(selectionStart)
                selectionRangeRef.current = {
                  start: selectionStart,
                  end: selectionEnd,
                }
              }}
              onKeyUp={(event) => {
                if (!['ArrowDown', 'ArrowUp'].includes(event.key)) {
                  const { selectionStart, selectionEnd } = event.currentTarget
                  setCaretPosition(selectionStart)
                  selectionRangeRef.current = {
                    start: selectionStart,
                    end: selectionEnd,
                  }
                }
              }}
              onKeyDown={handleMessageKeyDown}
              onPaste={() => {
                isPastePendingRef.current = true
              }}
              onScroll={(event) => {
                if (!mentionOverlayRef.current) return
                mentionOverlayRef.current.scrollTop = event.currentTarget.scrollTop
                mentionOverlayRef.current.scrollLeft = event.currentTarget.scrollLeft
              }}
              onSelect={(event) => {
                const { selectionStart, selectionEnd } = event.currentTarget
                setCaretPosition(selectionStart)
                selectionRangeRef.current = {
                  start: selectionStart,
                  end: selectionEnd,
                }
              }}
              placeholder={
                canSendMessages
                  ? serverCopy.messages.typeInSpace(title)
                  : serverCopy.messages.sendRestricted
              }
              maxLength={4000}
              rows={1}
            />
          </span>
        <MessageComposerEmojiPicker
          disabled={isSending || !canSendMessages}
          isOpen={isEmojiPickerOpen}
          onOpenChange={changeEmojiPickerOpen}
          onSelect={insertEmoji}
        />
        <button
          className={`${styles.sendButton} ${
            hasComposerContent ? styles.sendButtonVisible : ''
          }`}
          type="submit"
          aria-label={serverCopy.messages.send}
          disabled={isSending || !hasComposerContent || !canSendMessages}
        >
          {isSending ? (
            '...'
          ) : (
            <SystemIcon
              className={styles.sendButtonIcon}
              name="send"
              size={22}
              glow
            />
          )}
        </button>
        </form>
      </div>
    </>
  )
}
