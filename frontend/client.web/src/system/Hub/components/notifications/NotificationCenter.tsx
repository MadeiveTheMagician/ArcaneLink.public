import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiJson, apiNoContent } from '../../../../shared/api/api'
import type {
  ServerInviteResponse,
  UserNotificationResponse,
} from '../../../../shared/types'
import { SystemIcon } from '../../../shared/icons/SystemIcon'
import { notificationCopy } from '../../../shared/copy'
import {
  SystemTabPanel,
  SystemTabs,
  useSystemSkeletonPresence,
} from '../../../shared'
import { useNotificationPreferences } from './notificationPreferences'
import {
  applyAllNotificationsRead,
  applyNotificationRead,
  clearReadNotificationHistory,
  rollbackAllNotificationsRead,
  rollbackNotificationRead,
  type NotificationReadRollback,
} from './notificationCenterModel'
import { NotificationListSkeleton } from './NotificationListSkeleton'
import {
  resolveNotificationTarget,
  type NotificationTarget,
} from './notificationNavigation'
import styles from './NotificationCenter.module.css'

type NotificationFilter = 'all' | 'unread' | 'mention' | 'invite' | 'system'

type NotificationCenterProps = {
  accessToken: string
  currentUserId: string
  directServerInvites: ServerInviteResponse[]
  onAcceptDirectServerInvite: (inviteId: string) => void
  onDeclineDirectServerInvite: (inviteId: string) => void
  onOpenTarget: (target: NotificationTarget) => void
}

const filters: { id: NotificationFilter; label: string }[] = [
  { id: 'all', label: notificationCopy.center.filters.all },
  { id: 'unread', label: notificationCopy.center.filters.unread },
  { id: 'mention', label: notificationCopy.center.filters.mention },
  { id: 'invite', label: notificationCopy.center.filters.invite },
  { id: 'system', label: notificationCopy.center.filters.system },
]

