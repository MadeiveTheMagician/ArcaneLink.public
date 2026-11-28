import { getServerIconImageStyle } from '../../../../shared/media/serverIconImageStyle'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import type {
  ServerMemberDetailsResponse,
  ServerMemberResponse,
} from '../../../../shared/types'
import {
  commonCopy,
  communityCopy,
  serverCopy,
  SystemIcon,
  UnreadBadge,
} from '../../../shared/index'
import { ContextMenu } from '../../../shared/components/context-menu/ContextMenu'
import type { ContextMenuItem } from '../../../shared/components/context-menu/ContextMenu'
import { SystemPlusIcon } from '../../../shared/icons/components/SystemPlusIcon'
import { normalizeHexColor } from '../../../shared/ui/hexColor'
import { SystemColorPicker } from '../../../shared/ui/SystemColorPicker'
import { SystemButton } from '../../../shared/ui/SystemButton'
import { SystemSkeleton } from '../../../shared/ui/SystemSkeleton'
import { getUnreadMessageLabel } from '../../../shared/ui/unreadBadgeModel'
import type { VoiceParticipant } from '../../hooks/voice/useVoiceChannel'
import {
  applyServerRailDrop,
  dissolveServerRailFolder,
  maxServerRailFolderNameLength,
  updateServerRailFolder,
} from './serverRailFolders'
import type {
  ServerRailDropTarget,
  ServerRailFolderEntry,
  ServerRailItemRef,
  ServerRailLayout,
} from './serverRailFolders'
import { createPortal } from 'react-dom'
import { useServerRailReflow } from './useServerRailReflow'
import { ServerTooltip } from './ServerTooltip'
import styles from './ServerRail.module.css'

const serverRailSkeletonKeys = Array.from(
  { length: 16 },
  (_, index) => `server-${index + 1}`,
)

const folderName = 'Новая папка'

type ServerRailProps = {
  avatarSrc: string
  hasFavorites?: boolean
  isFavoritesOpen?: boolean
  onOpenFavorites?: () => void
  isOpen: boolean
  isLoadingServers: boolean
  memberships: ServerMemberResponse[]
  serverLayout: ServerRailLayout
  columnCount?: number
  selectedServerId?: string
  selectedServerMembers: ServerMemberDetailsResponse[]
  selectedServerVoiceParticipants: VoiceParticipant[]
  onOpenProfile: () => void
  onOpenServer: (membership: ServerMemberResponse) => void
  onOpenContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    membership: ServerMemberResponse,
    folderItems?: ContextMenuItem[],
  ) => void
  onServerLayoutChange: (layout: ServerRailLayout) => void
  onCreateServer: () => void
  onShowAllServers: () => void
  onShowFriends: () => void
  onShowInvites: () => void
}

type DropAxis = 'x' | 'y'
type DropPlacement = 'before' | 'after' | 'inside'
type DropGeometry =
  | (ServerRailItemRef & { axis: DropAxis; folderId?: string })
  | { kind: 'end' }

type FolderMenu = { folderId: string; x: number; y: number }

