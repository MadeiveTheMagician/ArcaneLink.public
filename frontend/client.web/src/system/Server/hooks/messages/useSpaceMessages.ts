import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { apiJson, apiNoContent } from '../../../../shared/api/api'
import type {
  AssetResponse,
  CreateSpaceMessageRequest,
  ServerMemberResponse,
  SpaceMentionCandidatesResponse,
  SpaceMessageMentionRequest,
  SpaceMessageResponse,
  SpaceReadStateResponse,
  UpdateSpaceMessageRequest,
} from '../../../../shared/types'
import type { MessageAttachmentDraft } from '../../components/messages/messageAttachmentDraft'
import {
  buildMentionCandidateRequestPath,
  mergeMentionCandidateResponses,
} from '../../components/messages/mentions'
import { replaceMessage } from '../../components/messages/messageReactionModel'
import { serverCopy } from '../../../shared/index'
import { createRealtimeRefreshCoalescer } from '../../../shared/hooks/realtimeRefreshCoalescer'
import type { MessageFocusRequest } from '../../../shared/messages/messageFocusModel'
import {
  getOldestMessageCursor,
  getMessageWindowCursor,
  hasOlderMessagePage,
  mergeLatestMessagePage,
  messageHistoryPageSize,
  prependOlderMessagePage,
  type OlderMessageLoadResult,
} from './messagePaginationModel'

type SpaceMessagesChangedPayload = {
  serverId?: string | null
  spaceId?: string | null
  messageId?: string | null
}

export type FocusMessageRequest = MessageFocusRequest

const maxAttachmentUploadSizeBytes = 10 * 1024 * 1024
const maxAttachmentsPerMessage = 10
const emptyMentionCandidates: SpaceMentionCandidatesResponse = {
  users: [],
  roles: [],
}

