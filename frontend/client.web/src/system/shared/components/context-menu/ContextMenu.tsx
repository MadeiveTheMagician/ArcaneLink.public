import {
  useId,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  resolveContextMenuHeight,
  resolveContextMenuPlacement,
} from '../../services/contextMenuPositioning'
import { SystemIcon, type SystemIconName } from '../../icons/SystemIcon'
import {
  getContextMenuItemKey,
  type ContextMenuIcon,
  type ContextMenuItem,
} from './contextMenuTypes'
import styles from './ContextMenu.module.css'

export type { ContextMenuIcon, ContextMenuItem } from './contextMenuTypes'

type ContextMenuProps = {
  x: number
  y: number
  items: ContextMenuItem[]
  autoFocus?: boolean
  onClose: () => void
}

export function ContextMenuPositioningLayer() {
  return <div className={styles.positioningLayer} aria-hidden="true" />
}

const menuIconNames: Record<ContextMenuIcon, SystemIconName> = {
  audio: 'speaker',
  block: 'block',
  call: 'phone-call',
  copy: 'copy',
  edit: 'edit',
  friend: 'user-plus',
  invite: 'user-plus',
  leave: 'leave',
  message: 'message',
  profile: 'user',
  report: 'flag',
  role: 'lock',
  settings: 'settings',
  space: 'pin',
  trash: 'trash',
  video: 'video',
}

