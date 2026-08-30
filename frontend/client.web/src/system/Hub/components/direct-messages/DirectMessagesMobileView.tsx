import { type MouseEvent as ReactMouseEvent, useState } from 'react';

import type {
  PrivateSpaceFolderResponse,
  PrivateSpaceResponse
} from '../../../../shared/types';
import { communityCopy } from '../../../shared/copy/community.ru';
import { SystemIcon } from '../../../shared/icons/SystemIcon';
import { SystemPlusIcon } from '../../../shared/icons/components/SystemPlusIcon';
import { SystemSearchInput } from '../../../shared/ui/SystemSearchInput';
import { PrivateSpaceFolderDragArea } from '../private-space/folders/PrivateSpaceFolderDragArea';
import { PrivateSpaceFolderRail } from '../private-space/folders/PrivateSpaceFolderRail';
import { privateSpaceFolderCopy } from '../private-space/folders/privateSpaceFolderCopy.ru';
import type { usePrivateSpaceFolders } from '../private-space/folders/usePrivateSpaceFolders';
import { DirectMessageList } from './DirectMessageList';
import { useMobileDirectMessageList } from './useMobileDirectMessageList';

import styles from './DirectMessagesPanel.module.css';

type DirectMessagesMobileViewProps = {
  currentUserId: string;
  activePrivateSpaceId: string | null;
  privateSpaces: PrivateSpaceResponse[];
  folderController: ReturnType<typeof usePrivateSpaceFolders>;
  isLoadingPrivateSpaces: boolean;
  isMutatingPrivateSpaces: boolean;
  conversationQuery: string;
  onConversationQueryChange: (value: string) => void;
  onToggleCreate: () => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: PrivateSpaceFolderResponse) => void;
  onOpenPrivateSpace: (spaceId: string) => void;
  onDropFilesToPrivateSpace: (spaceId: string, files: File[]) => void;
  onOpenContextMenu: (
    event: ReactMouseEvent<HTMLButtonElement>,
    space: PrivateSpaceResponse
  ) => void;
  onMarkAllRead?: () => void;
  markAllReadDisabled: boolean;
};

export function DirectMessagesMobileView({
  currentUserId,
  activePrivateSpaceId,
  privateSpaces,
  folderController,
  isLoadingPrivateSpaces,
  isMutatingPrivateSpaces,
  conversationQuery,
  onConversationQueryChange,
  onToggleCreate,
  onCreateFolder,
  onEditFolder,
  onOpenPrivateSpace,
  onDropFilesToPrivateSpace,
  onOpenContextMenu,
  onMarkAllRead,
  markAllReadDisabled
}: DirectMessagesMobileViewProps) {
  const [isFolderDragUnlocked, setIsFolderDragUnlocked] = useState(false);
  const { listRef, isCreateVisible, handleScroll } = useMobileDirectMessageList(
    {
      isLoading: isLoadingPrivateSpaces,
      isSearchActive: conversationQuery.trim().length > 0,
      itemCount: privateSpaces.length,
      viewKey: folderController.activeFolderId
    }
  );

  return (
    <div className={styles.mobileContent}>
      <div className={styles.search}>
        <SystemSearchInput
          name="directConversationSearchMobile"
          aria-label={privateSpaceFolderCopy.panelSearch}
          placeholder={privateSpaceFolderCopy.panelSearch}
          value={conversationQuery}
          onChange={(event) => onConversationQueryChange(event.target.value)}
        />
      </div>

      <PrivateSpaceFolderDragArea
        disabled={folderController.isMutating || !isFolderDragUnlocked}
        folderDragAxis="horizontal"
        onAssign={folderController.addSpaceToFolder}
        onReorderFolders={folderController.reorderFolders}
        onReorderSpaces={folderController.reorderSpaces}
      >
        {(dragState) => (
          <>
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
                aria-label={
                  isFolderDragUnlocked
                    ? privateSpaceFolderCopy.lock
                    : privateSpaceFolderCopy.unlock
                }
                title={
                  isFolderDragUnlocked
                    ? privateSpaceFolderCopy.lock
                    : privateSpaceFolderCopy.unlock
                }
                aria-pressed={isFolderDragUnlocked}
                onClick={() => setIsFolderDragUnlocked((current) => !current)}
              >
                <SystemIcon
                  name={isFolderDragUnlocked ? 'unlock' : 'lock'}
                  size={17}
                />
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
              folderDragEnabled={
                isFolderDragUnlocked && !folderController.isMutating
              }
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
                event.stopPropagation();
                onToggleCreate();
              }}
            >
              <SystemPlusIcon size="small" />
            </button>
          </>
        )}
      </PrivateSpaceFolderDragArea>
    </div>
  );
}
