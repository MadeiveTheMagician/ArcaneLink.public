import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import type { MessageSearchFilters } from '../../hooks/useMessageSearch'
import { SystemIcon } from '../../icons/SystemIcon'
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
  const rootRef = useRef<HTMLDivElement | null>(null)
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
        rootRef.current?.contains(event.target)
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

  function openMode(nextMode: SearchMode) {
    setMode(nextMode)
    setIsOpen(true)
    window.requestAnimationFrame(() => inputRef.current?.focus())
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

    if (event.key === 'Escape') {
      setIsOpen(false)
      setMode('root')
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
    setMode('root')
    setIsOpen(false)
    window.requestAnimationFrame(() => inputRef.current?.focus())
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
    <div ref={rootRef} className={styles.wrap}>
      <div className={styles.shell}>
        <span className={styles.icon} aria-hidden="true">
          <SystemIcon name="search" size={16} />
          ⌕
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
            value={query}
            placeholder={hasSelectedFilters ? '' : placeholder}
            onChange={handleInputChange}
            onClick={openRootMenu}
            onFocus={openRootMenu}
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

      {isOpen && (
        <div
          className={styles.menu}
          role="listbox"
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
        </div>
      )}
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
