import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { MessageSearchFilters } from '../../hooks/useMessageSearch'
import { SystemIcon } from '../../icons/SystemIcon'
import {
  resolveSystemSelectPopupPosition,
  type SystemSelectPopupPosition,
} from '../../ui/systemSelectModel'
import { messageSearchCopy } from './messageSearch.copy.ts'
import styles from './MessageSearchControl.module.css'

export type MessageSearchUserOption = {
  id: string
  displayName: string
  login?: string | null
  avatarAssetId?: string | null
  avatarCropOffsetX?: number
  avatarCropOffsetY?: number
  avatarCropZoom?: number
}

export type MessageSearchSpaceOption = {
  id: string
  title: string
  icon?: string
}

type MessageSearchControlProps = {
  name: string
  ariaLabel: string
  autoFocus?: boolean
  openFiltersOnFocus?: boolean
  query: string
  filters: MessageSearchFilters
  userOptions: MessageSearchUserOption[]
  spaceOptions?: MessageSearchSpaceOption[]
  placeholder?: string
  actions?: ReactNode
  onQueryChange: (query: string) => void
  onFiltersChange: (updater: (current: MessageSearchFilters) => MessageSearchFilters) => void
  onSubmit: (filterOverride?: MessageSearchFilters | null) => void
  onClear?: () => void
}

type SearchMode = 'root' | 'sender' | 'space' | 'attachment'

const searchTabStops = 'input, button:not([disabled]), a[href], [tabindex="0"]'

const attachmentOptions = [
  { value: 'image', label: messageSearchCopy.attachments.image, icon: '▧' },
  { value: 'video', label: messageSearchCopy.attachments.video, icon: '■' },
  { value: 'audio', label: messageSearchCopy.attachments.audio, icon: '◔' },
  { value: 'file', label: messageSearchCopy.attachments.file, icon: '◻' },
  { value: 'any', label: messageSearchCopy.attachments.any, icon: '▣' },
]

