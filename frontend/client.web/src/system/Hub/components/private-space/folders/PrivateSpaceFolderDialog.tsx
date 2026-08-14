import { useEffect, useMemo, useState } from 'react'
import type {
  PrivateSpaceFolderResponse,
  PrivateSpaceResponse,
  UpsertPrivateSpaceFolderRequest,
} from '../../../../../shared/types'
import { SelectedFrame } from '../../../../shared/components/selected-frame/SelectedFrame'
import { SystemCloseIcon } from '../../../../shared/icons/components/SystemCloseIcon'
import { SystemIcon } from '../../../../shared/icons/SystemIcon'
import { SystemButton } from '../../../../shared/ui/SystemButton'
import { PresenceName } from '../../../../shared'
import {
  getPrivateSpacePresenceStatus,
  getPrivateSpaceTitle,
} from '../../direct-messages/directMessageModel'
import { PrivateSpaceAvatar } from '../../direct-messages/DirectMessageAvatar'
import { privateSpaceFolderCopy } from './privateSpaceFolderCopy.ru'
import { privateSpaceFolderNameMaxLength } from './privateSpaceFolderModel'
import styles from './PrivateSpaceFolders.module.css'

const emojiOptions = [
  '💬', '⭐', '🎮', '💼', '🎨', '📚',
  '🎵', '🗃️', '❤️', '🧭', '📷', '🎬',
  '🛠️', '💡', '🏠', '🌐', '🏆', '🔒',
  '📌', '🚀', '☕', '🧪', '🎯', '✨',
] as const

const colorOptions = [
  '#8f6bff', '#5b75f2', '#3d8fe8', '#31a9d8',
  '#2ebf91', '#66b86b', '#f0b34f', '#ed8b4a',
  '#ec6f91', '#df5d62', '#b878e8', '#8d9ab8',
] as const

type Props = {
  currentUserId: string
  folder: PrivateSpaceFolderResponse | null
  privateSpaces: PrivateSpaceResponse[]
  isSaving: boolean
  error: string | null
  onClose: () => void
  onSave: (request: UpsertPrivateSpaceFolderRequest) => Promise<unknown>
}

export function PrivateSpaceFolderDialog({
  currentUserId,
  folder,
  privateSpaces,
  isSaving,
  error,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(
    (folder?.name ?? '').slice(0, privateSpaceFolderNameMaxLength),
  )
  const [icon, setIcon] = useState(folder?.icon ?? emojiOptions[0])
  const [color, setColor] = useState<string | null>(folder?.color ?? null)
  const [spaceIds, setSpaceIds] = useState<string[]>(folder?.spaceIds ?? [])
  const [conversationQuery, setConversationQuery] = useState('')
  const visiblePrivateSpaces = useMemo(() => {
    const normalizedQuery = conversationQuery.trim().toLocaleLowerCase('ru-RU')
    if (!normalizedQuery) return privateSpaces

    return privateSpaces.filter((space) =>
      getPrivateSpaceTitle(space, currentUserId)
        .toLocaleLowerCase('ru-RU')
        .includes(normalizedQuery),
    )
  }, [conversationQuery, currentUserId, privateSpaces])

  useEffect(() => {
    const closeByEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', closeByEscape)
    return () => window.removeEventListener('keydown', closeByEscape)
  }, [onClose])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await onSave({ name: name.trim(), icon, color, spaceIds })
  }

  return (
    <div className={styles.dialogOverlay} role="presentation" onMouseDown={onClose}>
      <form className={styles.dialog} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{folder ? privateSpaceFolderCopy.edit : privateSpaceFolderCopy.create}</h2>
          <SystemButton
            variant="asset"
            size="small"
            type="button"
            onClick={onClose}
            aria-label={privateSpaceFolderCopy.cancel}
          >
            <SystemCloseIcon size="medium" />
          </SystemButton>
        </header>

        <label className={styles.nameField}>
          <span>{privateSpaceFolderCopy.name}</span>
          <input
            value={name}
            maxLength={privateSpaceFolderNameMaxLength}
            placeholder={privateSpaceFolderCopy.namePlaceholder}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <fieldset>
          <legend>{privateSpaceFolderCopy.icon}</legend>
          <div className={styles.optionRow}>
            {emojiOptions.map((option) => (
              <button
                key={option}
                className={icon === option ? styles.selectedOption : ''}
                type="button"
                onClick={() => setIcon(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{privateSpaceFolderCopy.color}</legend>
          <div className={styles.optionRow}>
            <button
              className={`${styles.colorOption} ${styles.noColorOption} ${color === null ? styles.selectedOption : ''}`}
              type="button"
              title={privateSpaceFolderCopy.noColor}
              onClick={() => setColor(null)}
            />
            {colorOptions.map((option) => (
              <button
                key={option}
                className={`${styles.colorOption} ${color === option ? styles.selectedOption : ''}`}
                style={{ background: option }}
                type="button"
                title={option}
                onClick={() => setColor(option)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.conversationFieldset}>
          <legend>{privateSpaceFolderCopy.conversations}</legend>
          <label className={styles.conversationSearch}>
            <SystemIcon name="search" size={16} />
            <input
              value={conversationQuery}
              placeholder={privateSpaceFolderCopy.conversationSearch}
              onChange={(event) => setConversationQuery(event.target.value)}
            />
          </label>
          <div className={`${styles.conversationList} ui-scrollbar-none`}>
            {privateSpaces.length === 0 ? (
              <p>{privateSpaceFolderCopy.emptyConversations}</p>
            ) : visiblePrivateSpaces.length === 0 ? (
              <p>{privateSpaceFolderCopy.noSearchResults}</p>
            ) : visiblePrivateSpaces.map((space) => {
              const title = getPrivateSpaceTitle(space, currentUserId)
              const presenceStatus = getPrivateSpacePresenceStatus(
                space,
                currentUserId,
              )
              const checked = spaceIds.includes(space.spaceId)
              return (
                <SelectedFrame
                  key={space.spaceId}
                  checked={checked}
                  onChange={(nextChecked) => setSpaceIds((current) =>
                    nextChecked
                      ? [...current, space.spaceId]
                      : current.filter((id) => id !== space.spaceId),
                  )}
                >
                  <span className={styles.conversationOption}>
                    <PrivateSpaceAvatar
                      className={styles.dialogAvatar}
                      space={space}
                      currentUserId={currentUserId}
                      title={title}
                    />
                    <PresenceName status={presenceStatus}>
                      <span className="ui-ellipsis">{title}</span>
                    </PresenceName>
                  </span>
                </SelectedFrame>
              )
            })}
          </div>
        </fieldset>

        {error && <p className={styles.error}>{privateSpaceFolderCopy.invalidFolder}</p>}
        <footer>
          <SystemButton variant="ghost" size="small" type="button" onClick={onClose}>
            {privateSpaceFolderCopy.cancel}
          </SystemButton>
          <SystemButton size="small" type="submit" disabled={isSaving || !name.trim()}>
            {privateSpaceFolderCopy.save}
          </SystemButton>
        </footer>
      </form>
    </div>
  )
}
