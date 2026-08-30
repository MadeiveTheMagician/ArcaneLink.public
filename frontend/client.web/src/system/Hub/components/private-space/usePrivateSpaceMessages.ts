import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';

import { apiJson, apiNoContent } from '../../../../shared/api/api';
import type {
  AssetResponse,
  CreateSpaceMessageRequest,
  PrivateDeletedMessageResponse,
  PrivateMessageDeletionScope,
  SpaceMessageMentionRequest,
  SpaceMessageResponse,
  SpaceReadStateResponse,
  UpdateSpaceMessageRequest
} from '../../../../shared/types';
import type { MessageAttachmentDraft } from '../../../Server/components/messages/messageAttachmentDraft';
import { replaceMessage } from '../../../Server/components/messages/messageReactionModel';
import {
  type OlderMessageLoadResult,
  getMessageWindowCursor
} from '../../../Server/hooks/messages/messagePaginationModel';
import { communityCopy, serverCopy } from '../../../shared';
import { createRealtimeRefreshCoalescer } from '../../../shared/hooks/realtimeRefreshCoalescer';
import type { MessageFocusRequest } from '../../../shared/messages/messageFocusModel';
import { isVisiblePrivateMessage } from '../../../shared/messages/privateMessageDeletionModel';

type PrivateSpaceMessagesChangedPayload = {
  spaceId?: string | null;
  messageId?: string | null;
};

export type FocusPrivateMessageRequest = MessageFocusRequest;
const messagePageSize = 100;
const trashPageSize = 100;