function ContextMenuRangeRow({
  item,
}: {
  item: Extract<ContextMenuItem, { type: 'range' }>
}) {
  return (
    <label className={styles.rangeRow}>
      <span className={styles.rangeLabel}>
        {item.icon && <SystemIcon name={menuIconNames[item.icon]} size={18} />}
        <strong>{item.label}</strong>
        <em>{item.valueLabel ?? item.value}</em>
      </span>
      <input
        type="range"
        min={item.min}
        max={item.max}
        step={item.step}
        value={item.value}
        disabled={item.disabled}
        aria-label={item.label}
        onChange={(event) => item.onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}

function ContextMenuRow({
  item,
  onClose,
  buttonTabIndex,
  onButtonRef,
  onButtonKeyDown,
}: {
  item: Extract<ContextMenuItem, { type: 'item' }>
  onClose: () => void
  buttonTabIndex?: number
  onButtonRef?: (button: HTMLButtonElement | null) => void
  onButtonKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
}) {
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false)
  const [submenuPlacement, setSubmenuPlacement] = useState<{
    left: number
    top: number
    openLeft: boolean
  } | null>(null)
  const submenuId = useId()
  const hintId = useId()
  const rowWrapRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const submenuRef = useRef<HTMLDivElement | null>(null)
  const closeTimeoutRef = useRef<number | null>(null)
  const hasVisualLabel = item.visualLabel != null

  function clearCloseTimeout() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  function openSubmenu() {
    if (!item.submenu || item.disabled) {
      return
    }

    clearCloseTimeout()
    setIsSubmenuOpen(true)
  }

  function focusFirstSubmenuItem() {
    window.requestAnimationFrame(() => {
      submenuRef.current
        ?.querySelector<HTMLButtonElement>(
          '[data-context-menu-item]:not(:disabled)',
        )
        ?.focus()
    })
  }

  function openAndFocusSubmenu() {
    openSubmenu()
    focusFirstSubmenuItem()
  }

  function scheduleSubmenuClose() {
    clearCloseTimeout()
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsSubmenuOpen(false)
      closeTimeoutRef.current = null
    }, 180)
  }

  useEffect(
    () => () => {
      clearCloseTimeout()
    },
    [],
  )

  useLayoutEffect(() => {
    if (!isSubmenuOpen) {
      return
    }

    function updateSubmenuPosition() {
      const row = rowWrapRef.current
      const submenu = submenuRef.current
      if (!row || !submenu) {
        return
      }

      const gutter = 8
      const rowBounds = row.getBoundingClientRect()
      const submenuBounds = submenu.getBoundingClientRect()
      const openLeft =
        rowBounds.right + gutter + submenuBounds.width + gutter >
        window.innerWidth
      const maxLeft = Math.max(
        gutter,
        window.innerWidth - submenuBounds.width - gutter,
      )
      const left = Math.min(
        Math.max(
          openLeft
            ? rowBounds.left - submenuBounds.width - gutter
            : rowBounds.right + gutter,
          gutter,
        ),
        maxLeft,
      )
      const maxTop = Math.max(
        gutter,
        window.innerHeight - submenuBounds.height - gutter,
      )
      const top = Math.min(
        Math.max(rowBounds.top - 10, gutter),
        maxTop,
      )

      setSubmenuPlacement((current) =>
        current &&
        Math.abs(current.left - left) < 0.5 &&
        Math.abs(current.top - top) < 0.5 &&
        current.openLeft === openLeft
          ? current
          : { left, top, openLeft },
      )
    }

    updateSubmenuPosition()
    window.addEventListener('resize', updateSubmenuPosition)
    window.addEventListener('scroll', updateSubmenuPosition, true)

    return () => {
      window.removeEventListener('resize', updateSubmenuPosition)
      window.removeEventListener('scroll', updateSubmenuPosition, true)
    }
  }, [isSubmenuOpen])

  function handleSelect() {
    if (item.disabled) {
      return
    }

    if (item.submenu) {
      openAndFocusSubmenu()
      return
    }

    item.onSelect?.()
    onClose()
  }

  return (
    <div
      ref={rowWrapRef}
      className={styles.rowWrap}
      onMouseEnter={openSubmenu}
      onMouseLeave={scheduleSubmenuClose}
      onFocus={openSubmenu}
      onBlur={scheduleSubmenuClose}
    >
      <button
        ref={(button) => {
          buttonRef.current = button
          onButtonRef?.(button)
        }}
        className={`${styles.row} profile-context-menu-row ${
          item.danger ? styles.danger : ''
        } ${item.compact ? styles.compactRow : ''}`}
        type="button"
        tabIndex={buttonTabIndex}
        data-context-menu-item="true"
        onClick={handleSelect}
        onKeyDown={(event) => {
          if (item.submenu && event.key === 'ArrowRight') {
            event.preventDefault()
            openAndFocusSubmenu()
            return
          }

          onButtonKeyDown?.(event)
        }}
        disabled={item.disabled}
        aria-label={hasVisualLabel ? item.label : undefined}
        aria-describedby={item.hint ? hintId : undefined}
        aria-pressed={item.selected}
        aria-controls={item.submenu ? submenuId : undefined}
        aria-expanded={item.submenu ? isSubmenuOpen : undefined}
      >
        {!item.compact && (
          <span>
            {item.icon && (
              <SystemIcon
                name={menuIconNames[item.icon]}
                size={18}
                tone={item.danger ? 'danger' : 'default'}
              />
            )}
          </span>
        )}
        <strong aria-hidden={hasVisualLabel ? 'true' : undefined}>
          {item.visualLabel ?? item.label}
        </strong>
        {(item.submenu || item.selected) && (
          <em aria-hidden="true">
            <SystemIcon
              name={item.submenu ? 'chevron-right' : 'check'}
              size={14}
            />
          </em>
        )}
      </button>

      {item.hint && !item.submenu && (
        <span
          className={styles.hint}
          id={hintId}
          role="tooltip"
        >
          {item.hint}
        </span>
      )}

      {item.submenu && isSubmenuOpen && createPortal(
        <div
          ref={submenuRef}
          id={submenuId}
          role="group"
          aria-label={item.label}
          data-context-menu-submenu-root="true"
          className={`${styles.submenu} ${
            item.submenuLayout === 'grid' ? styles.submenuGrid : ''
          } ${submenuPlacement?.openLeft ? styles.submenuOpenLeft : ''}`}
          style={
            submenuPlacement
              ? { left: submenuPlacement.left, top: submenuPlacement.top }
              : { left: 0, top: 0, visibility: 'hidden' }
          }
          onMouseEnter={clearCloseTimeout}
          onMouseLeave={scheduleSubmenuClose}
          onFocusCapture={clearCloseTimeout}
          onBlurCapture={scheduleSubmenuClose}
        >
          <ContextMenuList
            items={item.submenu}
            layout={item.submenuLayout}
            onExit={() => buttonRef.current?.focus()}
            onClose={onClose}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}

function ContextMenuList({
  items,
  onClose,
  layout = 'list',
  onExit,
}: {
  items: ContextMenuItem[]
  onClose: () => void
  layout?: 'list' | 'grid'
  onExit?: () => void
}) {
  const [activeGridIndex, setActiveGridIndex] = useState(0)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const gridItemCount = items.filter((item) => item.type === 'item').length

  function focusGridItem(index: number) {
    const nextIndex = Math.min(Math.max(index, 0), gridItemCount - 1)
    setActiveGridIndex(nextIndex)
    const button = buttonRefs.current[nextIndex]
    button?.focus()
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  function handleGridKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const columns = 6
    let nextIndex: number

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = Math.min(index + 1, gridItemCount - 1)
        break
      case 'ArrowLeft':
        if (index % columns === 0) {
          event.preventDefault()
          onExit?.()
          return
        }
        nextIndex = index - 1
        break
      case 'ArrowDown':
        nextIndex = Math.min(index + columns, gridItemCount - 1)
        break
      case 'ArrowUp':
        if (index < columns) {
          event.preventDefault()
          onExit?.()
          return
        }
        nextIndex = index - columns
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = gridItemCount - 1
        break
      default:
        return
    }

    event.preventDefault()
    focusGridItem(nextIndex)
  }

  return (
    <>
      {items.map((item, index) => {
        if (item.type === 'separator') {
          return (
          <div
            key={getContextMenuItemKey(item, index)}
            className={styles.separator}
          />
          )
        }

        if (item.type === 'range') {
          return (
            <ContextMenuRangeRow
              key={getContextMenuItemKey(item, index)}
              item={item}
            />
          )
        }

        const currentGridIndex = items
          .slice(0, index)
          .filter((candidate) => candidate.type === 'item').length
        return (
          <ContextMenuRow
            key={getContextMenuItemKey(item, index)}
            item={item}
            buttonTabIndex={
              layout === 'grid'
                ? currentGridIndex === activeGridIndex
                  ? 0
                  : -1
                : undefined
            }
            onButtonRef={(button) => {
              buttonRefs.current[currentGridIndex] = button
            }}
            onButtonKeyDown={
              layout === 'grid'
                ? (event) =>
                    handleGridKeyDown(event, currentGridIndex)
                : undefined
            }
            onClose={onClose}
          />
        )
      })}
    </>
  )
}

function countVisibleRows(items: ContextMenuItem[]) {
  return items.reduce(
    (count, item) =>
      count + (item.type === 'separator' ? 0.4 : item.type === 'range' ? 1.5 : 1),
    0,
  )
}

export function ContextMenu({
  x,
  y,
  items,
  autoFocus = false,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const estimatedRowsRef = useRef(countVisibleRows(items))
  const [position, setPosition] = useState({
    left: x,
    top: y,
    maxHeight: 180,
    row: 1,
    column: 4,
    openSubmenuLeft: false,
  })

  useEffect(() => {
    function closeFromOutside(event: PointerEvent | MouseEvent) {
      if (
        event.target instanceof Node && (
          menuRef.current?.contains(event.target) ||
          (event.target instanceof Element &&
            event.target.closest('[data-context-menu-submenu-root="true"]'))
        )
      ) {
        return
      }

      onClose()
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('pointerdown', closeFromOutside, true)
    document.addEventListener('contextmenu', closeFromOutside, true)
    window.addEventListener('keydown', closeFromKeyboard)

    return () => {
      document.removeEventListener('pointerdown', closeFromOutside, true)
      document.removeEventListener('contextmenu', closeFromOutside, true)
      window.removeEventListener('keydown', closeFromKeyboard)
    }
  }, [onClose])

  useLayoutEffect(() => {
    if (!autoFocus) {
      return
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    menuRef.current
      ?.querySelector<HTMLButtonElement>(
        '[data-context-menu-item]:not(:disabled)',
      )
      ?.focus()

    return () => {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [autoFocus])

  useLayoutEffect(() => {
    function updatePosition() {
      const menu = menuRef.current
      const width = menu?.offsetWidth ?? 290
      const height = resolveContextMenuHeight({
        renderedHeight: menu?.offsetHeight,
        contentHeight: menu?.scrollHeight,
        estimatedHeight: Math.min(
          520,
          estimatedRowsRef.current * 48 + 24,
        ),
        viewportHeight: window.innerHeight,
      })
      const submenuWidth = 274
      const nextPosition = resolveContextMenuPlacement({
        x,
        y,
        menuWidth: width,
        menuHeight: height,
        submenuWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })

      setPosition((current) =>
        current.left === nextPosition.left &&
        current.top === nextPosition.top &&
        current.maxHeight === nextPosition.maxHeight &&
        current.row === nextPosition.row &&
        current.column === nextPosition.column &&
        current.openSubmenuLeft === nextPosition.openSubmenuLeft
          ? current
          : nextPosition,
      )
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)

    return () => window.removeEventListener('resize', updatePosition)
  }, [x, y])

  const style = {
    left: position.left,
    top: position.top,
    '--profile-context-max-height': `${position.maxHeight}px`,
  } as CSSProperties

  return createPortal((
    <div
      ref={menuRef}
      className={`${styles.menu} ${
        position.openSubmenuLeft ? styles.submenuLeft : ''
      }`}
      data-context-row={position.row}
      data-context-column={position.column}
      data-context-menu-root="true"
      style={style}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <ContextMenuList items={items} onClose={onClose} />
    </div>
  ), document.body)
}