export function NotificationCenter({
  accessToken,
  currentUserId,
  directServerInvites,
  onAcceptDirectServerInvite,
  onDeclineDirectServerInvite,
  onOpenTarget,
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<UserNotificationResponse[]>(
    [],
  )
  const [activeFilter, setActiveFilter] =
    useState<NotificationFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const loadRequestIdRef = useRef(0)
  const pendingReadIdsRef = useRef(new Set<string>())
  const { preferences, updatePreferences } =
    useNotificationPreferences(currentUserId)

  const loadNotifications = useCallback(async (showLoading = false) => {
    const requestId = ++loadRequestIdRef.current
    if (showLoading) {
      setIsLoading(true)
    }
    setLoadError(null)

    try {
      const response = await apiJson<UserNotificationResponse[]>(
        '/api/notifications',
        { accessToken },
      )
      if (loadRequestIdRef.current === requestId) {
        setNotifications(response)
      }
    } catch {
      if (loadRequestIdRef.current === requestId) {
        setLoadError(notificationCopy.center.loadError)
      }
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setIsLoading(false)
      }
    }
  }, [accessToken])

  useEffect(() => {
    void loadNotifications(true)

    function handleChanged() {
      void loadNotifications()
    }

    window.addEventListener(
      'arcanelink:user-notifications-changed',
      handleChanged,
    )
    return () => {
      loadRequestIdRef.current += 1
      window.removeEventListener(
        'arcanelink:user-notifications-changed',
        handleChanged,
      )
    }
  }, [loadNotifications])

  const items = useMemo(
    () => mergeActiveInvites(notifications, directServerInvites),
    [directServerInvites, notifications],
  )
  const counts = useMemo(
    () => ({
      all: items.length,
      unread: items.filter((item) => !item.readAt).length,
      mention: items.filter((item) => item.kind === 'mention').length,
      invite: items.filter((item) => isInviteKind(item.kind)).length,
      system: items.filter((item) => item.kind === 'system').length,
    }),
    [items],
  )
  const visibleItems = useMemo(() => {
    const query = searchQuery
      .trim()
      .toLocaleLowerCase(notificationCopy.locale)
    return items.filter((item) => {
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'unread' && !item.readAt) ||
        item.kind === activeFilter ||
        (activeFilter === 'invite' && isInviteKind(item.kind))
      const matchesSearch =
        !query ||
        `${item.title} ${item.body} ${item.detail ?? ''} ${
          item.actorDisplayName ?? ''
        } ${item.serverTitle ?? ''}`
          .toLocaleLowerCase(notificationCopy.locale)
          .includes(query)
      return matchesFilter && matchesSearch
    })
  }, [activeFilter, items, searchQuery])
  const hasUnreadStoredNotifications = notifications.some(
    (item) => !item.readAt,
  )
  const hasReadStoredNotifications = notifications.some((item) => item.readAt)
  const isInitialLoading = isLoading && items.length === 0
  const initialLoadingSkeleton =
    useSystemSkeletonPresence(isInitialLoading)

  async function markRead(item: UserNotificationResponse) {
    if (
      item.id.startsWith('active-invite:') ||
      item.readAt ||
      pendingReadIdsRef.current.has(item.id) ||
      isMarkingAllRead ||
      isClearingHistory
    ) {
      return
    }

    const readAt = new Date().toISOString()
    const rollback: NotificationReadRollback = {
      id: item.id,
      previousReadAt: item.readAt,
      optimisticReadAt: readAt,
    }

    setMutationError(null)
    setNotifications(
      (current) =>
        applyNotificationRead(current, item.id, readAt).notifications,
    )
    pendingReadIdsRef.current.add(item.id)
    setPendingReadIds(new Set(pendingReadIdsRef.current))

    try {
      await apiNoContent(`/api/notifications/${item.id}/read`, {
        accessToken,
        method: 'POST',
      })
    } catch {
      setNotifications((current) =>
        rollbackNotificationRead(current, rollback),
      )
      setMutationError(notificationCopy.center.updateError)
    } finally {
      pendingReadIdsRef.current.delete(item.id)
      setPendingReadIds(new Set(pendingReadIdsRef.current))
    }
  }

  async function markAllRead() {
    if (
      isMarkingAllRead ||
      isClearingHistory ||
      pendingReadIdsRef.current.size > 0 ||
      !hasUnreadStoredNotifications
    ) {
      return
    }

    const readAt = new Date().toISOString()
    const optimistic = applyAllNotificationsRead(notifications, readAt)
    setMutationError(null)
    setIsMarkingAllRead(true)
    setNotifications(optimistic.notifications)

    try {
      await apiNoContent('/api/notifications/read-all', {
        accessToken,
        method: 'POST',
      })
    } catch {
      setNotifications((current) =>
        rollbackAllNotificationsRead(current, optimistic.rollbacks),
      )
      setMutationError(notificationCopy.center.updateError)
    } finally {
      setIsMarkingAllRead(false)
    }
  }

  async function clearHistory() {
    if (
      isClearingHistory ||
      isMarkingAllRead ||
      pendingReadIdsRef.current.size > 0 ||
      !hasReadStoredNotifications ||
      !window.confirm(notificationCopy.center.clearHistoryConfirmation)
    ) {
      return
    }

    setMutationError(null)
    setIsClearingHistory(true)

    try {
      await apiNoContent('/api/notifications/history', {
        accessToken,
        method: 'DELETE',
      })
      setNotifications(clearReadNotificationHistory)
    } catch {
      setMutationError(notificationCopy.center.clearHistoryError)
    } finally {
      setIsClearingHistory(false)
    }
  }

  return (
    <section className={styles.center}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1>{notificationCopy.title}</h1>
        </div>
        <label className={styles.search}>
          <input
            type="search"
            value={searchQuery}
            placeholder={notificationCopy.center.searchPlaceholder}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <SystemIcon name="search" size={18} />
        </label>
        <label className={styles.masterToggle}>
          <span>
            {preferences.enabled
              ? notificationCopy.center.notificationsEnabled
              : notificationCopy.center.notificationsDisabled}
          </span>
          <input
            type="checkbox"
            checked={preferences.enabled}
            aria-label={
              preferences.enabled
                ? notificationCopy.actions.disableNotifications
                : notificationCopy.actions.enableNotifications
            }
            onChange={(event) =>
              updatePreferences({ enabled: event.target.checked })
            }
          />
          <i aria-hidden="true" />
        </label>
        <button
          className={`${styles.iconButton} ${styles.markReadButton}`}
          type="button"
          aria-label={notificationCopy.actions.markAllRead}
          disabled={
            isMarkingAllRead ||
            isClearingHistory ||
            pendingReadIds.size > 0 ||
            !hasUnreadStoredNotifications
          }
          onClick={() => void markAllRead()}
        >
          <SystemIcon name="check" size={20} />
        </button>
        <button
          className={`${styles.iconButton} ${styles.clearHistoryButton}`}
          type="button"
          aria-label={notificationCopy.actions.clearHistory}
          title={notificationCopy.actions.clearHistory}
          disabled={
            isClearingHistory ||
            isMarkingAllRead ||
            pendingReadIds.size > 0 ||
            !hasReadStoredNotifications
          }
          onClick={() => void clearHistory()}
        >
          <SystemIcon name="trash" size={20} />
        </button>
      </header>

      <SystemTabs
        className={styles.tabs}
        idBase="notifications"
        label={notificationCopy.center.filtersLabel}
        onChange={setActiveFilter}
        options={filters.map((filter) => ({
          badge: counts[filter.id],
          label: filter.label,
          value: filter.id,
        }))}
        value={activeFilter}
      />

      <SystemTabPanel
        className={styles.timeline}
        idBase="notifications"
        value={activeFilter}
        aria-busy={isLoading}
      >
        {loadError || mutationError ? (
          <div className={styles.errorNotice} role="alert">
            <span>{loadError ?? mutationError}</span>
            {loadError ? (
              <button
                type="button"
                onClick={() => void loadNotifications(true)}
              >
                {notificationCopy.actions.retry}
              </button>
            ) : null}
          </div>
        ) : null}
        {initialLoadingSkeleton.isMounted ? (
          <NotificationListSkeleton
            label={notificationCopy.center.loading}
            presencePhase={initialLoadingSkeleton.phase}
          />
        ) : loadError && items.length === 0 ? null
        : visibleItems.length === 0 ? (
          <div className={styles.empty}>
            <SystemIcon name="mail" size={30} />
            <strong>{notificationCopy.center.emptyTitle}</strong>
            <span>{notificationCopy.center.emptyDescription}</span>
          </div>
        ) : (
          groupByDay(visibleItems).map((group) => (
            <section className={styles.day} key={group.label}>
              <h2>{group.label}</h2>
              <div className={styles.list}>
                {group.items.map((item) => {
                  const activeInvite = item.inviteId
                    ? directServerInvites.find(
                        (invite) => invite.id === item.inviteId,
                      )
                    : null
                  return (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      activeInvite={activeInvite}
                      onAccept={(inviteId) => {
                        onAcceptDirectServerInvite(inviteId)
                      }}
                      onDecline={(inviteId) => {
                        onDeclineDirectServerInvite(inviteId)
                      }}
                      onRead={() => void markRead(item)}
                      onOpenTarget={onOpenTarget}
                    />
                  )
                })}
              </div>
            </section>
          ))
        )}
      </SystemTabPanel>
    </section>
  )
}

