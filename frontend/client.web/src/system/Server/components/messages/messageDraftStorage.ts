import type { SpaceMessageResponse } from '../../../../shared/types'
import { isDraftMentionValid, type DraftMention } from './mentions'

export type MessageDraft = {
  text: string
  mentions: DraftMention[]
  replyTarget: SpaceMessageResponse | null
}

const prefix = 'arcanelink.messageDraft.v1.'
const ttlMs = 30 * 24 * 60 * 60 * 1000

export function messageDraftKey(userId: string, feedKey: string) {
  return `${prefix}${encodeURIComponent(userId)}.${encodeURIComponent(feedKey)}`
}

export function emptyMessageDraft(): MessageDraft {
  return { text: '', mentions: [], replyTarget: null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Keep only the fields needed to identify and preview the reply, not attachments or payloads.
function replyPreview(message: SpaceMessageResponse | null) {
  return message ? {
    id: message.id,
    senderUserId: message.senderUserId,
    senderDisplayName: message.senderDisplayName,
    body: message.body,
    createdAt: message.createdAt,
  } : null
}

function draftContent(draft: MessageDraft) {
  return { text: draft.text, mentions: draft.mentions, replyTarget: replyPreview(draft.replyTarget) }
}

export function readMessageDraft(userId: string, feedKey: string): MessageDraft {
  try {
    const raw = localStorage.getItem(messageDraftKey(userId, feedKey))
    if (!raw) return emptyMessageDraft()
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.version !== 1 || typeof value.text !== 'string' ||
      typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt) ||
      value.updatedAt > Date.now() || Date.now() - value.updatedAt > ttlMs ||
      !Array.isArray(value.mentions)) return emptyMessageDraft()

    const mentions = value.mentions.filter((mention): mention is DraftMention =>
      isRecord(mention) && ['user', 'role', 'everyone'].includes(String(mention.kind)) &&
      (mention.targetId === null || typeof mention.targetId === 'string') &&
      typeof mention.token === 'string' && typeof mention.start === 'number' &&
      typeof mention.length === 'number' &&
      isDraftMentionValid(value.text as string, mention as DraftMention),
    )
    let replyTarget: SpaceMessageResponse | null = null
    const reply = value.replyTarget
    if (isRecord(reply) && typeof reply.id === 'string' && reply.id.length > 0 &&
      typeof reply.senderUserId === 'string' && typeof reply.senderDisplayName === 'string' &&
      (reply.body === null || typeof reply.body === 'string') && typeof reply.createdAt === 'string' &&
      Number.isFinite(Date.parse(reply.createdAt))) {
      replyTarget = {
        id: reply.id, senderUserId: reply.senderUserId, senderDisplayName: reply.senderDisplayName,
        body: reply.body, createdAt: reply.createdAt, serverId: '', spaceId: '',
        senderAvatarAssetId: null, senderAvatarCropOffsetX: 0, senderAvatarCropOffsetY: 0,
        senderAvatarCropZoom: 1, messageTypeId: '', messageTypeCode: 'text', payload: null,
        replyToMessageId: null, updatedAt: reply.createdAt, editedAt: null, deletedAt: null,
        assets: [], reactions: [],
      }
    }
    return { text: value.text, mentions, replyTarget }
  } catch {
    return emptyMessageDraft()
  }
}

export function writeMessageDraft(userId: string, feedKey: string, draft: MessageDraft) {
  try {
    const key = messageDraftKey(userId, feedKey)
    if (!draft.text && !draft.replyTarget) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify({ version: 1, updatedAt: Date.now(), ...draftContent(draft) }))
    }
  } catch {
    // Disabled storage or a full quota must not prevent composing a message.
  }
}

export function clearSentMessageDraft(userId: string, feedKey: string, submitted: MessageDraft) {
  // A send can finish after navigating away. Never erase a newer draft in that chat.
  // Mention resolution during submit can enrich metadata without changing the draft text.
  const current = readMessageDraft(userId, feedKey)
  if (current.text === submitted.text && current.replyTarget?.id === submitted.replyTarget?.id) {
    writeMessageDraft(userId, feedKey, emptyMessageDraft())
  }
}
