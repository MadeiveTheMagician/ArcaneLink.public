import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { PrivateSpaceFolderResponse } from '../../../../../shared/types'
import { ContextMenu, type ContextMenuItem } from '../../../../shared/components/context-menu/ContextMenu'
import { SystemIcon } from '../../../../shared/icons/SystemIcon'
import { privateSpaceFolderCopy } from './privateSpaceFolderCopy.ru'
import { getPrivateSpaceFolderDisplayName } from './privateSpaceFolderModel'
import type { FolderDropPlacement } from './PrivateSpaceFolderDragArea'
import styles from './PrivateSpaceFolders.module.css'

type PrivateSpaceFolderRailProps = {
  folders: PrivateSpaceFolderResponse[]
  activeFolderId: string
  expandedFolderId: string | null
  activeDragFolderId?: string | null
  overFolderId?: string | null
  dropPlacement?: FolderDropPlacement | null
  collapsed?: boolean
  disabled?: boolean
  orientation?: 'wrapped' | 'horizontal'
  onSelect: (folderId: string) => void
  onEdit: (folder: PrivateSpaceFolderResponse) => void
  onDelete: (folderId: string) => void
  onToggleOrderLock: (folderId: string, isLocked: boolean) => void
  onMarkAllRead?: () => void
  markAllReadDisabled?: boolean
}

function haveSameFolderTitleLengths(
  left: Map<string, number>,
  right: Map<string, number>,
) {
  if (left.size !== right.size) return false
  for (const [id, length] of left) {
    if (right.get(id) !== length) return false
  }
  return true
}

function FolderChip({
  folder,
  active,
  expanded,
  visibleTitleLength,
  disabled,
  dropPlacement,
  hiddenWhenCollapsed,
  index,
  onSelect,
  onContextMenu,
}: {
  folder: PrivateSpaceFolderResponse
  active: boolean
  expanded: boolean
  visibleTitleLength: number
  disabled: boolean
  dropPlacement: FolderDropPlacement | null
  hiddenWhenCollapsed: boolean
  index: number
  onSelect: () => void
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const displayName = getPrivateSpaceFolderDisplayName(folder.name)
  const displayNameLength = Array.from(displayName).length
  const normalizedTitleLength = Math.min(
    displayNameLength,
    Math.max(1, visibleTitleLength),
  )
  const visibleName = normalizedTitleLength >= displayNameLength
    ? displayName
    : `${Array.from(displayName)
        .slice(0, Math.max(1, normalizedTitleLength - 1))
        .join('')}…`
  const folderCountLength = String(folder.spaceIds.length).length
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `private-folder:${folder.id}`,
    disabled: disabled,
    data: { folderId: folder.id, isSystem: folder.isSystem },
  })
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: `private-folder-sort:${folder.id}`,
    disabled: disabled || folder.isSystem,
    data: {
      dragType: 'private-folder',
      folderId: folder.id,
      overlay: (
        <span
          className={styles.folderDragPreview}
          style={folder.color ? { '--private-folder-color': folder.color } as CSSProperties : undefined}
        >
          <span className={styles.folderIcon}>{folder.icon}</span>
          <span>{displayName}</span>
        </span>
      ),
    },
  })
  const setNodeRef = useCallback((node: HTMLButtonElement | null) => {
    setDroppableRef(node)
    setDraggableRef(node)
  }, [setDraggableRef, setDroppableRef])
  return (
    <span
      className={`${styles.folderChipSlot} ${hiddenWhenCollapsed ? styles.folderChipSlotHidden : ''}`}
      style={{
        '--private-folder-index': index,
        '--private-folder-compact-title-width': `${Math.min(7, displayNameLength)}ch`,
        '--private-folder-full-title-width': `${displayNameLength}ch`,
        '--private-folder-title-width': `${normalizedTitleLength}ch`,
        '--private-folder-count-width': `${Math.max(2, folderCountLength)}ch`,
      } as CSSProperties}
      data-private-folder-slot={folder.id}
      aria-hidden={hiddenWhenCollapsed ? 'true' : undefined}
    >
      <button
      ref={setNodeRef}
      data-private-folder-drag-source
      className={`${styles.folderChip} ${active ? styles.active : ''} ${expanded ? styles.expanded : ''} ${isDragging ? styles.folderDragging : ''} ${dropPlacement === 'before' ? styles.dropBefore : ''} ${dropPlacement === 'after' ? styles.dropAfter : ''}`}
      style={{
        ...(folder.color ? { '--private-folder-color': folder.color } as CSSProperties : {}),
      }}
      type="button"
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      aria-pressed={active}
      tabIndex={hiddenWhenCollapsed ? -1 : undefined}
      title={isDragging ? undefined : folder.name}
    >
      <span className={styles.folderIcon} data-private-folder-icon>
        {folder.isSystem ? <SystemIcon name="message" size={15} /> : folder.icon}
      </span>
      <span className={styles.folderName} data-private-folder-name>{visibleName}</span>
      <small data-private-folder-count>{folder.spaceIds.length}</small>
      </button>
    </span>
  )
}