function NotificationRow({
  item,
  activeInvite,
  onAccept,
  onDecline,
  onRead,
  onOpenTarget,
}: {
  item: UserNotificationResponse
  activeInvite: ServerInviteResponse | null | undefined
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
  onRead: () => void
  onOpenTarget: (target: NotificationTarget) => void
}) {
  const image = getNotificationImage(item, activeInvite)
  const target = resolveNotificationTarget(item)
  function activate() {
    onRead()
    if (target) {
      onOpenTarget(target)
    }
  }
  return (
    <article
      className={`${styles.row} ${target ? styles.actionable : ''} ${styles[item.kind] ?? ''} ${
        item.readAt ? styles.read : ''
      }`}
      onClick={activate}
      onKeyDown={(event) => {
        if (target && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          activate()
        }
      }}
      role={target ? 'button' : undefined}
      tabIndex={target ? 0 : undefined}
    >
      <span className={styles.kindIcon}>
        <SystemIcon name={iconForKind(item.kind)} size={24} glow />
      </span>
      <span className={styles.actor}>
        {image ? (
          <img src={image.src} alt="" style={{ transform: image.transform }} />
        ) : (
          (item.actorDisplayName ?? item.serverTitle ?? item.body)
            .slice(0, 1)
            .toUpperCase()
        )}
      </span>
      <div className={styles.content}>
        <strong>{item.title}</strong>
        <p>{item.body}</p>
        {item.detail ? <blockquote>{item.detail}</blockquote> : null}
        {item.serverTitle && item.kind !== 'invite' ? (
          <small>{item.serverTitle}</small>
        ) : null}
      </div>
      <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
      {!item.readAt ? <i className={styles.unreadDot} /> : null}
      {item.kind === 'invite' && activeInvite ? (
        <div className={styles.actions}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDecline(activeInvite.id)
            }}
          >
            {notificationCopy.actions.decline}
          </button>
          <button
            className={styles.accept}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onAccept(activeInvite.id)
            }}
          >
            {notificationCopy.actions.accept}
          </button>
        </div>
      ) : null}
    </article>
  )
}