export function MessageSearchControl({
  name,
  ariaLabel,
  autoFocus = false,
  openFiltersOnFocus = true,
  query,
  filters,
  userOptions,
  spaceOptions = [],
  placeholder = messageSearchCopy.placeholder,
  actions,
  onQueryChange,
  onFiltersChange,
  onSubmit,
  onClear,
}: MessageSearchControlProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<SearchMode>('root')
  const [menuPosition, setMenuPosition] = useState<SystemSelectPopupPosition | null>(null)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const afterMenuRef = useRef<HTMLSpanElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectedUser = userOptions.find((user) => user.id === filters.senderUserId)
  const selectedSpace = spaceOptions.find((space) => space.id === filters.spaceId)
  const selectedAttachment = attachmentOptions.find(
    (item) => item.value === filters.attachmentType,
  )
  const hasSelectedFilters = Boolean(
    selectedUser || selectedSpace || selectedAttachment,
  )

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        (rootRef.current?.contains(event.target) ||
          menuRef.current?.contains(event.target))
      ) {
        return
      }

      setIsOpen(false)
      setMode('root')
      inputRef.current?.blur()
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown)
    }
  }, [isOpen])

  useLayoutEffect(() => {
    const anchor = rootRef.current
    const menu = menuRef.current
    if (!isOpen || !anchor || !menu) return

    const viewport = window.visualViewport
    function updatePosition() {
      if (!anchor || !menu) return
      const rect = anchor.getBoundingClientRect()
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportWidth = viewport?.width ?? document.documentElement.clientWidth
      const viewportHeight = viewport?.height ?? window.innerHeight
      if (
        rect.width === 0 || rect.height === 0 ||
        rect.right <= viewportLeft || rect.left >= viewportLeft + viewportWidth ||
        rect.bottom <= viewportTop || rect.top >= viewportTop + viewportHeight
      ) {
        setMenuPosition(null)
        return
      }

      const position = resolveSystemSelectPopupPosition({
        trigger: {
          top: rect.top - viewportTop,
          bottom: rect.bottom - viewportTop,
          left: rect.left - viewportLeft,
          width: rect.width,
        },
        viewportWidth,
        viewportHeight,
        contentHeight: menu.scrollHeight + menu.offsetHeight - menu.clientHeight,
        gap: 8,
        maxHeight: 560,
        minWidth: 360,
        align: 'end',
      })
      setMenuPosition({
        ...position,
        left: position.left + viewportLeft,
        top: position.top + viewportTop,
      })
    }

    updatePosition()
    const resizeObserver = new ResizeObserver(updatePosition)
    resizeObserver.observe(anchor)
    resizeObserver.observe(menu)
    document.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    viewport?.addEventListener('resize', updatePosition)
    viewport?.addEventListener('scroll', updatePosition)

    return () => {
      resizeObserver.disconnect()
      document.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
      viewport?.removeEventListener('resize', updatePosition)
      viewport?.removeEventListener('scroll', updatePosition)
    }
  }, [isOpen, mode, userOptions.length, spaceOptions.length])

  function closeMenu() {
    setMode('root')
    setIsOpen(false)
  }

  function handleTriggerTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.key !== 'Tab' || event.shiftKey || !isOpen) return
    const tabStops = rootRef.current?.querySelectorAll<HTMLElement>(searchTabStops)
    const menuButton = menuRef.current?.querySelector('button')
    if (menuButton && event.target === tabStops?.[tabStops.length - 1]) {
      event.preventDefault()
      menuButton.focus()
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const active = buttons.findIndex((button) => button === event.target)

    if (event.key === 'Escape') {
      event.preventDefault()
      inputRef.current?.focus()
      closeMenu()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      buttons[(active + direction + buttons.length) % buttons.length]?.focus()
    } else if (event.key === 'Tab' && event.shiftKey && active === 0) {
      event.preventDefault()
      const tabStops = rootRef.current?.querySelectorAll<HTMLElement>(searchTabStops)
      tabStops?.[tabStops.length - 1]?.focus()
    } else if (event.key === 'Tab' && !event.shiftKey && active === buttons.length - 1) {
      // Continue keyboard navigation after the search control in DOM order.
      afterMenuRef.current?.focus({ preventScroll: true })
      closeMenu()
    }
  }

  function openMode(nextMode: SearchMode) {
    inputRef.current?.focus()
    setMode(nextMode)
    setIsOpen(true)
  }

  function openRootMenu() {
    setIsOpen(true)
    setMode('root')
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onQueryChange(event.target.value)
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (mode === 'attachment' && !filters.attachmentType) {
        const nextFilters = {
          ...filters,
          attachmentType: 'any',
        }

        onFiltersChange(() => nextFilters)
        setMode('root')
        setIsOpen(false)
        onSubmit(nextFilters)
        return
      }

      setIsOpen(false)
      onSubmit()
      return
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      closeMenu()
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const focusFirst = event.key === 'ArrowDown'
      const focusOption = () => {
        const buttons = menuRef.current?.querySelectorAll('button')
        const index = focusFirst ? 0 : (buttons?.length ?? 0) - 1
        buttons?.[index]?.focus()
      }
      if (isOpen) {
        focusOption()
      } else {
        openRootMenu()
        window.requestAnimationFrame(focusOption)
      }
    }
  }

  function keepFocus(event: MouseEvent<HTMLElement>) {
    event.preventDefault()
  }

  function setFilter(key: keyof MessageSearchFilters, value: string) {
    onFiltersChange((current) => ({
      ...current,
      [key]: value,
    }))
    inputRef.current?.focus()
    closeMenu()
  }

  function clearFilter(key: keyof MessageSearchFilters) {
    onFiltersChange((current) => ({
      ...current,
      [key]: '',
    }))
  }

  function clearAll() {
    onQueryChange('')
    onFiltersChange((current) => ({
      ...current,
      senderUserId: '',
      spaceId: '',
      attachmentType: '',
    }))
    setMode('root')
    setIsOpen(false)
    onClear?.()
  }

  return (
    <div ref={rootRef} className={styles.wrap} onKeyDown={handleTriggerTab}>
      <div className={styles.shell}>
        <span className={styles.icon} aria-hidden="true">
          <SystemIcon name="search" size={16} />
        </span>
        <div className={styles.field}>
          {selectedUser && (
            <button
              className={styles.chip}
              type="button"
              onClick={() => clearFilter('senderUserId')}
            >
              {messageSearchCopy.chips.sender(selectedUser.displayName)}
            </button>
          )}
          {selectedSpace && (
            <button
              className={styles.chip}
              type="button"
              onClick={() => clearFilter('spaceId')}
            >
              {messageSearchCopy.chips.space(selectedSpace.title)}
            </button>
          )}
          {selectedAttachment && (
            <button
              className={styles.chip}
              type="button"
              onClick={() => clearFilter('attachmentType')}
            >
              {messageSearchCopy.chips.attachment(selectedAttachment.label)}
            </button>
          )}
          {mode !== 'root' && isOpen && (
            <span className={styles.prefix}>{getModePrefix(mode)}</span>
          )}
          <input
            ref={inputRef}
            name={name}
            aria-label={ariaLabel}
            aria-controls={isOpen ? menuId : undefined}
            value={query}
            placeholder={hasSelectedFilters ? '' : placeholder}
            onChange={handleInputChange}
            onClick={openRootMenu}
            autoFocus={autoFocus}
            onFocus={openFiltersOnFocus ? openRootMenu : undefined}
            onKeyDown={handleInputKeyDown}
          />
        </div>
        <span className={styles.clearSlot}>
          {(query || hasSelectedFilters) && (
            <button
              className={styles.clearButton}
              type="button"
              aria-label={messageSearchCopy.aria.clear}
              onClick={clearAll}
            >
              <SystemIcon name="close" size={16} />
            </button>
          )}
        </span>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          className={styles.menu}
          role="listbox"
          aria-label={ariaLabel}
          data-placement={menuPosition?.placement}
          data-dismissable-layer-branch="true"
          style={menuPosition
            ? {
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
            }
            : { visibility: 'hidden' }}
          onKeyDown={handleMenuKeyDown}
          onMouseDown={keepFocus}
        >
          {mode === 'root' ? (
            <RootMenu
              hasSpaceOptions={spaceOptions.length > 0}
              onOpenMode={openMode}
            />
          ) : mode === 'sender' ? (
            <UserMenu users={userOptions} onSelect={(id) => setFilter('senderUserId', id)} />
          ) : mode === 'space' ? (
            <SpaceMenu spaces={spaceOptions} onSelect={(id) => setFilter('spaceId', id)} />
          ) : (
            <AttachmentMenu
              onSelect={(value) => setFilter('attachmentType', value)}
            />
          )}
        </div>,
        document.body,
      )}
      <span ref={afterMenuRef} tabIndex={-1} className={styles.tabAnchor} />
    </div>
  )
}