export function useSpaceMessages(
  accessToken: string,
  selectedServerMembership: ServerMemberResponse,
  spaceId: string | null,
  focusMessage: FocusMessageRequest | null = null,
  canSendMessages = false,
  canManageMessages = false,
) {
  const [messages, setMessages] = useState<SpaceMessageResponse[]>([])
  const [loadedMessagesSourceId, setLoadedMessagesSourceId] = useState<
    string | null
  >(null)
  const [pinnedMessages, setPinnedMessages] = useState<SpaceMessageResponse[]>([])
  const [isLoadingPinnedMessages, setIsLoadingPinnedMessages] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false)
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const messagesRequestIdRef = useRef(0)
  const latestMessagesRequestIdRef = useRef(0)
  const olderMessagesRequestIdRef = useRef(0)
  const isLoadingOlderMessagesRef = useRef(false)
  const mentionCandidatesRequestIdRef = useRef(0)
  const mentionCandidatesAbortControllerRef =
    useRef<AbortController | null>(null)
  const cancelMentionCandidateRequest = useCallback(() => {
    mentionCandidatesAbortControllerRef.current?.abort()
    mentionCandidatesAbortControllerRef.current = null
    ++mentionCandidatesRequestIdRef.current
  }, [])
  const [mentionCandidatesState, setMentionCandidatesState] = useState<{
    sourceId: string | null
    value: SpaceMentionCandidatesResponse
  }>({ sourceId: null, value: emptyMentionCandidates })
  const mentionCandidatesStateRef = useRef(mentionCandidatesState)
  const messageSourceId = spaceId
    ? `${selectedServerMembership.serverId}:${spaceId}`
    : null
  const activeMessageSourceIdRef = useRef(messageSourceId)
  const loadedMessagesSourceIdRef = useRef(loadedMessagesSourceId)
  const messagesRef = useRef(messages)
  const hasOlderMessagesRef = useRef(hasOlderMessages)
  useLayoutEffect(() => {
    activeMessageSourceIdRef.current = messageSourceId
    loadedMessagesSourceIdRef.current = loadedMessagesSourceId
    messagesRef.current = messages
    hasOlderMessagesRef.current = hasOlderMessages
    mentionCandidatesStateRef.current = mentionCandidatesState
  }, [
    hasOlderMessages,
    loadedMessagesSourceId,
    messageSourceId,
    messages,
    mentionCandidatesState,
  ])
  const visibleMessages =
    loadedMessagesSourceId === messageSourceId ? messages : []
  const isLoadingVisibleMessages =
    Boolean(messageSourceId && loadedMessagesSourceId !== messageSourceId) ||
    isLoadingMessages
  const mentionCandidates =
    mentionCandidatesState.sourceId === messageSourceId
      ? mentionCandidatesState.value
      : emptyMentionCandidates

  async function loadMentionCandidates(
    query?: string,
    cancellationSignal?: AbortSignal,
  ): Promise<SpaceMentionCandidatesResponse> {
    const requestedSpaceId = spaceId
    const requestedServerId = selectedServerMembership.serverId
    const requestedSourceId = requestedSpaceId
      ? `${requestedServerId}:${requestedSpaceId}`
      : null
    const currentState = mentionCandidatesStateRef.current
    const fallback = currentState.sourceId === requestedSourceId
      ? currentState.value
      : emptyMentionCandidates

    if (query == null) {
      return fallback
    }

    if (!requestedSpaceId || !requestedSourceId) {
      const emptyState = {
        sourceId: null,
        value: emptyMentionCandidates,
      }
      mentionCandidatesStateRef.current = emptyState
      setMentionCandidatesState(emptyState)
      return emptyMentionCandidates
    }

    mentionCandidatesAbortControllerRef.current?.abort()
    const controller = new AbortController()
    mentionCandidatesAbortControllerRef.current = controller
    const abortRequest = () => controller.abort()
    if (cancellationSignal?.aborted) {
      controller.abort()
    } else {
      cancellationSignal?.addEventListener('abort', abortRequest, {
        once: true,
      })
    }

    const requestId = ++mentionCandidatesRequestIdRef.current
    try {
      const value = await apiJson<SpaceMentionCandidatesResponse>(
        buildMentionCandidateRequestPath(
          requestedServerId,
          requestedSpaceId,
          query,
        ),
        {
          accessToken,
          signal: controller.signal,
        },
      )
      if (
        mentionCandidatesRequestIdRef.current === requestId &&
        activeMessageSourceIdRef.current === requestedSourceId &&
        !controller.signal.aborted
      ) {
        const latestState = mentionCandidatesStateRef.current
        const nextState = {
          sourceId: requestedSourceId,
          value: mergeMentionCandidateResponses(
            latestState.sourceId === requestedSourceId
              ? latestState.value
              : emptyMentionCandidates,
            value,
          ),
        }
        mentionCandidatesStateRef.current = nextState
        setMentionCandidatesState(nextState)
        return nextState.value
      }
      return fallback
    } catch {
      return fallback
    } finally {
      cancellationSignal?.removeEventListener('abort', abortRequest)
      if (mentionCandidatesAbortControllerRef.current === controller) {
        mentionCandidatesAbortControllerRef.current = null
      }
    }
  }

  async function loadMessages(
    silent = false,
    before?: { createdAt: string; id: string } | null,
  ): Promise<SpaceMessageResponse[] | null> {
    const requestId = ++messagesRequestIdRef.current
    ++latestMessagesRequestIdRef.current
    ++olderMessagesRequestIdRef.current
    const requestedSpaceId = spaceId
    const requestedServerId = selectedServerMembership.serverId
    const requestedSourceId = requestedSpaceId
      ? `${requestedServerId}:${requestedSpaceId}`
      : null
    isLoadingOlderMessagesRef.current = false
    setIsLoadingOlderMessages(false)
    setHasOlderMessages(false)

    if (!requestedSpaceId || !requestedSourceId) {
      setMessages([])
      setLoadedMessagesSourceId(null)
      setPinnedMessages([])
      setIsLoadingMessages(false)
      setMessageError(null)
      return null
    }

    if (!silent) {
      setIsLoadingMessages(true)
    }

    try {
      setMessageError(null)
      const params = new URLSearchParams({
        limit: String(messageHistoryPageSize),
      })

      if (before) {
        params.set('beforeCreatedAt', before.createdAt)
        params.set('beforeId', before.id)
      }

      const loadedMessages = await apiJson<SpaceMessageResponse[]>(
          `/api/servers/${requestedServerId}/spaces/${requestedSpaceId}/messages?${params.toString()}`,
          { accessToken },
        )

      if (messagesRequestIdRef.current !== requestId) {
        return null
      }

      setMessages(loadedMessages)
      setLoadedMessagesSourceId(requestedSourceId)
      setHasOlderMessages(hasOlderMessagePage(loadedMessages))
      return loadedMessages
    } catch (error) {
      if (messagesRequestIdRef.current !== requestId) {
        return null
      }

      setMessageError(
        error instanceof Error ? error.message : serverCopy.messages.loadFailed,
      )
      setMessages([])
      setLoadedMessagesSourceId(requestedSourceId)
      setHasOlderMessages(false)
      return null
    } finally {
      if (!silent && messagesRequestIdRef.current === requestId) {
        setIsLoadingMessages(false)
      }
    }
  }

  async function loadMessageWindow(messageId: string, createdAt: string) {
    const cursor = getMessageWindowCursor(messageId, createdAt)
    if (!cursor) {
      return false
    }

    const loadedMessages = await loadMessages(false, cursor)
    return Boolean(
      loadedMessages?.some((message) => message.id === messageId),
    )
  }

  async function loadOlderMessages(): Promise<OlderMessageLoadResult> {
    const requestedSpaceId = spaceId
    const requestedServerId = selectedServerMembership.serverId
    const requestedSourceId = requestedSpaceId
      ? `${requestedServerId}:${requestedSpaceId}`
      : null

    if (
      !requestedSpaceId ||
      !requestedSourceId ||
      loadedMessagesSourceIdRef.current !== requestedSourceId ||
      isLoadingOlderMessagesRef.current
    ) {
      return 'stale'
    }

    if (!hasOlderMessagesRef.current) {
      return 'exhausted'
    }

    const cursor = getOldestMessageCursor(messagesRef.current)
    if (!cursor) {
      setHasOlderMessages(false)
      return 'exhausted'
    }

    const requestId = ++olderMessagesRequestIdRef.current
    isLoadingOlderMessagesRef.current = true
    setIsLoadingOlderMessages(true)

    try {
      const params = new URLSearchParams({
        limit: String(messageHistoryPageSize),
        beforeCreatedAt: cursor.createdAt,
        beforeId: cursor.id,
      })
      const olderMessages = await apiJson<SpaceMessageResponse[]>(
        `/api/servers/${requestedServerId}/spaces/${requestedSpaceId}/messages?${params.toString()}`,
        { accessToken },
      )

      if (
        olderMessagesRequestIdRef.current !== requestId ||
        activeMessageSourceIdRef.current !== requestedSourceId
      ) {
        return 'stale'
      }

      setMessages((current) =>
        prependOlderMessagePage(current, olderMessages),
      )
      setHasOlderMessages(hasOlderMessagePage(olderMessages))
      setMessageError(null)
      return olderMessages.length > 0 ? 'loaded' : 'exhausted'
    } catch (error) {
      if (
        olderMessagesRequestIdRef.current === requestId &&
        activeMessageSourceIdRef.current === requestedSourceId
      ) {
        setMessageError(
          error instanceof Error
            ? error.message
            : serverCopy.messages.loadFailed,
        )
      }
      return (
        olderMessagesRequestIdRef.current === requestId &&
        activeMessageSourceIdRef.current === requestedSourceId
          ? 'failed'
          : 'stale'
      )
    } finally {
      if (olderMessagesRequestIdRef.current === requestId) {
        isLoadingOlderMessagesRef.current = false
        setIsLoadingOlderMessages(false)
      }
    }
  }

  async function refreshLatestMessages(): Promise<void> {
    const requestId = ++latestMessagesRequestIdRef.current
    const requestedSpaceId = spaceId
    const requestedServerId = selectedServerMembership.serverId
    const requestedSourceId = requestedSpaceId
      ? `${requestedServerId}:${requestedSpaceId}`
      : null

    if (!requestedSpaceId || !requestedSourceId) {
      return
    }

    try {
      const params = new URLSearchParams({
        limit: String(messageHistoryPageSize),
      })
      const latestMessages = await apiJson<SpaceMessageResponse[]>(
        `/api/servers/${requestedServerId}/spaces/${requestedSpaceId}/messages?${params.toString()}`,
        { accessToken },
      )

      if (
        latestMessagesRequestIdRef.current !== requestId ||
        activeMessageSourceIdRef.current !== requestedSourceId
      ) {
        return
      }

      if (loadedMessagesSourceIdRef.current !== requestedSourceId) {
        setMessages(latestMessages)
        setLoadedMessagesSourceId(requestedSourceId)
        setHasOlderMessages(hasOlderMessagePage(latestMessages))
        setMessageError(null)
        return
      }

      setMessages((current) =>
        mergeLatestMessagePage(current, latestMessages),
      )
      setMessageError(null)
    } catch (error) {
      if (
        latestMessagesRequestIdRef.current === requestId &&
        activeMessageSourceIdRef.current === requestedSourceId
      ) {
        setMessageError(
          error instanceof Error
            ? error.message
            : serverCopy.messages.loadFailed,
        )
      }
    }
  }

  async function loadPinnedMessages(silent = false) {
    if (!spaceId) {
      setPinnedMessages([])
      return
    }

    if (!silent) {
      setIsLoadingPinnedMessages(true)
    }

    try {
      setPinnedMessages(
        await apiJson<SpaceMessageResponse[]>(
          `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/messages/pinned`,
          { accessToken },
        ),
      )
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : serverCopy.messages.loadPinnedFailed,
      )
    } finally {
      if (!silent) {
        setIsLoadingPinnedMessages(false)
      }
    }
  }

  async function sendMessage(
    body: string,
    attachments: MessageAttachmentDraft[] = [],
    replyToMessageId: string | null = null,
    mentions: SpaceMessageMentionRequest[] = [],
  ) {
    if (!canSendMessages) {
      setMessageError(serverCopy.messages.sendRestricted)
      return null
    }

    if (!spaceId || (!body.trim() && attachments.length === 0)) {
      return null
    }

    setIsSendingMessage(true)

    try {
      setMessageError(null)
      validateMessageAttachments(attachments.map((item) => item.file))
      const uploadedAssets = await uploadMessageAttachments(
        attachments.map((item) => item.file),
      )

      const request: CreateSpaceMessageRequest = {
        body: body.trim() || null,
        attachments: uploadedAssets.map((asset, index) => ({
          assetId: asset.id,
          displayName: attachments[index]?.displayName || null,
          isSpoiler: attachments[index]?.isSpoiler ?? false,
        })),
        replyToMessageId,
        mentions,
      }

      const message = await apiJson<SpaceMessageResponse>(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/messages`,
        {
          method: 'POST',
          accessToken,
          body: request,
        },
      )

      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) {
          return current
        }

        return [...current, message]
      })

      return message
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : serverCopy.messages.sendFailed,
      )
      return null
    } finally {
      setIsSendingMessage(false)
    }
  }

  async function updateMessage(messageId: string, request: UpdateSpaceMessageRequest) {
    if (!spaceId || !canSendMessages) {
      if (!canSendMessages) {
        setMessageError(serverCopy.messages.sendRestricted)
      }
      return null
    }

    try {
      setMessageError(null)
      const message = await apiJson<SpaceMessageResponse>(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/messages/${messageId}`,
        {
          method: 'PATCH',
          accessToken,
          body: request,
        },
      )

      setMessages((current) =>
        current.map((item) => (item.id === message.id ? message : item)),
      )

      return message
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : serverCopy.messages.editFailed,
      )
      return null
    }
  }

  async function deleteMessage(messageId: string) {
    if (!spaceId) {
      return false
    }

    try {
      setMessageError(null)
      await apiNoContent(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/messages/${messageId}`,
        {
          method: 'DELETE',
          accessToken,
        },
      )
      setMessages((current) =>
        current.filter((message) => message.id !== messageId),
      )
      await Promise.all([
        refreshLatestMessages(),
        loadPinnedMessages(true),
      ])
      return true
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : serverCopy.messages.deleteFailed,
      )
      return false
    }
  }

  async function pinMessage(messageId: string) {
    if (!spaceId || !canManageMessages) {
      return null
    }

    try {
      setMessageError(null)
      const message = await apiJson<SpaceMessageResponse>(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/messages/${messageId}/pin`,
        {
          method: 'POST',
          accessToken,
        },
      )
      await Promise.all([
        refreshLatestMessages(),
        loadPinnedMessages(true),
      ])
      return message
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : serverCopy.messages.pinFailed,
      )
      return null
    }
  }

  async function unpinMessage(messageId: string) {
    if (!spaceId || !canManageMessages) {
      return false
    }

    try {
      setMessageError(null)
      await apiNoContent(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/messages/${messageId}/pin`,
        {
          method: 'DELETE',
          accessToken,
        },
      )
      setPinnedMessages((current) =>
        current.filter((message) => message.id !== messageId),
      )
      return true
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : serverCopy.messages.unpinFailed,
      )
      return false
    }
  }

  async function setMessageReaction(
    messageId: string,
    emojiCode: string,
    isPresent: boolean,
  ) {
    if (!spaceId || !canSendMessages) {
      setMessageError(serverCopy.messages.sendRestricted)
      return null
    }

    try {
      setMessageError(null)
      const message = await apiJson<SpaceMessageResponse>(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/messages/${messageId}/reactions`,
        {
          method: isPresent ? 'PUT' : 'DELETE',
          accessToken,
          body: { emojiCode },
        },
      )

      setMessages((current) => replaceMessage(current, message))
      setPinnedMessages((current) =>
        current.some((item) => item.id === message.id)
          ? replaceMessage(current, message)
          : current,
      )
      return message
    } catch {
      setMessageError(serverCopy.messages.reactionFailed)
      return null
    }
  }

  const markMessagesRead = useCallback(async (throughMessageId: string) => {
    if (!spaceId) {
      return null
    }

    try {
      const readState = await apiJson<SpaceReadStateResponse>(
        `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/messages/read-state`,
        {
          method: 'PUT',
          accessToken,
          body: { throughMessageId },
        },
      )

      window.dispatchEvent(
        new CustomEvent<SpaceReadStateResponse>(
          'arcanelink:space-read-state-committed',
          {
            detail: {
              ...readState,
              serverId: selectedServerMembership.serverId,
            },
          },
        ),
      )
      return readState
    } catch {
      return null
    }
  }, [accessToken, selectedServerMembership.serverId, spaceId])

  async function uploadMessageAttachments(files: File[]) {
    const uploadedAssets: AssetResponse[] = []

    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)

      uploadedAssets.push(
        await apiJson<AssetResponse>(
          `/api/servers/${selectedServerMembership.serverId}/spaces/${spaceId}/messages/attachments`,
          {
            method: 'POST',
            accessToken,
            body: formData,
          },
        ),
      )
    }

    return uploadedAssets
  }

  useEffect(() => {
    cancelMentionCandidateRequest()
    const resetMentionCandidatesState = {
      sourceId: messageSourceId,
      value: emptyMentionCandidates,
    }
    mentionCandidatesStateRef.current = resetMentionCandidatesState
    setMentionCandidatesState(resetMentionCandidatesState)

    const focusBefore =
      focusMessage?.spaceId === spaceId
        ? {
            createdAt: new Date(
              new Date(focusMessage.createdAt).getTime() + 1,
            ).toISOString(),
            id: focusMessage.messageId,
          }
        : null

    void loadMessages(false, focusBefore)
    void loadPinnedMessages(true)

    return () => {
      cancelMentionCandidateRequest()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accessToken,
    selectedServerMembership.serverId,
    spaceId,
    focusMessage?.messageId,
    cancelMentionCandidateRequest,
  ])

  useEffect(() => {
    if (!spaceId) {
      return undefined
    }

    const activeSpaceId = spaceId
    const refreshMessages = createRealtimeRefreshCoalescer(async () => {
      await Promise.all([
        refreshLatestMessages(),
        loadPinnedMessages(true),
      ])
    })

    function reloadCurrentSpaceMessages(event: Event) {
      const payload = (event as CustomEvent<SpaceMessagesChangedPayload>).detail

      if (
        payload?.serverId?.toLowerCase() ===
          selectedServerMembership.serverId.toLowerCase() &&
        payload.spaceId?.toLowerCase() === activeSpaceId.toLowerCase()
      ) {
        refreshMessages.request()
      }
    }

    window.addEventListener(
      'arcanelink:space-messages-changed',
      reloadCurrentSpaceMessages,
    )

    return () => {
      refreshMessages.dispose()
      window.removeEventListener(
        'arcanelink:space-messages-changed',
        reloadCurrentSpaceMessages,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedServerMembership.serverId, spaceId])

  return {
    messages: visibleMessages,
    pinnedMessages,
    isLoadingMessages: isLoadingVisibleMessages,
    isLoadingOlderMessages,
    hasOlderMessages,
    isLoadingPinnedMessages,
    isSendingMessage,
    messageError,
    mentionCandidates,
    loadMentionCandidates,
    loadMessages,
    loadMessageWindow,
    loadOlderMessages,
    loadPinnedMessages,
    sendMessage,
    updateMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    setMessageReaction,
    markMessagesRead,
  }
}

function validateMessageAttachments(files: File[]) {
  if (files.length > maxAttachmentsPerMessage) {
    throw new Error(serverCopy.messages.attachCountLimit(maxAttachmentsPerMessage))
  }

  for (const file of files) {
    if (file.size > maxAttachmentUploadSizeBytes) {
      throw new Error(serverCopy.messages.attachmentTooLarge)
    }

  }
}