function mergeActiveInvites(
  notifications: UserNotificationResponse[],
  invites: ServerInviteResponse[],
) {
  const knownInviteIds = new Set(
    notifications
      .map((item) => item.inviteId)
      .filter((id): id is string => Boolean(id)),
  )
  const missing = invites
    .filter((invite) => !knownInviteIds.has(invite.id))
    .map<UserNotificationResponse>((invite) => ({
      id: `active-invite:${invite.id}`,
      kind: 'invite',
      title: notificationCopy.invite.title,
      body: invite.serverTitle ?? notificationCopy.brandFallback,
      detail: invite.serverDescription,
      actorUserId: null,
      actorDisplayName: null,
      actorAvatarAssetId: null,
      actorAvatarCropOffsetX: 0,
      actorAvatarCropOffsetY: 0,
      actorAvatarCropZoom: 1,
      serverId: invite.serverId,
      serverTitle: invite.serverTitle,
      serverIconAssetId: invite.serverIconAssetId,
      serverIconCropOffsetX: invite.serverIconCropOffsetX,
      serverIconCropOffsetY: invite.serverIconCropOffsetY,
      serverIconCropZoom: invite.serverIconCropZoom,
      spaceId: null,
      spaceTitle: null,
      messageId: null,
      messageCreatedAt: null,
      inviteId: invite.id,
      createdAt: invite.createdAt,
      readAt: null,
    }))
  return [...notifications, ...missing].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  )
}

function getNotificationImage(
  item: UserNotificationResponse,
  invite?: ServerInviteResponse | null,
) {
  const assetId =
    item.kind === 'invite'
      ? invite?.serverIconAssetId ?? item.serverIconAssetId
      : item.actorAvatarAssetId
  if (!assetId) {
    return null
  }

  const offsetX =
    item.kind === 'invite'
      ? invite?.serverIconCropOffsetX ?? item.serverIconCropOffsetX
      : item.actorAvatarCropOffsetX
  const offsetY =
    item.kind === 'invite'
      ? invite?.serverIconCropOffsetY ?? item.serverIconCropOffsetY
      : item.actorAvatarCropOffsetY
  const zoom =
    item.kind === 'invite'
      ? invite?.serverIconCropZoom ?? item.serverIconCropZoom
      : item.actorAvatarCropZoom
  return {
    src: `/api/assets/${assetId}/content`,
    transform: `translate(${offsetX * 100}%, ${offsetY * 100}%) scale(${zoom})`,
  }
}

function iconForKind(kind: string) {
  if (isInviteKind(kind)) return 'user-plus'
  if (kind === 'mention') return 'message'
  if (kind === 'achievement') return 'pin'
  return 'server'
}

function isInviteKind(kind: string) {
  return kind === 'invite' ||
    kind === 'private-space-invite' ||
    kind === 'friend-request'
}

function groupByDay(items: UserNotificationResponse[]) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const groups = new Map<string, UserNotificationResponse[]>()

  for (const item of items) {
    const date = new Date(item.createdAt)
    const label = isSameDay(date, today)
      ? notificationCopy.center.today
      : isSameDay(date, yesterday)
        ? notificationCopy.center.yesterday
        : new Intl.DateTimeFormat(notificationCopy.locale, {
            day: 'numeric',
            month: 'long',
          }).format(date)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }

  return Array.from(groups, ([label, groupItems]) => ({
    label,
    items: groupItems,
  }))
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

function formatTime(value: string) {
  const date = new Date(value)
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  )
  if (elapsedMinutes < 1) return notificationCopy.center.now
  if (elapsedMinutes < 60) {
    return notificationCopy.center.minutesAgo(elapsedMinutes)
  }
  if (isSameDay(date, new Date())) {
    return notificationCopy.center.hoursAgo(Math.floor(elapsedMinutes / 60))
  }
  return new Intl.DateTimeFormat(notificationCopy.locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