export function usePrivateSpaceMessages(
  accessToken: string,
  spaceId: string | null,
  focusMessage: FocusPrivateMessageRequest | null = null
) {
  const [messages, setMessages] = useState<SpaceMessageResponse[]>([]);
  const [loadedMessagesSpaceId, setLoadedMessagesSpaceId] = useState<
    string | null
  >(null);
  const [pinnedMessages, setPinnedMessages] = useState<SpaceMessageResponse[]>(
    []
  );
  const [loadedPinnedMessagesSpaceId, setLoadedPinnedMessagesSpaceId] =
    useState<string | null>(null);
  const [deletedMessages, setDeletedMessages] = useState<
    PrivateDeletedMessageResponse[]
  >([]);
  const [loadedDeletedMessagesSpaceId, setLoadedDeletedMessagesSpaceId] =
    useState<string | null>(null);
  const [isLoadingPinnedMessages, setIsLoadingPinnedMessages] = useState(false);
  const [isLoadingDeletedMessages, setIsLoadingDeletedMessages] =
    useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingOlderDeletedMessages, setIsLoadingOlderDeletedMessages] =
    useState(false);
  const [hasOlderDeletedMessages, setHasOlderDeletedMessages] = useState(false);
  const [isClearingDeletedMessages, setIsClearingDeletedMessages] =
    useState(false);
  const [restoringMessage, setRestoringMessage] = useState<{
    spaceId: string;
    messageId: string;
  } | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const messagesRequestIdRef = useRef(0);
  const olderMessagesRequestIdRef = useRef(0);
  const pinnedMessagesRequestIdRef = useRef(0);
  const deletedMessagesRequestIdRef = useRef(0);
  const olderDeletedMessagesRequestIdRef = useRef(0);
  const activeSpaceIdRef = useRef(spaceId);
  useLayoutEffect(() => {
    activeSpaceIdRef.current = spaceId;
  }, [spaceId]);
  const visibleMessages =
    loadedMessagesSpaceId === spaceId
      ? messages.filter(isVisiblePrivateMessage)
      : [];
  const visiblePinnedMessages =
    loadedPinnedMessagesSpaceId === spaceId
      ? pinnedMessages.filter(isVisiblePrivateMessage)
      : [];
  const visibleDeletedMessages =
    loadedDeletedMessagesSpaceId === spaceId ? deletedMessages : [];
  const isLoadingVisibleMessages =
    Boolean(spaceId && loadedMessagesSpaceId !== spaceId) || isLoadingMessages;

  async function loadMessages(
    silent = false,
    before?: { createdAt: string; id: string } | null
  ): Promise<SpaceMessageResponse[] | null> {
    const requestId = ++messagesRequestIdRef.current;
    ++olderMessagesRequestIdRef.current;
    const requestedSpaceId = spaceId;

    setIsLoadingOlderMessages(false);
    if (!silent) {
      setHasOlderMessages(false);
    }

    if (!requestedSpaceId) {
      setMessages([]);
      setLoadedMessagesSpaceId(null);
      setPinnedMessages([]);
      setLoadedPinnedMessagesSpaceId(null);
      setDeletedMessages([]);
      setLoadedDeletedMessagesSpaceId(null);
      setIsLoadingMessages(false);
      setIsLoadingOlderMessages(false);
      setHasOlderMessages(false);
      setIsLoadingOlderDeletedMessages(false);
      setHasOlderDeletedMessages(false);
      setTrashError(null);
      setMessageError(null);
      return null;
    }

    if (!silent) {
      setIsLoadingMessages(true);
    }

    try {
      setMessageError(null);
      const params = new URLSearchParams({ limit: String(messagePageSize) });

      if (before) {
        params.set('beforeCreatedAt', before.createdAt);
        params.set('beforeId', before.id);
      }

      const loadedMessages = await apiJson<SpaceMessageResponse[]>(
        `/api/private-spaces/${requestedSpaceId}/messages?${params.toString()}`,
        { accessToken }
      );

      if (messagesRequestIdRef.current !== requestId) {
        return null;
      }

      setMessages((current) =>
        silent && !before
          ? mergeLatestMessagePage(current, loadedMessages)
          : loadedMessages
      );
      if (!silent || before) {
        setHasOlderMessages(loadedMessages.length === messagePageSize);
      }
      setLoadedMessagesSpaceId(requestedSpaceId);
      return loadedMessages;
    } catch {
      if (messagesRequestIdRef.current !== requestId) {
        return null;
      }

      setMessageError(communityCopy.direct.messagesLoadFailed);
      setMessages([]);
      setLoadedMessagesSpaceId(requestedSpaceId);
      return null;
    } finally {
      if (!silent && messagesRequestIdRef.current === requestId) {
        setIsLoadingMessages(false);
      }
    }
  }

  async function loadMessageWindow(messageId: string, createdAt: string) {
    const cursor = getMessageWindowCursor(messageId, createdAt);
    if (!cursor) {
      return false;
    }

    const loadedMessages = await loadMessages(false, cursor);
    return Boolean(loadedMessages?.some((message) => message.id === messageId));
  }

  async function loadOlderMessages(): Promise<OlderMessageLoadResult> {
    const requestedSpaceId = spaceId;
    const oldestMessage =
      loadedMessagesSpaceId === requestedSpaceId ? messages[0] : null;
    if (!requestedSpaceId || isLoadingOlderMessages) {
      return 'stale';
    }

    if (!hasOlderMessages) {
      return 'exhausted';
    }

    if (!oldestMessage) {
      setHasOlderMessages(false);
      return 'exhausted';
    }

    const requestId = ++olderMessagesRequestIdRef.current;
    setIsLoadingOlderMessages(true);
    try {
      setMessageError(null);
      const params = new URLSearchParams({
        limit: String(messagePageSize),
        beforeCreatedAt: oldestMessage.createdAt,
        beforeId: oldestMessage.id
      });
      const olderMessages = await apiJson<SpaceMessageResponse[]>(
        `/api/private-spaces/${requestedSpaceId}/messages?${params.toString()}`,
        { accessToken }
      );
      if (
        olderMessagesRequestIdRef.current !== requestId ||
        activeSpaceIdRef.current !== requestedSpaceId
      ) {
        return 'stale';
      }

      setMessages((current) => mergeMessagePages(olderMessages, current));
      setHasOlderMessages(olderMessages.length === messagePageSize);
      return olderMessages.length > 0 ? 'loaded' : 'exhausted';
    } catch {
      if (
        olderMessagesRequestIdRef.current === requestId &&
        activeSpaceIdRef.current === requestedSpaceId
      ) {
        setMessageError(communityCopy.direct.messagesLoadFailed);
      }
      return olderMessagesRequestIdRef.current === requestId &&
        activeSpaceIdRef.current === requestedSpaceId
        ? 'failed'
        : 'stale';
    } finally {
      if (olderMessagesRequestIdRef.current === requestId) {
        setIsLoadingOlderMessages(false);
      }
    }
  }

  async function loadPinnedMessages(silent = false) {
    const requestId = ++pinnedMessagesRequestIdRef.current;
    const requestedSpaceId = spaceId;

    if (!requestedSpaceId) {
      setPinnedMessages([]);
      setLoadedPinnedMessagesSpaceId(null);
      setIsLoadingPinnedMessages(false);
      return;
    }

    if (!silent) {
      setIsLoadingPinnedMessages(true);
    }

    try {
      const loadedPinnedMessages = await apiJson<SpaceMessageResponse[]>(
        `/api/private-spaces/${requestedSpaceId}/messages/pinned`,
        { accessToken }
      );
      if (pinnedMessagesRequestIdRef.current !== requestId) {
        return;
      }

      setPinnedMessages(loadedPinnedMessages);
      setLoadedPinnedMessagesSpaceId(requestedSpaceId);
    } catch {
      if (pinnedMessagesRequestIdRef.current !== requestId) {
        return;
      }

      setMessageError(communityCopy.direct.pinnedMessagesLoadFailed);
      setPinnedMessages([]);
      setLoadedPinnedMessagesSpaceId(requestedSpaceId);
    } finally {
      if (!silent && pinnedMessagesRequestIdRef.current === requestId) {
        setIsLoadingPinnedMessages(false);
      }
    }
  }

  async function loadDeletedMessages(
    silent = false,
    before?: { deletedAt: string; id: string } | null,
    append = false
  ) {
    const requestId = ++deletedMessagesRequestIdRef.current;
    const requestedSpaceId = spaceId;

    if (!requestedSpaceId) {
      setDeletedMessages([]);
      setLoadedDeletedMessagesSpaceId(null);
      setIsLoadingDeletedMessages(false);
      setIsLoadingOlderDeletedMessages(false);
      setHasOlderDeletedMessages(false);
      setTrashError(null);
      return false;
    }

    if (!silent) {
      setIsLoadingDeletedMessages(true);
    }

    try {
      setTrashError(null);
      const params = new URLSearchParams({ limit: String(trashPageSize) });
      if (before) {
        params.set('beforeDeletedAt', before.deletedAt);
        params.set('beforeId', before.id);
      }
      const loadedDeletedMessages = await apiJson<
        PrivateDeletedMessageResponse[]
      >(
        `/api/private-spaces/${requestedSpaceId}/messages/trash?${params.toString()}`,
        {
          accessToken
        }
      );

      if (deletedMessagesRequestIdRef.current !== requestId) {
        return false;
      }

      setDeletedMessages((current) =>
        append
          ? mergeDeletedMessagePages(current, loadedDeletedMessages)
          : loadedDeletedMessages
      );
      setHasOlderDeletedMessages(
        loadedDeletedMessages.length === trashPageSize
      );
      setLoadedDeletedMessagesSpaceId(requestedSpaceId);
      return true;
    } catch {
      if (deletedMessagesRequestIdRef.current !== requestId) {
        return false;
      }

      setTrashError(communityCopy.direct.trashLoadFailed);
      setDeletedMessages([]);
      setLoadedDeletedMessagesSpaceId(requestedSpaceId);
      return false;
    } finally {
      if (!silent && deletedMessagesRequestIdRef.current === requestId) {
        setIsLoadingDeletedMessages(false);
      }
    }
  }

  async function loadOlderDeletedMessages() {
    const requestedSpaceId = spaceId;
    const oldestDeletion =
      loadedDeletedMessagesSpaceId === requestedSpaceId
        ? deletedMessages.at(-1)
        : null;
    if (
      !requestedSpaceId ||
      !oldestDeletion ||
      !hasOlderDeletedMessages ||
      isLoadingOlderDeletedMessages
    ) {
      return false;
    }

    const requestId = ++olderDeletedMessagesRequestIdRef.current;
    setIsLoadingOlderDeletedMessages(true);
    try {
      const didLoad = await loadDeletedMessages(
        true,
        {
          deletedAt: oldestDeletion.deletedAt,
          id: oldestDeletion.message.id
        },
        true
      );
      return (
        didLoad &&
        olderDeletedMessagesRequestIdRef.current === requestId &&
        activeSpaceIdRef.current === requestedSpaceId
      );
    } finally {
      if (olderDeletedMessagesRequestIdRef.current === requestId) {
        setIsLoadingOlderDeletedMessages(false);
      }
    }
  }

  async function clearDeletedMessages() {
    const requestedSpaceId = spaceId;
    if (!requestedSpaceId || isClearingDeletedMessages) {
      return false;
    }

    setIsClearingDeletedMessages(true);
    try {
      setTrashError(null);
      await apiNoContent(
        `/api/private-spaces/${requestedSpaceId}/messages/trash`,
        { method: 'DELETE', accessToken }
      );
      if (activeSpaceIdRef.current === requestedSpaceId) {
        setDeletedMessages([]);
        setHasOlderDeletedMessages(false);
        await loadMessages(true);
      }
      return true;
    } catch {
      if (activeSpaceIdRef.current === requestedSpaceId) {
        setTrashError(communityCopy.direct.trashClearFailed);
      }
      return false;
    } finally {
      setIsClearingDeletedMessages(false);
    }
  }

  async function sendMessage(
    body: string,
    attachments: MessageAttachmentDraft[] = [],
    replyToMessageId: string | null = null,
    mentions: SpaceMessageMentionRequest[] = []
  ) {
    if (!spaceId || (!body.trim() && attachments.length === 0)) {
      return null;
    }

    setIsSendingMessage(true);

    try {
      setMessageError(null);
      const uploadedAssets = await uploadMessageAttachments(
        attachments.map((item) => item.file)
      );
      const request: CreateSpaceMessageRequest = {
        body: body.trim() || null,
        attachments: uploadedAssets.map((asset, index) => ({
          assetId: asset.id,
          displayName: attachments[index]?.displayName || null,
          isSpoiler: attachments[index]?.isSpoiler ?? false
        })),
        replyToMessageId,
        mentions
      };
      const message = await apiJson<SpaceMessageResponse>(
        `/api/private-spaces/${spaceId}/messages`,
        {
          method: 'POST',
          accessToken,
          body: request
        }
      );

      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message]
      );

      return message;
    } catch {
      setMessageError(communityCopy.direct.messageSendFailed);
      return null;
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function updateMessage(
    messageId: string,
    request: UpdateSpaceMessageRequest
  ) {
    if (!spaceId) {
      return null;
    }

    try {
      setMessageError(null);
      const message = await apiJson<SpaceMessageResponse>(
        `/api/private-spaces/${spaceId}/messages/${messageId}`,
        {
          method: 'PATCH',
          accessToken,
          body: request
        }
      );

      setMessages((current) =>
        current.map((item) => (item.id === message.id ? message : item))
      );

      return message;
    } catch {
      setMessageError(communityCopy.direct.messageUpdateFailed);
      return null;
    }
  }

  async function deleteMessage(
    messageId: string,
    scope: PrivateMessageDeletionScope = 'everyone'
  ) {
    const requestedSpaceId = spaceId;
    if (!requestedSpaceId) {
      return false;
    }

    try {
      setMessageError(null);
      await apiNoContent(
        `/api/private-spaces/${requestedSpaceId}/messages/${messageId}?scope=${scope}`,
        {
          method: 'DELETE',
          accessToken
        }
      );
      if (activeSpaceIdRef.current !== requestedSpaceId) {
        return true;
      }

      setMessages((current) => current.filter((item) => item.id !== messageId));
      setPinnedMessages((current) =>
        current.filter((item) => item.id !== messageId)
      );
      await Promise.all([
        loadMessages(true),
        loadPinnedMessages(true),
        loadDeletedMessages(true)
      ]);
      return true;
    } catch {
      if (activeSpaceIdRef.current !== requestedSpaceId) {
        return false;
      }

      setMessageError(communityCopy.direct.messageDeleteFailed);
      return false;
    }
  }

  async function restoreMessage(messageId: string) {
    const requestedSpaceId = spaceId;
    if (!requestedSpaceId || restoringMessage?.spaceId === requestedSpaceId) {
      return false;
    }

    setRestoringMessage({ spaceId: requestedSpaceId, messageId });

    try {
      setTrashError(null);
      await apiNoContent(
        `/api/private-spaces/${requestedSpaceId}/messages/${messageId}/restore`,
        {
          method: 'POST',
          accessToken
        }
      );
      if (activeSpaceIdRef.current !== requestedSpaceId) {
        return true;
      }

      await Promise.all([
        loadMessages(true),
        loadPinnedMessages(true),
        loadDeletedMessages(true)
      ]);
      return true;
    } catch {
      if (activeSpaceIdRef.current !== requestedSpaceId) {
        return false;
      }

      setTrashError(communityCopy.direct.restoreFailed);
      return false;
    } finally {
      setRestoringMessage((current) =>
        current?.spaceId === requestedSpaceId ? null : current
      );
    }
  }

  async function pinMessage(messageId: string) {
    const requestedSpaceId = spaceId;
    if (!requestedSpaceId) {
      return null;
    }

    try {
      setMessageError(null);
      const message = await apiJson<SpaceMessageResponse>(
        `/api/private-spaces/${requestedSpaceId}/messages/${messageId}/pin`,
        {
          method: 'POST',
          accessToken
        }
      );
      if (activeSpaceIdRef.current !== requestedSpaceId) {
        return message;
      }

      await Promise.all([loadMessages(true), loadPinnedMessages(true)]);
      return message;
    } catch {
      if (activeSpaceIdRef.current !== requestedSpaceId) {
        return null;
      }

      setMessageError(communityCopy.direct.messagePinFailed);
      return null;
    }
  }

  async function unpinMessage(messageId: string) {
    const requestedSpaceId = spaceId;
    if (!requestedSpaceId) {
      return false;
    }

    try {
      setMessageError(null);
      await apiNoContent(
        `/api/private-spaces/${requestedSpaceId}/messages/${messageId}/pin`,
        {
          method: 'DELETE',
          accessToken
        }
      );
      if (activeSpaceIdRef.current === requestedSpaceId) {
        setPinnedMessages((current) =>
          current.filter((message) => message.id !== messageId)
        );
      }
      return true;
    } catch {
      if (activeSpaceIdRef.current === requestedSpaceId) {
        setMessageError(communityCopy.direct.messageUnpinFailed);
      }
      return false;
    }
  }

  async function setMessageReaction(
    messageId: string,
    emojiCode: string,
    isPresent: boolean
  ) {
    if (!spaceId) {
      return null;
    }

    try {
      setMessageError(null);
      const message = await apiJson<SpaceMessageResponse>(
        `/api/private-spaces/${spaceId}/messages/${messageId}/reactions`,
        {
          method: isPresent ? 'PUT' : 'DELETE',
          accessToken,
          body: { emojiCode }
        }
      );

      setMessages((current) => replaceMessage(current, message));
      setPinnedMessages((current) =>
        current.some((item) => item.id === message.id)
          ? replaceMessage(current, message)
          : current
      );
      return message;
    } catch {
      setMessageError(serverCopy.messages.reactionFailed);
      return null;
    }
  }

  const markMessagesRead = useCallback(
    async (throughMessageId: string) => {
      if (!spaceId) {
        return null;
      }

      try {
        const readState = await apiJson<SpaceReadStateResponse>(
          `/api/private-spaces/${spaceId}/messages/read-state`,
          {
            method: 'PUT',
            accessToken,
            body: { throughMessageId }
          }
        );

        window.dispatchEvent(
          new CustomEvent<SpaceReadStateResponse>(
            'arcanelink:space-read-state-committed',
            {
              detail: {
                ...readState,
                serverId: null
              }
            }
          )
        );
        return readState;
      } catch {
        return null;
      }
    },
    [accessToken, spaceId]
  );

  async function uploadMessageAttachments(files: File[]) {
    const uploadedAssets: AssetResponse[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      uploadedAssets.push(
        await apiJson<AssetResponse>(
          `/api/private-spaces/${spaceId}/messages/attachments`,
          {
            method: 'POST',
            accessToken,
            body: formData
          }
        )
      );
    }

    return uploadedAssets;
  }

  useEffect(() => {
    const focusBefore =
      focusMessage?.spaceId === spaceId
        ? {
            createdAt: new Date(
              new Date(focusMessage.createdAt).getTime() + 1
            ).toISOString(),
            id: focusMessage.messageId
          }
        : null;

    void loadMessages(false, focusBefore);
    void loadPinnedMessages(true);
    void loadDeletedMessages(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, spaceId, focusMessage?.messageId]);

  useEffect(() => {
    if (!spaceId) {
      return undefined;
    }

    const activeSpaceId = spaceId;
    const refreshMessages = createRealtimeRefreshCoalescer(async () => {
      await Promise.all([
        loadMessages(true),
        loadPinnedMessages(true),
        loadDeletedMessages(true)
      ]);
    });

    function reloadCurrentSpaceMessages(event: Event) {
      const payload = (event as CustomEvent<PrivateSpaceMessagesChangedPayload>)
        .detail;

      if (payload?.spaceId?.toLowerCase() === activeSpaceId.toLowerCase()) {
        refreshMessages.request();
      }
    }

    window.addEventListener(
      'arcanelink:private-space-messages-changed',
      reloadCurrentSpaceMessages
    );

    return () => {
      refreshMessages.dispose();
      window.removeEventListener(
        'arcanelink:private-space-messages-changed',
        reloadCurrentSpaceMessages
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, spaceId]);

  return {
    messages: visibleMessages,
    pinnedMessages: visiblePinnedMessages,
    deletedMessages: visibleDeletedMessages,
    isLoadingMessages: isLoadingVisibleMessages,
    isLoadingOlderMessages,
    hasOlderMessages,
    isLoadingPinnedMessages:
      Boolean(spaceId && loadedPinnedMessagesSpaceId !== spaceId) ||
      isLoadingPinnedMessages,
    isLoadingDeletedMessages:
      Boolean(spaceId && loadedDeletedMessagesSpaceId !== spaceId) ||
      isLoadingDeletedMessages,
    isLoadingOlderDeletedMessages,
    hasOlderDeletedMessages,
    isClearingDeletedMessages,
    restoringMessageId:
      restoringMessage?.spaceId === spaceId ? restoringMessage.messageId : null,
    isSendingMessage,
    messageError,
    trashError,
    loadMessages,
    loadMessageWindow,
    loadOlderMessages,
    loadPinnedMessages,
    loadDeletedMessages,
    loadOlderDeletedMessages,
    clearDeletedMessages,
    sendMessage,
    updateMessage,
    deleteMessage,
    restoreMessage,
    pinMessage,
    unpinMessage,
    setMessageReaction,
    markMessagesRead
  };
}

function mergeMessagePages(
  ...pages: SpaceMessageResponse[][]
): SpaceMessageResponse[] {
  const byId = new Map<string, SpaceMessageResponse>();
  pages.flat().forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort(compareMessages);
}

function mergeLatestMessagePage(
  current: SpaceMessageResponse[],
  latest: SpaceMessageResponse[]
) {
  if (latest.length === 0) {
    return [];
  }

  const oldestLatest = latest[0];
  const older = current.filter(
    (message) => compareMessages(message, oldestLatest) < 0
  );
  return mergeMessagePages(older, latest);
}

function compareMessages(
  left: SpaceMessageResponse,
  right: SpaceMessageResponse
) {
  const createdAtDifference =
    Date.parse(left.createdAt) - Date.parse(right.createdAt);
  return createdAtDifference || left.id.localeCompare(right.id);
}

function mergeDeletedMessagePages(...pages: PrivateDeletedMessageResponse[][]) {
  const byIdAndScope = new Map<string, PrivateDeletedMessageResponse>();
  pages
    .flat()
    .forEach((deletion) =>
      byIdAndScope.set(`${deletion.message.id}:${deletion.scope}`, deletion)
    );
  return [...byIdAndScope.values()].sort((left, right) => {
    const deletedAtDifference =
      Date.parse(right.deletedAt) - Date.parse(left.deletedAt);
    return (
      deletedAtDifference || right.message.id.localeCompare(left.message.id)
    );
  });
}