export function PrivateSpaceFolderRail({
  folders,
  activeFolderId,
  expandedFolderId,
  activeDragFolderId = null,
  overFolderId = null,
  dropPlacement = null,
  collapsed = false,
  disabled = false,
  orientation = 'wrapped',
  onSelect,
  onEdit,
  onDelete,
  onToggleOrderLock,
  onMarkAllRead,
  markAllReadDisabled = false,
}: PrivateSpaceFolderRailProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    folder: PrivateSpaceFolderResponse
  } | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const [showBottomFade, setShowBottomFade] = useState(false)
  const [folderTitleLengths, setFolderTitleLengths] = useState<Map<string, number>>(
    () => new Map(),
  )

  const updateOverflowState = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    setShowBottomFade(
      orientation === 'horizontal'
        ? rail.scrollWidth > rail.clientWidth + 1 &&
          rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1
        : rail.scrollHeight > rail.clientHeight + 1 &&
          rail.scrollTop + rail.clientHeight < rail.scrollHeight - 1,
    )
  }, [orientation])

  useLayoutEffect(() => {
    updateOverflowState()
    const rail = railRef.current
    if (!rail) return undefined
    const observer = new ResizeObserver(updateOverflowState)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [expandedFolderId, folders, updateOverflowState])

  const updateFolderTitleLayout = useCallback(() => {
    if (orientation === 'horizontal') return
    const rail = railRef.current
    if (!rail) return

    const availableWidth = rail.clientWidth
    const railStyle = window.getComputedStyle(rail)
    const gap = Number.parseFloat(railStyle.columnGap || railStyle.gap) || 0
    const nextFolderTitleLengths = new Map<string, number>()
    const visibleFolders = collapsed
      ? folders.filter((folder) => folder.id === activeFolderId)
      : folders
    const measuredFolders = visibleFolders.flatMap((folder) => {
      const slot = rail.querySelector<HTMLElement>(
        `[data-private-folder-slot="${CSS.escape(folder.id)}"]`,
      )
      const button = slot?.querySelector<HTMLButtonElement>(
        '[data-private-folder-drag-source]',
      )
      const icon = slot?.querySelector<HTMLElement>('[data-private-folder-icon]')
      const name = slot?.querySelector<HTMLElement>('[data-private-folder-name]')
      const count = slot?.querySelector<HTMLElement>('[data-private-folder-count]')
      if (!slot || !button || !icon || !name || !count) return []

      const displayName = getPrivateSpaceFolderDisplayName(folder.name)
      const displayNameLength = Array.from(displayName).length
      const buttonStyle = window.getComputedStyle(button)
      const nameStyle = window.getComputedStyle(name)
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) return []
      context.font = nameStyle.font

      const fixedWidth = (
        icon.getBoundingClientRect().width +
        count.getBoundingClientRect().width +
        (Number.parseFloat(buttonStyle.columnGap || buttonStyle.gap) || 0) * 2 +
        (Number.parseFloat(buttonStyle.paddingLeft) || 0) +
        (Number.parseFloat(buttonStyle.paddingRight) || 0) +
        (Number.parseFloat(buttonStyle.borderLeftWidth) || 0) +
        (Number.parseFloat(buttonStyle.borderRightWidth) || 0)
      )
      const characterWidth = context.measureText('0').width
      const compactLength = Math.min(7, displayNameLength)
      const forceFullTitle = folder.id === activeFolderId
      const minimumTitleLength = forceFullTitle
        ? displayNameLength
        : compactLength

      return [{
        id: folder.id,
        characterWidth,
        compactLength,
        fullLength: displayNameLength,
        minimumTitleLength,
        minimumWidth: fixedWidth + characterWidth * minimumTitleLength,
      }]
    })

    let currentRow: typeof measuredFolders = []
    let currentRowWidth = 0
    const finishRow = () => {
      let remainingWidth = availableWidth - currentRowWidth
      const rowTitleLengths = new Map(
        currentRow.map((folder) => [folder.id, folder.minimumTitleLength]),
      )
      let expandedInPass = true
      while (expandedInPass) {
        expandedInPass = false
        for (const folder of currentRow) {
          const currentLength = rowTitleLengths.get(folder.id) ?? folder.compactLength
          if (
            currentLength >= folder.fullLength ||
            folder.characterWidth > remainingWidth + 0.5
          ) {
            continue
          }
          rowTitleLengths.set(folder.id, currentLength + 1)
          remainingWidth -= folder.characterWidth
          expandedInPass = true
        }
      }
      for (const folder of currentRow) {
        nextFolderTitleLengths.set(
          folder.id,
          rowTitleLengths.get(folder.id) ?? folder.minimumTitleLength,
        )
      }
      currentRow = []
      currentRowWidth = 0
    }

    for (const folder of measuredFolders) {
      const nextMinimumWidth = currentRow.length === 0
        ? folder.minimumWidth
        : currentRowWidth + gap + folder.minimumWidth
      if (
        currentRow.length > 0 &&
        nextMinimumWidth > availableWidth + 0.5
      ) {
        finishRow()
      }
      currentRowWidth = currentRow.length === 0
        ? folder.minimumWidth
        : currentRowWidth + gap + folder.minimumWidth
      currentRow.push(folder)
    }
    if (currentRow.length > 0) finishRow()

    setFolderTitleLengths((current) => (
      haveSameFolderTitleLengths(current, nextFolderTitleLengths)
        ? current
        : nextFolderTitleLengths
    ))
  }, [activeFolderId, collapsed, folders, orientation])

  useLayoutEffect(() => {
    if (orientation === 'horizontal') {
      setFolderTitleLengths((current) => (
        current.size === 0 ? current : new Map()
      ))
      return undefined
    }
    updateFolderTitleLayout()
    const rail = railRef.current
    if (!rail) return undefined
    const observer = new ResizeObserver(updateFolderTitleLayout)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [orientation, updateFolderTitleLayout])

  const contextMenuItems: ContextMenuItem[] = contextMenu
    ? [
        {
          type: 'item',
          label: contextMenu.folder.isOrderLocked
            ? privateSpaceFolderCopy.unlockOrder
            : privateSpaceFolderCopy.lockOrder,
          hint: privateSpaceFolderCopy.lockOrderHint,
          icon: contextMenu.folder.isOrderLocked ? 'settings' : 'space',
          selected: contextMenu.folder.isOrderLocked,
          onSelect: () =>
            onToggleOrderLock(
              contextMenu.folder.id,
              !contextMenu.folder.isOrderLocked,
            ),
        },
        ...(contextMenu.folder.isSystem
          ? []
          : ([
              { type: 'separator' },
        {
          type: 'item',
          label: privateSpaceFolderCopy.edit,
          icon: 'settings',
          onSelect: () => onEdit(contextMenu.folder),
        },
        {
          type: 'item',
          label: privateSpaceFolderCopy.delete,
          icon: 'trash',
          danger: true,
          onSelect: () => onDelete(contextMenu.folder.id),
        },
            ] satisfies ContextMenuItem[])),
      ]
    : []

  return (
    <>
      <div className={`${styles.folderRailViewport} ${orientation === 'horizontal' ? styles.horizontal : ''} ${showBottomFade ? styles.hasBottomFade : ''}`}>
      <div
        ref={railRef}
        className={`${styles.folderRail} ${collapsed ? styles.folderRailCollapsed : ''}`}
        aria-label={privateSpaceFolderCopy.conversations}
        onScroll={updateOverflowState}
      >
        <span
          className={`${styles.markAllReadSlot} ${
            onMarkAllRead ? '' : styles.markAllReadSlotHidden
          }`}
          aria-hidden={onMarkAllRead ? undefined : 'true'}
        >
          <button
            className={styles.markAllReadButton}
            type="button"
            title={privateSpaceFolderCopy.readAll}
            aria-label={privateSpaceFolderCopy.readAll}
            disabled={!onMarkAllRead || markAllReadDisabled}
            tabIndex={onMarkAllRead ? undefined : -1}
            onClick={onMarkAllRead}
          >
            <SystemIcon name="check" size={15} />
          </button>
        </span>
        {folders.map((folder, index) => (
          <FolderChip
            key={folder.id}
            folder={folder}
            active={folder.id === activeFolderId}
            expanded={folder.id === expandedFolderId}
            visibleTitleLength={
              orientation === 'horizontal' ||
              folder.id === activeFolderId
                ? Array.from(getPrivateSpaceFolderDisplayName(folder.name)).length
                : folderTitleLengths.get(folder.id) ??
                  Math.min(
                    7,
                    Array.from(getPrivateSpaceFolderDisplayName(folder.name)).length,
                  )
            }
            disabled={disabled}
            dropPlacement={
              folder.id === overFolderId && folder.id !== activeDragFolderId
                ? dropPlacement
                : null
            }
            hiddenWhenCollapsed={collapsed && folder.id !== activeFolderId}
            index={index}
            onSelect={() => onSelect(folder.id)}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setContextMenu({ x: event.clientX, y: event.clientY, folder })
            }}
          />
        ))}
      </div>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
