import {
  type MouseEvent as ReactMouseEvent,
  useLayoutEffect,
  useRef
} from 'react';

import type { PrivateSpaceResponse } from '../../../../shared/types';
import type { PrivateSpaceFolderResponse } from '../../../../shared/types';
import { PrivateSpaceFolderDragArea } from '../private-space/folders/PrivateSpaceFolderDragArea';
import { PrivateSpaceFolderRail } from '../private-space/folders/PrivateSpaceFolderRail';
import type { usePrivateSpaceFolders } from '../private-space/folders/usePrivateSpaceFolders';
import { DirectMessageList } from './DirectMessageList';

import styles from './DirectMessagesPanel.module.css';

type DirectMessagesDesktopViewProps = {
  currentUserId: string;
  activePrivateSpaceId: string | null;
  privateSpaces: PrivateSpaceResponse[];
  folderController: ReturnType<typeof usePrivateSpaceFolders>;
  isFolderRailCollapsed: boolean;
  isLoadingPrivateSpaces: boolean;
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

export function DirectMessagesDesktopView({
  currentUserId,
  activePrivateSpaceId,
  privateSpaces,
  folderController,
  isFolderRailCollapsed,
  isLoadingPrivateSpaces,
  onEditFolder,
  onOpenPrivateSpace,
  onDropFilesToPrivateSpace,
  onOpenContextMenu,
  onMarkAllRead,
  markAllReadDisabled
}: DirectMessagesDesktopViewProps) {
  const folderRailSectionRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (isFolderRailCollapsed) return undefined;

    const section = folderRailSectionRef.current;
    const viewport = section?.firstElementChild;
    if (!section || !(viewport instanceof HTMLElement)) return undefined;

    const updateExpandedHeight = () => {
      const height = Math.ceil(viewport.getBoundingClientRect().height);
      if (height <= 0) return;

      const nextHeight = `${height}px`;
      if (
        section.style.getPropertyValue('--private-folder-rail-height') !==
        nextHeight
      ) {
        section.style.setProperty('--private-folder-rail-height', nextHeight);
      }
    };

    updateExpandedHeight();
    const observer = new ResizeObserver(updateExpandedHeight);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [isFolderRailCollapsed]);

  return (
    <PrivateSpaceFolderDragArea
      disabled={folderController.isMutating}
      onAssign={folderController.addSpaceToFolder}
      onReorderFolders={folderController.reorderFolders}
      onReorderSpaces={folderController.reorderSpaces}
    >
      {(dragState) => (
        <div className={styles.desktopContent}>
          <div
            ref={folderRailSectionRef}
            className={`${styles.folderRailSection} ${isFolderRailCollapsed ? styles.folderRailSectionCollapsed : ''}`}
          >
            <PrivateSpaceFolderRail
              folders={folderController.folders}
              activeFolderId={folderController.activeFolderId}
              expandedFolderId={
                isFolderRailCollapsed ? null : dragState.expandedFolderId
              }
              activeDragFolderId={dragState.activeFolderId}
              overFolderId={dragState.overFolderId}
              dropPlacement={dragState.placement}
              collapsed={isFolderRailCollapsed}
              disabled={folderController.isMutating || isFolderRailCollapsed}
              onSelect={folderController.setActiveFolderId}
              onEdit={onEditFolder}
              onDelete={folderController.deleteFolder}
              onToggleOrderLock={folderController.setOrderLocked}
              onMarkAllRead={onMarkAllRead}
              markAllReadDisabled={markAllReadDisabled}
            />
          </div>
          <DirectMessageList
            key={folderController.activeFolderId}
            currentUserId={currentUserId}
            activePrivateSpaceId={activePrivateSpaceId}
            privateSpaces={privateSpaces}
            isLoadingPrivateSpaces={isLoadingPrivateSpaces}
            onOpenPrivateSpace={onOpenPrivateSpace}
            onDropFilesToPrivateSpace={onDropFilesToPrivateSpace}
            onOpenContextMenu={onOpenContextMenu}
            pinnedSpaceIds={
              new Set(folderController.activeFolder?.pinnedSpaceIds ?? [])
            }
            folderDragEnabled={!folderController.isMutating}
            activeDragSpaceId={dragState.activeSpaceId}
            overSpaceId={dragState.overSpaceId}
            dropPlacement={dragState.spacePlacement}
          />
        </div>
      )}
    </PrivateSpaceFolderDragArea>
  );
}
