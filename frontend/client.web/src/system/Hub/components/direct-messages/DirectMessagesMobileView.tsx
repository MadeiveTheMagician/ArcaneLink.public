import {
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import type {
  PrivateSpaceResponse,
  PrivateSpaceMemberResponse,
  PrivateSpaceFolderResponse,
} from '../../../../shared/types'
import { communityCopy } from '../../../shared/copy/community.ru'
import { SystemPlusIcon } from '../../../shared/icons/components/SystemPlusIcon'
import { SystemIcon } from '../../../shared/icons/SystemIcon'
import type { useMessageSearch } from '../../../shared/hooks/useMessageSearch'
import { DirectMessageList } from './DirectMessageList'
import { useMobileDirectMessageList } from './useMobileDirectMessageList'
import { PrivateSpaceFolderRail } from '../private-space/folders/PrivateSpaceFolderRail'
import { PrivateSpaceFolderDragArea } from '../private-space/folders/PrivateSpaceFolderDragArea'
import type { usePrivateSpaceFolders } from '../private-space/folders/usePrivateSpaceFolders'
import { privateSpaceFolderCopy } from '../private-space/folders/privateSpaceFolderCopy.ru'
import styles from './DirectMessagesPanel.module.css'

type MessageSearchController = ReturnType<typeof useMessageSearch>

type DirectMessagesMobileViewProps = {
  currentUserId: string
  activePrivateSpaceId: string | null
  privateSpaces: PrivateSpaceResponse[]
  folderController: ReturnType<typeof usePrivateSpaceFolders>
  activeMembers: PrivateSpaceMemberResponse[]
  isLoadingPrivateSpaces: boolean
  isMutatingPrivateSpaces: boolean
  messageSearch: MessageSearchController
  onToggleCreate: () => void
  onCreateFolder: () => void
  onEditFolder: (folder: PrivateSpaceFolderResponse) => void
  onOpenPrivateSpace: (spaceId: string) => void
  onDropFilesToPrivateSpace: (spaceId: string, files: File[]) => void
  onOpenContextMenu: (
    event: ReactMouseEvent<HTMLButtonElement>,
    space: PrivateSpaceResponse,
  ) => void
  onMarkAllRead?: () => void
  markAllReadDisabled: boolean
}

export function DirectMessagesMobileView({
  currentUserId,
  activePrivateSpaceId,
  privateSpaces,
  folderController,
  activeMembers,
  isLoadingPrivateSpaces,
  isMutatingPrivateSpaces,
  messageSearch,
  onToggleCreate,
  onCreateFolder,
  onEditFolder,
  onOpenPrivateSpace,
  onDropFilesToPrivateSpace,
  onOpenContextMenu,
  onMarkAllRead,
  markAllReadDisabled,
}: DirectMessagesMobileViewProps) {
  const [isFolderDragUnlocked, setIsFolderDragUnlocked] = useState(false)
  const { listRef, isCreateVisible, handleScroll } =
    useMobileDirectMessageList({
      isLoading: isLoadingPrivateSpaces,
      isSearchActive: messageSearch.isActive,
      itemCount: privateSpaces.length,
      viewKey: folderController.activeFolderId,
    })

  function updateSearchFilter(
    event: ChangeEvent<HTMLSelectElement>,
    key: 'senderUserId' | 'attachmentType',
  ) {
    messageSearch.setFilters((current) => ({
      ...current,
      [key]: event.target.value,
    }))
  }

  function submitSearchByEnter(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      messageSearch.submitSearch()
    }
  }

  return (
    <div className={styles.mobileContent}>
      <div className={styles.search}>
        <SystemIcon className={styles.searchIcon} name="search" size={18} />
        <input
          className="ui-field-control"
          name="directMessageSearch"
          placeholder={communityCopy.direct.search}
          value={messageSearch.query}
          onChange={(event) => messageSearch.setQuery(event.target.value)}
          onKeyDown={submitSearchByEnter}
        />
        <div className={styles.searchFilters}>
          <label>
            <span>{communityCopy.direct.searchAttachments.sender}</span>
            <select
              value={messageSearch.filters.senderUserId}
              onChange={(event) => updateSearchFilter(event, 'senderUserId')}
            >
              <option value="">
                {communityCopy.direct.searchAttachments.anyParticipant}
              </option>
              {activeMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{communityCopy.direct.searchAttachments.label}</span>
            <select
              value={messageSearch.filters.attachmentType}
              onChange={(event) => updateSearchFilter(event, 'attachmentType')}
            >
              <option value="">
                {communityCopy.direct.searchAttachments.noFilter}
              </option>
              <option value="any">
                {communityCopy.direct.searchAttachments.anyAttachment}
              </option>
              <option value="image">
                {communityCopy.direct.searchAttachments.image}
              </option>
              <option value="video">
                {communityCopy.direct.searchAttachments.video}
              </option>
              <option value="audio">
                {communityCopy.direct.searchAttachments.audio}
              </option>
              <option value="file">
                {communityCopy.direct.searchAttachments.file}
              </option>
            </select>
          </label>
        </div>
      </div>

      {!messageSearch.isActive && (
        <PrivateSpaceFolderDragArea
          disabled={folderController.isMutating || !isFolderDragUnlocked}
          folderDragAxis="horizontal"
          onAssign={folderController.addSpaceToFolder}
          onReorderFolders={folderController.reorderFolders}
          onReorderSpaces={folderController.reorderSpaces}
        >
          {(dragState) => <>
          <div className={styles.mobileFolderToolbar}>
            <PrivateSpaceFolderRail
              folders={folderController.folders}
              activeFolderId={folderController.activeFolderId}
              expandedFolderId={dragState.expandedFolderId}
              activeDragFolderId={dragState.activeFolderId}
              overFolderId={dragState.overFolderId}
              dropPlacement={dragState.placement}
              disabled={folderController.isMutating || !isFolderDragUnlocked}
              orientation="horizontal"
              onSelect={folderController.setActiveFolderId}
              onEdit={onEditFolder}
              onDelete={folderController.deleteFolder}
              onToggleOrderLock={folderController.setOrderLocked}
              onMarkAllRead={onMarkAllRead}
              markAllReadDisabled={markAllReadDisabled}
            />
            <button
              className={`${styles.mobileFolderLock} ${isFolderDragUnlocked ? styles.mobileFolderLockActive : ''}`}
              type="button"
              aria-label={isFolderDragUnlocked ? privateSpaceFolderCopy.lock : privateSpaceFolderCopy.unlock}
              title={isFolderDragUnlocked ? privateSpaceFolderCopy.lock : privateSpaceFolderCopy.unlock}
              aria-pressed={isFolderDragUnlocked}
              onClick={() => setIsFolderDragUnlocked((current) => !current)}
            >
              <SystemIcon name={isFolderDragUnlocked ? 'unlock' : 'lock'} size={17} />
            </button>
          </div>
          <DirectMessageList
            key={folderController.activeFolderId}
            currentUserId={currentUserId}
            activePrivateSpaceId={activePrivateSpaceId}
            privateSpaces={privateSpaces}
            isLoadingPrivateSpaces={isLoadingPrivateSpaces}
            listRef={listRef}
            onScroll={handleScroll}
            onOpenPrivateSpace={onOpenPrivateSpace}
            onDropFilesToPrivateSpace={onDropFilesToPrivateSpace}
            onOpenContextMenu={onOpenContextMenu}
            pinnedSpaceIds={
              new Set(folderController.activeFolder?.pinnedSpaceIds ?? [])
            }
            folderDragEnabled={isFolderDragUnlocked && !folderController.isMutating}
            activeDragSpaceId={dragState.activeSpaceId}
            overSpaceId={dragState.overSpaceId}
            dropPlacement={dragState.spacePlacement}
          />
          <button
            className={`${styles.mobileFolderButton} ${
              isCreateVisible ? styles.mobileCreateVisible : ''
            }`}
            type="button"
            aria-label={privateSpaceFolderCopy.create}
            title={privateSpaceFolderCopy.create}
            onClick={onCreateFolder}
          >
            <SystemIcon name="folder" size={18} />
          </button>
          <button
            className={`${styles.mobileCreateButton} ${
              isCreateVisible ? styles.mobileCreateVisible : ''
            }`}
            type="button"
            aria-label={communityCopy.direct.createDirect}
            title={communityCopy.direct.createDirect}
            disabled={isMutatingPrivateSpaces}
            onClick={(event) => {
              event.stopPropagation()
              onToggleCreate()
            }}
          >
            <SystemPlusIcon size="small" />
          </button>
        </>}
        </PrivateSpaceFolderDragArea>
      )}
    </div>
  )
}