function RootMenu({
  hasSpaceOptions,
  onOpenMode,
}: {
  hasSpaceOptions: boolean
  onOpenMode: (mode: SearchMode) => void
}) {
  return (
    <>
      <strong className={styles.menuTitle}>
        {messageSearchCopy.filters.menuTitle}
      </strong>
      <button type="button" onClick={() => onOpenMode('sender')}>
        <span className={styles.optionIcon}>♟</span>
        <span>
          <strong className={styles.filterDescription}>
            {messageSearchCopy.filters.senderDescription}
          </strong>
          <small className={styles.filterTag}>
            {messageSearchCopy.filters.senderTag}
          </small>
        </span>
      </button>
      {hasSpaceOptions && (
        <button type="button" onClick={() => onOpenMode('space')}>
          <span className={styles.optionIcon}>#</span>
          <span>
            <strong className={styles.filterDescription}>
              {messageSearchCopy.filters.spaceDescription}
            </strong>
            <small className={styles.filterTag}>
              {messageSearchCopy.filters.spaceTag}
            </small>
          </span>
        </button>
      )}
      <button type="button" onClick={() => onOpenMode('attachment')}>
        <span className={styles.optionIcon}>↗</span>
        <span>
          <strong className={styles.filterDescription}>
            {messageSearchCopy.filters.attachmentDescription}
          </strong>
          <small className={styles.filterTag}>
            {messageSearchCopy.filters.attachmentTag}
          </small>
        </span>
      </button>
    </>
  )
}

function UserMenu({
  users,
  onSelect,
}: {
  users: MessageSearchUserOption[]
  onSelect: (id: string) => void
}) {
  return (
    <>
      <strong className={styles.menuTitle}>
        {messageSearchCopy.menu.senderTitle}
      </strong>
      {users.map((user) => (
        <button key={user.id} type="button" onClick={() => onSelect(user.id)}>
          <UserAvatar user={user} />
          <span>
            <strong>{user.displayName}</strong>
            {user.login && <small>{user.login}</small>}
          </span>
        </button>
      ))}
    </>
  )
}

function SpaceMenu({
  spaces,
  onSelect,
}: {
  spaces: MessageSearchSpaceOption[]
  onSelect: (id: string) => void
}) {
  return (
    <>
      <strong className={styles.menuTitle}>
        {messageSearchCopy.menu.spaceTitle}
      </strong>
      {spaces.map((space) => (
        <button key={space.id} type="button" onClick={() => onSelect(space.id)}>
          <span className={styles.optionIcon}>{space.icon ?? '#'}</span>
          <span>
            <strong>{space.title}</strong>
          </span>
        </button>
      ))}
    </>
  )
}

function AttachmentMenu({
  onSelect,
}: {
  onSelect: (value: string) => void
}) {
  return (
    <>
      <strong className={styles.menuTitle}>
        {messageSearchCopy.menu.attachmentTitle}
      </strong>
      {attachmentOptions.map((item) => (
        <button key={item.value} type="button" onClick={() => onSelect(item.value)}>
          <span className={styles.optionIcon}>{item.icon}</span>
          <span>
            <strong>{item.label}</strong>
          </span>
        </button>
      ))}
    </>
  )
}

function UserAvatar({ user }: { user: MessageSearchUserOption }) {
  const avatarUrl = user.avatarAssetId
    ? `/api/assets/${user.avatarAssetId}/content`
    : null

  return (
    <span className={styles.avatar} aria-hidden="true">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{
            transform: `translate(${(user.avatarCropOffsetX ?? 0) * 100}%, ${
              (user.avatarCropOffsetY ?? 0) * 100
            }%) scale(${user.avatarCropZoom ?? 1})`,
          }}
        />
      ) : (
        user.displayName.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}

function getModePrefix(mode: SearchMode) {
  if (mode === 'sender') {
    return messageSearchCopy.prefix.sender
  }

  if (mode === 'space') {
    return messageSearchCopy.prefix.space
  }

  return messageSearchCopy.prefix.attachment
}
