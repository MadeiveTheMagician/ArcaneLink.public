import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../../../../shared/api/api'
import type { ServerMemberResponse, SpaceResponse } from '../../../../shared/types'
import { serverCopy, SystemIcon, UnreadBadge } from '../../../shared'
import { ContextMenu, type ContextMenuItem } from '../../../shared/components/context-menu/ContextMenu'
import { FavoriteSpaceRow } from './FavoriteSpaceRow'
import type { FavoriteSpace } from './favoriteSpaces'
import styles from './FavoriteSpacesView.module.css'

type Props = {
  accessToken: string
  favorites: FavoriteSpace[]
  memberships: ServerMemberResponse[]
  selection: FavoriteSpace | null
  onOpen: (target: FavoriteSpace, openVoiceChat?: boolean) => void
  onRemove: (target: FavoriteSpace) => void
}

function categoryChildren(rootId: string, spaces: SpaceResponse[]) {
  const children = new Map<string, SpaceResponse[]>()
  for (const space of spaces) {
    if (!space.parentSpaceId) continue
    const siblings = children.get(space.parentSpaceId) ?? []
    siblings.push(space)
    children.set(space.parentSpaceId, siblings)
  }

  const visited = new Set([rootId])
  function collect(parentId: string): Array<{ space: SpaceResponse; depth: number }> {
    return [...(children.get(parentId) ?? [])]
      .sort((first, second) => first.position - second.position)
      .flatMap((space): Array<{ space: SpaceResponse; depth: number }> => {
        if (visited.has(space.id)) return []
        visited.add(space.id)
        return [
          { space, depth: 0 },
          ...collect(space.id).map((child) => ({ ...child, depth: child.depth + 1 })),
        ]
      })
  }
  return collect(rootId)
}

export function FavoriteSpacesView({ accessToken, favorites, memberships, selection, onOpen, onRemove }: Props) {
  const serverKey = [...new Set(favorites
    .filter(({ serverId }) => memberships.some((member) => member.serverId === serverId))
    .map(({ serverId }) => serverId))].sort().join(',')
  const [loaded, setLoaded] = useState<{
    key: string
    spaces: Map<string, SpaceResponse[]>
  }>()
  useEffect(() => {
    if (!serverKey) return
    const controller = new AbortController()
    const serverIds = serverKey.split(',')
    void Promise.allSettled(serverIds.map((serverId) =>
      apiJson<SpaceResponse[]>(`/api/servers/${encodeURIComponent(serverId)}/spaces`, { accessToken, signal: controller.signal }),
    )).then((results) => {
      if (controller.signal.aborted) return
      setLoaded({
        key: serverKey,
        spaces: new Map(results.flatMap((result, index) =>
          result.status === 'fulfilled' ? [[serverIds[index], result.value] as const] : [])),
      })
    })
    return () => controller.abort()
  }, [accessToken, serverKey])

  const visible = useMemo(() => favorites.map((target) => {
    const membership = memberships.find(({ serverId }) => serverId === target.serverId)
    const spaces = membership && loaded?.key === serverKey
      ? loaded.spaces.get(target.serverId) ?? []
      : []
    return { target, membership, spaces, space: spaces.find(({ id }) => id === target.spaceId) }
  }), [favorites, loaded, memberships, serverKey])

  const [menu, setMenu] = useState<{
    target: FavoriteSpace
    x: number
    y: number
    autoFocus: boolean
  } | null>(null)
  const isLoading = Boolean(serverKey && loaded?.key !== serverKey)

  function renderSpace(target: FavoriteSpace, space?: SpaceResponse) {
    const isVoice = space?.typeCode === 'voice_room'
    const isCategory = space?.typeCode === 'category'
    const isChannel = space && !isCategory
    const voiceChatSpace = isVoice && space.voiceChatSpaceId ? space : undefined

    return (
      <FavoriteSpaceRow
        title={space?.title ?? 'Спейс недоступен'}
        kind={isVoice ? 'voice' : isCategory || !space ? 'category' : 'text'}
        isCurrent={selection?.serverId === target.serverId && selection.spaceId === target.spaceId}
        onOpen={isChannel ? () => onOpen(target) : undefined}
        onOpenMenu={(x, y, autoFocus) => setMenu({ target, x, y, autoFocus })}
        trailingAction={voiceChatSpace && (
          <button type="button" className={styles.voiceChat} onClick={() => onOpen(target, true)}
            aria-label={serverCopy.messages.openVoiceChat(voiceChatSpace.title)}
            title={serverCopy.messages.openVoiceChat(voiceChatSpace.title)}>
            <SystemIcon name="message" size={16} />
            <UnreadBadge className={styles.voiceChatUnread} count={voiceChatSpace.unreadCount} />
          </button>
        )}
      />
    )
  }

  function renderMenu() {
    if (!menu || isLoading) return null

    const { target, x, y, autoFocus } = menu
    const entry = visible.find((item) => item.target.serverId === target.serverId)
    const space = entry?.spaces.find(({ id }) => id === target.spaceId)
    const isSaved = favorites.some((item) => item.serverId === target.serverId && item.spaceId === target.spaceId)
    const items: ContextMenuItem[] = []
    if (space && space.typeCode !== 'category') {
      const isVoice = space.typeCode === 'voice_room'
      items.push({
        type: 'item',
        label: isVoice ? 'Открыть голосовой спейс' : 'Открыть чат',
        icon: isVoice ? 'audio' : 'message',
        onSelect: () => onOpen(target),
      })
      if (isVoice && space.voiceChatSpaceId) {
        items.push({
          type: 'item',
          label: 'Открыть чат голосового спейса',
          icon: 'message',
          onSelect: () => onOpen(target, true),
        })
      }
    }
    if (isSaved) {
      if (items.length) items.push({ type: 'separator' })
      items.push({
        type: 'item',
        label: 'Убрать из избранного',
        icon: 'trash',
        onSelect: () => onRemove(target),
      })
    }

    return items.length > 0
      ? <ContextMenu x={x} y={y} items={items} autoFocus={autoFocus} wrapLabels onClose={() => setMenu(null)} />
      : null
  }

  return (
    <aside className={styles.workspace} aria-label="Избранное">
      <header><strong><span aria-hidden="true">★</span> Избранное</strong></header>
      {favorites.length === 0 && <p>Добавьте текстовый или голосовой спейс через его меню.</p>}
      {isLoading && <p role="status">Загружаем избранные спейсы…</p>}
      {!isLoading && (
        <ul className={styles.list}>
          {visible.map(({ target, membership, spaces, space }) => (
            <li className={styles.entry} key={`${target.serverId}:${target.spaceId}`}>
              <small className={styles.serverName}>{membership?.server.title ?? 'Сервер недоступен'}</small>
              {renderSpace(target, space)}
              {space?.typeCode === 'category' && (
                <ul className={styles.children}>
                  {categoryChildren(space.id, spaces).map(({ space: child, depth }) => (
                    <li key={child.id} style={{ paddingInlineStart: Math.min(depth, 8) * 14 }}>
                      {child.typeCode === 'category'
                        ? <strong className={styles.categoryLabel}>
                            <SystemIcon name="folder" size={16} /> <span>{child.title}</span>
                          </strong>
                        : renderSpace({ serverId: target.serverId, spaceId: child.id }, child)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {renderMenu()}
    </aside>
  )
}
