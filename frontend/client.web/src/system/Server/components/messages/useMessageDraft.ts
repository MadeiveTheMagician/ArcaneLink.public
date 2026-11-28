import { useCallback, useEffect, useState, type SetStateAction } from 'react'
import type { SpaceMessageResponse } from '../../../../shared/types'
import type { DraftMention } from './mentions'
import { messageDraftKey, readMessageDraft, writeMessageDraft } from './messageDraftStorage'

type EditDraft = { message: SpaceMessageResponse; text: string; mentions: DraftMention[] }

function resolve<T>(action: SetStateAction<T>, previous: T): T {
  return typeof action === 'function' ? (action as (value: T) => T)(previous) : action
}

export function useMessageDraft(userId: string, feedKey: string) {
  const key = messageDraftKey(userId, feedKey)
  const [entry, setEntry] = useState(() => ({ key, draft: readMessageDraft(userId, feedKey) }))
  const [edit, setEdit] = useState<EditDraft | null>(null)
  const isEditing = edit !== null
  if (entry.key !== key) {
    setEntry({ key, draft: readMessageDraft(userId, feedKey) })
    setEdit(null)
  }

  useEffect(() => {
    if (entry.key === key) writeMessageDraft(userId, feedKey, entry.draft)
  }, [entry, key, userId, feedKey])

  const setDraft = useCallback((action: SetStateAction<string>) => {
    if (isEditing) setEdit((current) => current ? { ...current, text: resolve(action, current.text) } : null)
    else setEntry((current) => ({ ...current, draft: { ...current.draft, text: resolve(action, current.draft.text) } }))
  }, [isEditing])

  const setDraftMentions = useCallback((action: SetStateAction<DraftMention[]>) => {
    if (isEditing) setEdit((current) => current ? { ...current, mentions: resolve(action, current.mentions) } : null)
    else setEntry((current) => ({ ...current, draft: { ...current.draft, mentions: resolve(action, current.draft.mentions) } }))
  }, [isEditing])

  const setReplyTarget = useCallback((action: SetStateAction<SpaceMessageResponse | null>) => {
    setEntry((current) => ({ ...current, draft: { ...current.draft, replyTarget: resolve(action, current.draft.replyTarget) } }))
  }, [])

  const beginEditing = useCallback((message: SpaceMessageResponse, mentions: DraftMention[]) => {
    setEdit({ message, text: message.body ?? '', mentions })
  }, [])
  const endEditing = useCallback(() => setEdit(null), [])

  return {
    draft: edit?.text ?? entry.draft.text,
    draftMentions: edit?.mentions ?? entry.draft.mentions,
    replyTarget: edit ? null : entry.draft.replyTarget,
    editingMessage: edit?.message ?? null,
    savedDraft: entry.draft,
    setDraft, setDraftMentions, setReplyTarget,
    beginEditing, endEditing,
  }
}