export function ServerRail({
  avatarSrc,
  hasFavorites,
  isFavoritesOpen,
  onOpenFavorites,
  isOpen,
  isLoadingServers,
  memberships,
  serverLayout,
  columnCount = 1,
  selectedServerId,
  selectedServerMembers,
  selectedServerVoiceParticipants,
  onOpenProfile,
  onOpenServer,
  onOpenContextMenu,
  onServerLayoutChange,
  onCreateServer,
  onShowAllServers,
  onShowFriends,
  onShowInvites,
}: ServerRailProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )
  const [dragSource, setDragSource] = useState<ServerRailItemRef | null>(null)
  const [mergedFolderId, setMergedFolderId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<ServerRailDropTarget | null>(null)
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null)
  const [folderMenu, setFolderMenu] = useState<FolderMenu | null>(null)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const membershipsByServerId = new Map(memberships.map((entry) => [entry.serverId, entry]))
  const folders = serverLayout.filter((entry) => entry.kind === 'folder')
  const editingFolder = folders.find((folder) => folder.id === editingFolderId)
  const menuFolder = folders.find((folder) => folder.id === folderMenu?.folderId)
  const dropAxis = columnCount > 1 ? 'x' : 'y'

  const { listRef, stopReflow } = useServerRailReflow(columnCount, serverLayout, expandedFolderId, isOpen, isLoadingServers)

  useEffect(() => () => document.body.classList.remove('is-server-rail-dragging'), [])

  function commitDrop(source: ServerRailItemRef, target: ServerRailDropTarget) {
    const newFolder = source.kind === 'server' && target.kind === 'server' &&
      target.placement === 'inside'
      ? { id: createServerRailFolderId(), name: folderName }
      : undefined
    const next = applyServerRailDrop(serverLayout, source, target, newFolder)
    if (next !== serverLayout) {
      onServerLayoutChange(next)
      if (newFolder && next.some((entry) => entry.id === newFolder.id)) {
        setExpandedFolderId(newFolder.id)
        setMergedFolderId(newFolder.id)
      } else if (target.kind === 'folder' && target.placement === 'inside') {
        setMergedFolderId(target.id)
      }
    }
  }

  function handleDragStart(event: DragStartEvent) {
    stopReflow()
    document.body.classList.add('is-server-rail-dragging')
    setFolderMenu(null)
    setDragSource(event.active.data.current?.railSource as ServerRailItemRef)
  }

  function handleDragMove(event: DragMoveEvent) {
    const next = readDropTarget(event)
    setDropTarget((current) => isSameDropTarget(current, next) ? current : next)
  }

  function clearDrag() {
    document.body.classList.remove('is-server-rail-dragging')
    setDropTarget(null)
    setDragSource(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const source = event.active.data.current?.railSource as ServerRailItemRef | undefined
    const target = readDropTarget(event)
    clearDrag()
    if (source && target) commitDrop(source, target)
  }

  function getOrderActions(
    source: ServerRailItemRef,
    entries: ServerRailItemRef[],
  ): ContextMenuItem[] {
    const index = entries.findIndex((entry) => entry.id === source.id && entry.kind === source.kind)
    const previous = index > 0 ? entries[index - 1] : null
    const next = index >= 0 ? entries[index + 1] : null

    return index < 0 ? [] : [{
      type: 'move',
      label: 'Перемещение',
      onUp: previous ? () => commitDrop(source, { ...previous, placement: 'before' }) : undefined,
      onDown: next ? () => commitDrop(source, { ...next, placement: 'after' }) : undefined,
    }]
  }

  function getServerFolderActions(serverId: string, parentFolderId?: string): ContextMenuItem[] {
    const source = { kind: 'server', id: serverId } as const
    const parent = folders.find((folder) => folder.id === parentFolderId)
    const folderChoices: ContextMenuItem[] = folders
      .filter((folder) => folder.id !== parentFolderId)
      .map((folder) => ({
        type: 'item',
        label: folder.name,
        onSelect: () => commitDrop(source, { kind: 'folder', id: folder.id, placement: 'inside' }),
      }))
    const createChoices: ContextMenuItem[] = serverLayout.flatMap((entry) => {
      if (entry.kind !== 'server' || entry.id === serverId) return []
      const membership = membershipsByServerId.get(entry.id)
      if (!membership) return []
      return [{
        type: 'item',
        label: membership.server.title,
        onSelect: () => commitDrop(source, { kind: 'server', id: entry.id, placement: 'inside' }),
      }]
    })
    if (createChoices.length) {
      folderChoices.push({ type: 'item', label: 'Создать папку с…', submenu: createChoices })
    }
    return [
      ...(folderChoices.length ? [{
        type: 'item' as const,
        label: 'Переместить в папку',
        icon: 'folder' as const,
        submenu: folderChoices,
      }] : []),
      ...(parent ? [{
        type: 'item' as const,
        label: 'Вынести из папки',
        onSelect: () => commitDrop(source, { kind: 'folder', id: parent.id, placement: 'after' }),
      }] : []),
      ...getOrderActions(
        source,
        parent ? parent.serverIds.map((id) => ({ kind: 'server', id })) : serverLayout,
      ),
    ]
  }

  function renderServer(serverId: string, parentFolderId?: string) {
    const membership = membershipsByServerId.get(serverId)
    if (!membership) return null
    const isSelected = selectedServerId === serverId
    return (
      <ServerRailItem
        key={membership.id}
        membership={membership}
        isSelected={isSelected}
        voiceParticipants={isSelected ? selectedServerVoiceParticipants : []}
        voiceParticipantMembers={isSelected ? selectedServerMembers : []}
        dropPlacement={getDropPlacement(dropTarget, 'server', serverId)}
        dropAxis={dropAxis}
        parentFolderId={parentFolderId}
        onOpenServer={onOpenServer}
        onOpenContextMenu={(event, entry) =>
          onOpenContextMenu(event, entry, getServerFolderActions(serverId, parentFolderId))
        }
      />
    )
  }

  const draggedServer = dragSource?.kind === 'server'
    ? membershipsByServerId.get(dragSource.id)?.server
    : null
  const draggedFolder = dragSource?.kind === 'folder'
    ? folders.find((folder) => folder.id === dragSource.id)
    : null

  return (
    <aside
      id="server-rail"
      className={`${styles.drawer} ${isOpen ? styles.open : ''}`}
      style={{ '--server-rail-columns': columnCount } as CSSProperties}
      aria-label="Navigation"
      inert={!isOpen}
    >
      <button
        className={`${styles.avatar} ui-frame`}
        type="button"
        onClick={onOpenProfile}
        aria-label="Open profile"
        title="Profile"
      >
        <img className="ui-media-fit" src={avatarSrc} alt="" />
      </button>

      <div
        className={`${styles.list} ${isLoadingServers ? styles.loadingList : ''} ui-scrollbar-none`}
        ref={listRef}
        data-wide={columnCount > 1 || undefined}
        aria-busy={isLoadingServers}
      >
        {hasFavorites && (
          <button className={styles.favoritesButton} type="button" data-rail-item="favorites"
            aria-label="Избранное" aria-pressed={isFavoritesOpen} title="Избранное"
            onClick={onOpenFavorites}>
            <span aria-hidden="true">★</span>
          </button>
        )}
        {isLoadingServers ? (
          serverRailSkeletonKeys.map((key) => (
            <SystemSkeleton
              key={key}
              className={styles.serverSkeleton}
              height="var(--profile-rail-server)"
              variant="block"
              width="var(--profile-rail-server)"
            />
          ))
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={serverRailCollisionDetection}
            autoScroll={{ enabled: false, layoutShiftCompensation: false }}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={clearDrag}
          >
            {serverLayout.map((entry) =>
              entry.kind === 'server' ? renderServer(entry.id) : (
                <ServerRailFolder
                  key={entry.id}
                  folder={entry}
                  justMerged={mergedFolderId === entry.id}
                  onMergeAnimationEnd={() => setMergedFolderId(null)}
                  isOpen={expandedFolderId === entry.id}
                  hasSelectedServer={entry.serverIds.some((id) => id === selectedServerId)}
                  preview={entry.serverIds.slice(0, 4).map((id) => membershipsByServerId.get(id))}
                  serverNames={entry.serverIds.flatMap((id) => membershipsByServerId.get(id)?.server.title ?? [])}
                  dropPlacement={getDropPlacement(dropTarget, 'folder', entry.id)}
                  dropAxis={dropAxis}
                  onToggle={() => setExpandedFolderId((id) => id === entry.id ? null : entry.id)}
                  onOpenMenu={(x, y) => setFolderMenu({ folderId: entry.id, x, y })}
                  renderMembers={() => entry.serverIds.map((id) => renderServer(id, entry.id))}
                />
              ),
            )}
            <ServerRailEndSlot
              isDragging={Boolean(dragSource)}
              isTarget={dropTarget?.kind === 'end'}
              onCreateServer={onCreateServer}
            />
            {createPortal(
              <DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }} zIndex={10002}>
                {draggedServer ? (
                  <span className={styles.dragPreview} data-server-rail-drag-preview aria-hidden="true">
                    <ServerRailIcon server={draggedServer} />
                  </span>
                ) : draggedFolder ? (
                  <span className={styles.dragPreview} data-server-rail-drag-preview aria-hidden="true" style={{ borderColor: draggedFolder.color }}>
                    <SystemIcon name="folder" size={18} />
                  </span>
                ) : null}
              </DragOverlay>,
              document.body,
            )}
          </DndContext>
        )}
      </div>

      <div className={styles.utilities} data-wide={columnCount > 1 || undefined} aria-label="Hub actions">
        <button
          className={styles.tool}
          data-rail-item="utility:friends"
          type="button"
          onClick={onShowFriends}
          aria-label={communityCopy.tabs.friends}
          title={communityCopy.tabs.friends}
        >
          <span className={styles.toolIcon} aria-hidden="true">
            <SystemIcon name="friends" size={22} />
          </span>
        </button>
        <button
          className={styles.tool}
          data-rail-item="utility:invites"
          type="button"
          onClick={onShowInvites}
          aria-label={communityCopy.direct.invitesTitle}
          title={communityCopy.direct.invitesTitle}
        >
          <span className={styles.toolIcon} aria-hidden="true">
            <SystemIcon name="mail" size={22} />
          </span>
        </button>
        <button
          className={styles.tool}
          data-rail-item="utility:servers"
          type="button"
          onClick={onShowAllServers}
          aria-label={commonCopy.navigation.servers}
          title={communityCopy.direct.allServers}
        >
          <span className={styles.toolIcon} aria-hidden="true">
            <SystemIcon name="globe" size={22} />
          </span>
        </button>
      </div>
      {folderMenu && menuFolder ? (
        <ContextMenu
          x={folderMenu.x}
          y={folderMenu.y}
          autoFocus
          onClose={() => setFolderMenu(null)}
          items={[
            {
              type: 'item',
              label: 'Настроить папку',
              icon: 'settings',
              onSelect: () => setEditingFolderId(menuFolder.id),
            },
            ...getOrderActions(menuFolder, serverLayout),
            {
              type: 'item',
              label: 'Расформировать папку',
              icon: 'folder',
              onSelect: () => onServerLayoutChange(dissolveServerRailFolder(serverLayout, menuFolder.id)),
            },
          ]}
        />
      ) : null}
      {editingFolder ? (
        <ServerRailFolderEditor
          key={editingFolder.id}
          folder={editingFolder}
          onClose={() => setEditingFolderId(null)}
          onSave={(change) => {
            onServerLayoutChange(updateServerRailFolder(serverLayout, editingFolder.id, change))
            setEditingFolderId(null)
          }}
        />
      ) : null}
    </aside>
  )
}

