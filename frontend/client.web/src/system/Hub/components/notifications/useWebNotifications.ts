import { useCallback, useEffect, useRef, useState } from 'react'
import { apiJson, apiNoContent } from '../../../../shared/api/api'
import type {
  ServerInviteResponse,
  SpaceMessageResponse,
  UserNotificationResponse,
} from '../../../../shared/types'
import type {
  RealtimePrivateMessagePayload,
  RealtimeServerInvitePayload,
  RealtimeSystemNotificationPayload,
  WebNotificationItem,
} from './webNotificationModel'
import {
  mapStoredWebNotification,
  trimWebNotificationQueue,
  webNotificationPriority,
} from './webNotificationModel'
import { useNotificationPreferences } from './notificationPreferences'
import { WebNotificationTimerScheduler } from './webNotificationTimerScheduler'
import { notificationCopy } from '../../../shared/copy'

const notificationLifetimeMs = 9000
const notificationCloseAnimationMs = 220
const maxVisibleNotifications = 4

type UseWebNotificationsOptions = {
  accessToken: string
  currentUserId: string
  activePrivateSpaceId: string | null
}

export function useWebNotifications({
  accessToken,
  currentUserId,
  activePrivateSpaceId,
}: UseWebNotificationsOptions) {
  const { preferences } = useNotificationPreferences(currentUserId)
  const [notifications, setNotifications] = useState<WebNotificationItem[]>([])
  const [closingNotificationIds, setClosingNotificationIds] = useState<
    Set<string>
  >(() => new Set())
  const notificationsRef = useRef<WebNotificationItem[]>([])
  const activePrivateSpaceIdRef = useRef(activePrivateSpaceId)
  const preferencesRef = useRef(preferences)
  const shownIdsRef = useRef(new Set<string>())
  const closeTimersRef = useRef(new Map<string, number>())
  const timerSchedulerRef = useRef<WebNotificationTimerScheduler | null>(null)
  if (timerSchedulerRef.current === null) {
    timerSchedulerRef.current = new WebNotificationTimerScheduler(
      {
        set: (callback, delayMs) => window.setTimeout(callback, delayMs),
        clear: (handle) => window.clearTimeout(handle as number),
      },
      notificationLifetimeMs,
    )
  }

  useEffect(() => {
    activePrivateSpaceIdRef.current = activePrivateSpaceId
  }, [activePrivateSpaceId])

  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  const removeNotification = useCallback((id: string) => {
    timerSchedulerRef.current?.untrack(id)
    const closeTimer = closeTimersRef.current.get(id)
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer)
      closeTimersRef.current.delete(id)
    }

    const nextNotifications = notificationsRef.current.filter(
      (item) => item.id !== id,
    )
    notificationsRef.current = nextNotifications
    setNotifications(nextNotifications)
    setClosingNotificationIds((current) => {
      if (!current.has(id)) {
        return current
      }

      const next = new Set(current)
      next.delete(id)
      return next
    })
  }, [])

  const dismissNotification = useCallback((id: string) => {
    timerSchedulerRef.current?.untrack(id)
    const existingCloseTimer = closeTimersRef.current.get(id)
    if (existingCloseTimer !== undefined) {
      window.clearTimeout(existingCloseTimer)
    }

    setClosingNotificationIds((current) => {
      if (current.has(id)) {
        return current
      }

      const next = new Set(current)
      next.add(id)
      return next
    })
    const closeTimer = window.setTimeout(
      () => removeNotification(id),
      notificationCloseAnimationMs,
    )
    closeTimersRef.current.set(id, closeTimer)
  }, [removeNotification])

  const addNotification = useCallback((notification: WebNotificationItem) => {
    if (shownIdsRef.current.has(notification.id)) {
      return
    }

    shownIdsRef.current.add(notification.id)
    const collision = notification.messageId
      ? notificationsRef.current.find(
          (item) =>
            item.messageId?.toLowerCase() ===
            notification.messageId?.toLowerCase(),
        )
      : undefined
    if (collision) {
      if (
        webNotificationPriority(notification.kind) <=
        webNotificationPriority(collision.kind)
      ) {
        return
      }

      timerSchedulerRef.current?.untrack(collision.id)
      const collisionCloseTimer = closeTimersRef.current.get(collision.id)
      if (collisionCloseTimer !== undefined) {
        window.clearTimeout(collisionCloseTimer)
        closeTimersRef.current.delete(collision.id)
      }
    }

    const queuedNotifications = collision
      ? notificationsRef.current.map((item) =>
          item.id === collision.id ? notification : item,
        )
      : [...notificationsRef.current, notification]
    const { items: nextNotifications, evicted } =
      trimWebNotificationQueue(
        queuedNotifications,
        notification.id,
        maxVisibleNotifications,
      )
    if (evicted) {
      timerSchedulerRef.current?.untrack(evicted.id)
      const evictedCloseTimer = closeTimersRef.current.get(evicted.id)
      if (evictedCloseTimer !== undefined) {
        window.clearTimeout(evictedCloseTimer)
        closeTimersRef.current.delete(evicted.id)
      }
    }
    notificationsRef.current = nextNotifications
    setNotifications(nextNotifications)

    timerSchedulerRef.current?.track(
      notification.id,
      Boolean(notification.persistent),
      () => dismissNotification(notification.id),
    )
    timerSchedulerRef.current?.retain(
      new Set(nextNotifications.map((item) => item.id)),
    )
  }, [dismissNotification])

  const pauseNotifications = useCallback(() => {
    timerSchedulerRef.current?.pause()
  }, [])

  const resumeNotifications = useCallback(() => {
    timerSchedulerRef.current?.resume()
  }, [])

  const markStoredNotificationRead = useCallback(
    async (notificationId: string) => {
      try {
        await apiNoContent(`/api/notifications/${notificationId}/read`, {
          accessToken,
          method: 'POST',
        })
      } catch {
        // Keep navigation responsive. The unread record remains available in
        // the notification center if the acknowledgement cannot be persisted.
      }
    },
    [accessToken],
  )

  useEffect(
    () => () => {
      timerSchedulerRef.current?.dispose()
      for (const timer of closeTimersRef.current.values()) {
        window.clearTimeout(timer)
      }
      closeTimersRef.current.clear()
    },
    [],
  )

  useEffect(() => {
    async function handlePrivateMessage(event: Event) {
      if (!preferences.enabled || !preferences.privateMessages) {
        return
      }
      const payload = (
        event as CustomEvent<RealtimePrivateMessagePayload>
      ).detail
      const spaceId = payload?.spaceId
      const messageId = payload?.messageId

      if (
        !spaceId ||
        !messageId ||
        activePrivateSpaceIdRef.current?.toLowerCase() === spaceId.toLowerCase()
      ) {
        return
      }

      try {
        const messages = await apiJson<SpaceMessageResponse[]>(
          `/api/private-spaces/${spaceId}/messages?limit=50`,
          { accessToken },
        )
        const message = messages.find(
          (item) => item.id.toLowerCase() === messageId.toLowerCase(),
        )

        if (
          !message ||
          message.senderUserId.toLowerCase() === currentUserId.toLowerCase() ||
          message.deletedAt
        ) {
          return
        }

        addNotification({
          id: `private-message:${message.id}`,
          kind: 'private-message',
          title: notificationCopy.popup.privateMessageTitle,
          body: message.senderDisplayName,
          detail: getMessagePreview(message),
          createdAt: message.createdAt,
          spaceId,
          messageId: message.id,
          senderAvatarAssetId: message.senderAvatarAssetId,
          senderAvatarCropOffsetX: message.senderAvatarCropOffsetX,
          senderAvatarCropOffsetY: message.senderAvatarCropOffsetY,
          senderAvatarCropZoom: message.senderAvatarCropZoom,
        })
      } catch {
        // Realtime refresh remains functional even if a notification preview fails.
      }
    }

    async function handleServerInvite(event: Event) {
      if (!preferences.enabled || !preferences.serverInvites) {
        return
      }
      const payload = (
        event as CustomEvent<RealtimeServerInvitePayload>
      ).detail
      const inviteId = payload?.inviteId

      if (!inviteId) {
        return
      }

      try {
        const invites = await apiJson<ServerInviteResponse[]>(
          '/api/server-invites/me',
          { accessToken },
        )
        const invite = invites.find(
          (item) => item.id.toLowerCase() === inviteId.toLowerCase(),
        )

        if (!invite) {
          dismissNotification(`server-invite:${inviteId}`)
          return
        }

        addNotification({
          id: `server-invite:${invite.id}`,
          kind: 'server-invite',
          title: notificationCopy.invite.title,
          body: invite.serverTitle ?? notificationCopy.brandFallback,
          detail: null,
          createdAt: invite.createdAt,
          inviteId: invite.id,
          persistent: true,
          serverIconAssetId: invite.serverIconAssetId,
          serverIconCropOffsetX: invite.serverIconCropOffsetX,
          serverIconCropOffsetY: invite.serverIconCropOffsetY,
          serverIconCropZoom: invite.serverIconCropZoom,
          serverDescription: invite.serverDescription,
          memberCount: invite.memberCount,
          onlineCount: invite.onlineCount,
        })
      } catch {
        // The invitation remains available in the invitations workspace.
      }
    }

    function handleSystemNotification(event: Event) {
      const payload = (
        event as CustomEvent<RealtimeSystemNotificationPayload>
      ).detail

      if (!payload?.id || !payload.title || !payload.body) {
        return
      }
      if (
        !payload.force &&
        (!preferences.enabled || !preferences.system)
      ) {
        return
      }

      addNotification({
        id: `system:${payload.id}`,
        kind: 'system',
        title: payload.title,
        body: payload.body,
        createdAt: new Date().toISOString(),
      })
    }

    window.addEventListener(
      'arcanelink:private-message-received',
      handlePrivateMessage,
    )
    window.addEventListener(
      'arcanelink:server-invite-received',
      handleServerInvite,
    )
    window.addEventListener(
      'arcanelink:system-notification',
      handleSystemNotification,
    )

    return () => {
      window.removeEventListener(
        'arcanelink:private-message-received',
        handlePrivateMessage,
      )
      window.removeEventListener(
        'arcanelink:server-invite-received',
        handleServerInvite,
      )
      window.removeEventListener(
        'arcanelink:system-notification',
        handleSystemNotification,
      )
    }
  }, [
    accessToken,
    addNotification,
    currentUserId,
    dismissNotification,
    preferences.enabled,
    preferences.privateMessages,
    preferences.serverInvites,
    preferences.system,
  ])

  useEffect(() => {
    let disposed = false
    let initialized = false
    let refreshInFlight = false
    let queuedSurfaceNew = false
    let eventArrivedDuringInitialization = false
    const mountedAt = Date.now()
    const knownNotificationIds = new Set<string>()

    async function refreshStoredNotifications(surfaceNew: boolean) {
      if (refreshInFlight) {
        queuedSurfaceNew ||= surfaceNew
        return
      }

      refreshInFlight = true
      try {
        const stored = await apiJson<UserNotificationResponse[]>(
          '/api/notifications',
          { accessToken },
        )
        if (disposed) {
          return
        }

        const wasInitialized = initialized
        const shouldSurface =
          surfaceNew ||
          (!wasInitialized && eventArrivedDuringInitialization)
        for (const item of [...stored].reverse()) {
          const normalizedId = item.id.toLowerCase()
          if (knownNotificationIds.has(normalizedId)) {
            continue
          }

          knownNotificationIds.add(normalizedId)
          if (
            !shouldSurface ||
            (!wasInitialized &&
              new Date(item.createdAt).getTime() < mountedAt - 1000)
          ) {
            continue
          }

          const notification = mapStoredWebNotification(item)
          if (!notification) {
            continue
          }

          const currentPreferences = preferencesRef.current
          if (
            !currentPreferences.enabled ||
            (notification.kind === 'mention' &&
              !currentPreferences.mentions) ||
            (notification.kind === 'private-space-invite' &&
              !currentPreferences.privateSpaceInvites)
          ) {
            continue
          }

          if (
            notification.spaceId &&
            !notification.serverId &&
            activePrivateSpaceIdRef.current?.toLowerCase() ===
              notification.spaceId.toLowerCase()
          ) {
            continue
          }

          addNotification(notification)
        }
        initialized = true
      } catch {
        // The notification center remains the durable fallback.
      } finally {
        refreshInFlight = false
        if (queuedSurfaceNew && !disposed) {
          queuedSurfaceNew = false
          void refreshStoredNotifications(true)
        }
      }
    }

    function handleStoredNotificationsChanged() {
      if (!initialized) {
        eventArrivedDuringInitialization = true
      }
      void refreshStoredNotifications(true)
    }

    void refreshStoredNotifications(false)
    window.addEventListener(
      'arcanelink:user-notifications-changed',
      handleStoredNotificationsChanged,
    )

    return () => {
      disposed = true
      window.removeEventListener(
        'arcanelink:user-notifications-changed',
        handleStoredNotificationsChanged,
      )
    }
  }, [accessToken, addNotification, currentUserId])

  return {
    notifications,
    closingNotificationIds,
    dismissNotification,
    markStoredNotificationRead,
    placement: preferences.placement,
    pauseNotifications,
    resumeNotifications,
  }
}

function getMessagePreview(message: SpaceMessageResponse) {
  const body = message.body?.trim()
  if (body) {
    return body.length > 96 ? `${body.slice(0, 93)}...` : body
  }

  if (message.assets.length > 0) {
    return message.assets.length === 1
      ? notificationCopy.popup.attachment
      : notificationCopy.popup.attachments(message.assets.length)
  }

  return notificationCopy.popup.privateSpaceFallback
}