function ServerRailItem({
  membership,
  isSelected,
  voiceParticipants,
  voiceParticipantMembers,
  dropPlacement,
  dropAxis,
  parentFolderId,
  onOpenServer,
  onOpenContextMenu,
}: {
  membership: ServerMemberResponse
  isSelected: boolean
  voiceParticipants: VoiceParticipant[]
  voiceParticipantMembers: ServerMemberDetailsResponse[]
  dropPlacement: DropPlacement | null
  dropAxis: DropAxis
  parentFolderId?: string
  onOpenServer: (membership: ServerMemberResponse) => void
  onOpenContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    membership: ServerMemberResponse,
  ) => void
}) {
  const { server } = membership
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const item = { kind: 'server', id: membership.serverId } as const
  const id = getDraggableId(item)
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({ id, data: { railSource: item } })
  const { setNodeRef: setDroppableRef } = useDroppable({
    id,
    data: { railDrop: { ...item, axis: dropAxis, folderId: parentFolderId } satisfies DropGeometry },
  })
  const setServerButtonRef = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node
      setDraggableRef(node)
    },
    [setDraggableRef],
  )
  const tooltipId = `server-tooltip-${server.id}`
  const unreadLabel = getUnreadMessageLabel(membership.unreadCount)

  return (
    <div
      ref={setDroppableRef}
      className={styles.serverDropSlot}
      data-rail-item={id}
      data-drop-axis={dropAxis}
      data-drop-placement={dropPlacement}
    >
      <button
        ref={setServerButtonRef}
        className={`${styles.server} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
        type="button"
        onClick={() => onOpenServer(membership)}
        onContextMenu={(event) => onOpenContextMenu(event, membership)}
        onPointerEnter={() => setIsTooltipOpen(true)}
        onPointerLeave={() => setIsTooltipOpen(false)}
        onFocus={() => setIsTooltipOpen(true)}
        onBlur={() => setIsTooltipOpen(false)}
        aria-label={unreadLabel
          ? `Открыть сервер ${server.title}. ${unreadLabel}`
          : `Открыть сервер ${server.title}`}
        {...listeners}
        {...attributes}
      >
        <span className={`${styles.icon} ui-frame`}>
          <ServerRailIcon server={server} />
        </span>
      </button>
      <UnreadBadge className={styles.unreadBadge} count={membership.unreadCount} />
      <ServerTooltip
        anchorRef={buttonRef}
        id={tooltipId}
        isOpen={isTooltipOpen && !isDragging}
        members={voiceParticipantMembers}
        participants={voiceParticipants}
        serverTitle={server.title}
      />
    </div>
  )
}

function ServerRailIcon({ server }: { server: ServerMemberResponse['server'] }) {
  return server.iconAssetId ? (
    <img
      className="ui-media-fit"
      src={`/api/assets/${server.iconAssetId}/content`}
      alt=""
      draggable={false}
      style={getServerIconImageStyle(
        server.iconCropOffsetX,
        server.iconCropOffsetY,
        server.iconCropZoom,
      )}
    />
  ) : server.title.slice(0, 1).toUpperCase()
}

function ServerRailFolder({
  folder,
  justMerged,
  onMergeAnimationEnd,
  isOpen,
  hasSelectedServer,
  preview,
  serverNames,
  dropPlacement,
  dropAxis,
  onToggle,
  onOpenMenu,
  renderMembers,
}: {
  folder: ServerRailFolderEntry
  justMerged: boolean
  onMergeAnimationEnd: () => void
  isOpen: boolean
  hasSelectedServer: boolean
  preview: (ServerMemberResponse | undefined)[]
  serverNames: string[]
  dropPlacement: DropPlacement | null
  dropAxis: DropAxis
  onToggle: () => void
  onOpenMenu: (x: number, y: number) => void
  renderMembers: () => ReactNode
}) {
  const membersId = useId()
  const disclosureRef = useRef<HTMLDivElement>(null)
  const [retainMembers, setRetainMembers] = useState(isOpen)
  const showMembers = isOpen || retainMembers
  if (isOpen && !retainMembers) setRetainMembers(true)

  useLayoutEffect(() => {
    if (isOpen || !retainMembers || !disclosureRef.current) return

    let cancelled = false
    const transitions = disclosureRef.current.getAnimations()
    void Promise.allSettled(transitions.map((transition) => transition.finished)).then(() => {
      if (!cancelled) setRetainMembers(false)
    })
    return () => { cancelled = true }
  }, [isOpen, retainMembers])
  const tooltipId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const item = { kind: 'folder', id: folder.id } as const
  const id = getDraggableId(item)
  const axis = isOpen ? 'y' : dropAxis
  const { setNodeRef: setDroppableRef } = useDroppable({
    id,
    data: { railDrop: { ...item, axis } satisfies DropGeometry },
  })
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id,
    data: { railSource: item },
  })

  const setFolderButtonRef = useCallback((button: HTMLButtonElement | null) => {
    buttonRef.current = button
    setNodeRef(button)
  }, [setNodeRef])

  function openMenuFromButton(button: HTMLButtonElement) {
    const bounds = button.getBoundingClientRect()
    onOpenMenu(bounds.right, bounds.top)
  }

  return (
    <div
      ref={setDroppableRef}
      className={`${styles.serverDropSlot} ${styles.folderSlot} ${showMembers ? styles.folderExpanded : ''}`}
      data-rail-item={id}
      data-merged={justMerged || undefined}
      onAnimationEnd={justMerged ? onMergeAnimationEnd : undefined}
      data-drop-axis={axis}
      data-drop-placement={dropPlacement}
      style={{ '--server-folder-color': folder.color } as CSSProperties}
    >
      <div className={styles.folderHeader}>
        <button
          ref={setFolderButtonRef}
          className={`${styles.folderButton} ${hasSelectedServer ? styles.folderSelected : ''} ${isDragging ? styles.dragging : ''}`}
          type="button"
          aria-label={`Папка ${folder.name}`}
          aria-expanded={isOpen}
          aria-controls={showMembers ? membersId : undefined}
          onClick={onToggle}
          onPointerEnter={() => setIsTooltipOpen(true)}
          onPointerLeave={() => setIsTooltipOpen(false)}
          onFocus={() => setIsTooltipOpen(true)}
          onBlur={() => setIsTooltipOpen(false)}
          onContextMenu={(event) => {
            setIsTooltipOpen(false)
            event.preventDefault()
            onOpenMenu(event.clientX, event.clientY)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
              event.preventDefault()
              setIsTooltipOpen(false)
              openMenuFromButton(event.currentTarget)
            }
          }}
          {...attributes}
          {...listeners}
          aria-describedby={isTooltipOpen && !isDragging ? tooltipId : attributes['aria-describedby']}
        >
          {showMembers ? (
            <span className={styles.folderTitle}>
              <SystemIcon name="folder" size={16} />
            </span>
          ) : (
            <span className={styles.folderPreview} aria-hidden="true">
              {preview.flatMap((membership) => membership ? [
                <span key={membership.id}><ServerRailIcon server={membership.server} /></span>,
              ] : [])}
            </span>
          )}
        </button>
      </div>
      <ServerTooltip
        anchorRef={buttonRef}
        id={tooltipId}
        isOpen={isTooltipOpen && !isDragging}
        serverTitle={folder.name}
        serverNames={serverNames}
      />
      {showMembers && (
        <div
          ref={disclosureRef}
          id={membersId}
          className={styles.folderDisclosure}
          data-folder-open={isOpen}
          inert={!isOpen}
        >
          <div className={styles.folderMembersClip}>
            <div className={styles.folderMembers}>{renderMembers()}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function ServerRailFolderEditor({
  folder,
  onClose,
  onSave,
}: {
  folder: ServerRailFolderEntry
  onClose: () => void
  onSave: (change: Pick<ServerRailFolderEntry, 'name' | 'color'>) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [name, setName] = useState(folder.name)
  const [color, setColor] = useState(folder.color)
  const validColor = normalizeHexColor(color)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog ref={dialogRef} className={styles.folderDialog} aria-labelledby={titleId} onCancel={onClose}>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (name.trim() && validColor) onSave({ name, color: validColor })
      }}>
        <h2 id={titleId}>Настроить папку</h2>
        <label>
          Название
          <input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={maxServerRailFolderNameLength}
            autoFocus
            required
          />
        </label>
        <SystemColorPicker
          label="Цвет рамки"
          value={color}
          previewColor={validColor ?? folder.color}
          onChange={setColor}
        />
        <div className={styles.folderDialogActions}>
          <SystemButton type="button" variant="ghost" onClick={onClose}>Отмена</SystemButton>
          <SystemButton type="submit" disabled={!name.trim() || !validColor}>Сохранить</SystemButton>
        </div>
      </form>
    </dialog>
  )
}

function ServerRailEndSlot({
  isDragging,
  isTarget,
  onCreateServer,
}: {
  isDragging: boolean
  isTarget: boolean
  onCreateServer: () => void
}) {
  const id = 'rail:end'
  const { setNodeRef } = useDroppable({
    id,
    data: { railDrop: { kind: 'end' } satisfies DropGeometry },
  })
  return (
    <div
      ref={setNodeRef}
      className={styles.serverDropSlot}
      data-rail-item={id}
      data-drop-placement={isTarget ? 'inside' : undefined}
    >
      <button
        className={`${styles.server} ${styles.createServer}`}
        type="button"
        onClick={onCreateServer}
        aria-label={serverCopy.actions.createServer}
        title={isDragging ? 'Переместить в конец списка' : serverCopy.actions.createServer}
      >
        <span className={`${styles.icon} ui-frame`} aria-hidden="true">
          <SystemPlusIcon size="large" />
        </span>
      </button>
    </div>
  )
}

function createServerRailFolderId() {
  return crypto.randomUUID?.() ?? Array.from(
    crypto.getRandomValues(new Uint32Array(4)),
    (part) => part.toString(16).padStart(8, '0'),
  ).join('')
}

function getDraggableId(item: ServerRailItemRef) {
  return `rail:${item.kind}:${item.id}`
}

function getDropPlacement(
  target: ServerRailDropTarget | null,
  kind: ServerRailItemRef['kind'],
  id: string,
) {
  return target?.kind === kind && target.id === id ? target.placement : null
}

function readDropTarget(event: DragMoveEvent): ServerRailDropTarget | null {
  return (event.collisions?.[0]?.data?.railTarget as ServerRailDropTarget | undefined) ?? null
}

function isSameDropTarget(left: ServerRailDropTarget | null, right: ServerRailDropTarget | null) {
  if (left === right || (left?.kind === 'end' && right?.kind === 'end')) return true
  if (!left || !right || left.kind === 'end' || right.kind === 'end') return false
  return left.kind === right.kind && left.id === right.id && left.placement === right.placement
}

const serverRailCollisionDetection: CollisionDetection = (args) => {
  const pointer = args.pointerCoordinates
  const source = args.active.data.current?.railSource as ServerRailItemRef | undefined
  if (!source || !pointer || !document.elementFromPoint(pointer.x, pointer.y)?.closest('#server-rail')) return []

  const collisions = pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => {
      if (container.id === args.active.id || container.node.current?.closest('[inert]')) return false
      const drop = container.data.current?.railDrop as DropGeometry | undefined
      return drop && (source.kind === 'server' || drop.kind === 'end' || !drop.folderId)
    }),
  })

  // A member slot takes priority over the expanded folder that contains it.
  const collision = collisions.find((entry) =>
    entry.data?.droppableContainer.data.current?.railDrop?.folderId,
  ) ?? collisions[0]
  const drop = collision?.data?.droppableContainer.data.current?.railDrop as DropGeometry | undefined
  const rect = collision && args.droppableRects.get(collision.id)
  if (!drop || !rect || !collision) return []

  if (drop.kind === 'end') {
    return [{ ...collision, data: { railTarget: { kind: 'end' } satisfies ServerRailDropTarget } }]
  }

  const y = (pointer.y - rect.top) / rect.height
  const x = (pointer.x - rect.left) / rect.width
  const isCenter = x > 0.23 && x < 0.77 && y > 0.23 && y < 0.77
  const distance = drop.axis === 'x' && (x <= 0.23 || x >= 0.77) ? x : y
  const placement: DropPlacement = source.kind === 'server' && !drop.folderId && isCenter
    ? 'inside'
    : distance < 0.5 ? 'before' : 'after'
  return [{
    ...collision,
    data: {
      railTarget: { kind: drop.kind, id: drop.id, placement } satisfies ServerRailDropTarget,
    },
  }]
}
