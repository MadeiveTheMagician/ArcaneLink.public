import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  Ref,
  UIEventHandler
} from 'react';

import { useDraggable, useDroppable } from '@dnd-kit/core';

import type { PrivateSpaceResponse } from '../../../../shared/types';
import { commonCopy } from '../../../shared/copy/common.ru';
import { communityCopy } from '../../../shared/copy/community.ru';
import { SystemIcon } from '../../../shared/icons/SystemIcon';
import {
  hasOpenBlockingModal,
  resolveMessageAssetDropDisposition
} from '../../../shared/messages/messageAssetDropModel';
import { PresenceName } from '../../../shared/ui/PresenceDot';
import { UnreadBadge } from '../../../shared/ui/UnreadBadge';
import type { FolderDropPlacement } from '../private-space/folders/PrivateSpaceFolderDragArea';
import { PrivateSpaceAvatar } from './DirectMessageAvatar';
import { PrivateSpaceListTooltip } from './PrivateSpaceListTooltip';
import {
  formatPrivateSpaceTime,
  getPrivateSpacePresenceStatus,
  getPrivateSpacePreview,
  getPrivateSpaceTitle,
  getPrivateSpaceTooltipModel,
  resolvePrivateSpaceMuteState
} from './directMessageModel';
import type { PrivateSpaceTooltipModel } from './directMessageModel';

import styles from './DirectMessagesPanel.module.css';

const fileHoverOpenDelayMs = 500;

type DirectMessageListProps = {
  currentUserId: string;
  activePrivateSpaceId: string | null;
  privateSpaces: PrivateSpaceResponse[];
  isLoadingPrivateSpaces: boolean;
  listRef?: Ref<HTMLDivElement>;
  onScroll?: UIEventHandler<HTMLDivElement>;
  onOpenPrivateSpace: (spaceId: string) => void;
  onDropFilesToPrivateSpace: (spaceId: string, files: File[]) => void;
  onOpenContextMenu: (
    event: ReactMouseEvent<HTMLButtonElement>,
    space: PrivateSpaceResponse
  ) => void;
  folderDragEnabled?: boolean;
  activeDragSpaceId?: string | null;
  overSpaceId?: string | null;
  dropPlacement?: FolderDropPlacement | null;
  pinnedSpaceIds?: ReadonlySet<string>;
};

export function DirectMessageList({
  currentUserId,
  activePrivateSpaceId,
  privateSpaces,
  isLoadingPrivateSpaces,
  listRef,
  onScroll,
  onOpenPrivateSpace,
  onDropFilesToPrivateSpace,
  onOpenContextMenu,
  folderDragEnabled = false,
  activeDragSpaceId = null,
  overSpaceId = null,
  dropPlacement = null,
  pinnedSpaceIds = new Set<string>()
}: DirectMessageListProps) {
  const [fileDropTargetSpaceId, setFileDropTargetSpaceId] = useState<
    string | null
  >(null);
  const fileHoverOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const fileHoverSpaceIdRef = useRef<string | null>(null);
  const [muteClockMs, setMuteClockMs] = useState(() => Date.now());
  const pinnedSpaces = privateSpaces.filter((space) =>
    pinnedSpaceIds.has(space.spaceId)
  );
  const regularSpaces = privateSpaces.filter(
    (space) => !pinnedSpaceIds.has(space.spaceId)
  );
  const orderedSpaces = [...pinnedSpaces, ...regularSpaces];

  useEffect(
    () => () => {
      if (fileHoverOpenTimerRef.current) {
        clearTimeout(fileHoverOpenTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const finiteMuteRemaining = privateSpaces.flatMap((space) => {
      const state = resolvePrivateSpaceMuteState(
        space.viewerSettings,
        muteClockMs
      );
      return state.isMuted && !state.isIndefinite && state.remainingMs != null
        ? [state.remainingMs]
        : [];
    });

    if (finiteMuteRemaining.length === 0) {
      return undefined;
    }

    const refreshDelay = Math.max(
      250,
      finiteMuteRemaining.reduce(
        (nextRefresh, remainingMs) => Math.min(nextRefresh, remainingMs),
        60_000
      )
    );
    const refreshTimer = window.setTimeout(
      () => setMuteClockMs(Date.now()),
      refreshDelay
    );
    return () => window.clearTimeout(refreshTimer);
  }, [muteClockMs, privateSpaces]);

  function cancelFileHoverOpen(spaceId?: string) {
    if (spaceId && fileHoverSpaceIdRef.current !== spaceId) {
      return;
    }

    if (fileHoverOpenTimerRef.current) {
      clearTimeout(fileHoverOpenTimerRef.current);
      fileHoverOpenTimerRef.current = null;
    }

    fileHoverSpaceIdRef.current = null;
  }

  function scheduleFileHoverOpen(spaceId: string) {
    if (activePrivateSpaceId === spaceId) {
      cancelFileHoverOpen();
      return;
    }

    if (fileHoverSpaceIdRef.current === spaceId) {
      return;
    }

    cancelFileHoverOpen();
    fileHoverSpaceIdRef.current = spaceId;
    fileHoverOpenTimerRef.current = setTimeout(() => {
      fileHoverOpenTimerRef.current = null;

      if (fileHoverSpaceIdRef.current !== spaceId) {
        return;
      }

      onOpenPrivateSpace(spaceId);
    }, fileHoverOpenDelayMs);
  }

  function hasDraggedFiles(event: ReactDragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes('Files');
  }

  function getFileDropDisposition(event: ReactDragEvent<HTMLElement>) {
    return resolveMessageAssetDropDisposition({
      canAccept: true,
      hasFiles: hasDraggedFiles(event),
      isBlockingModalOpen: hasOpenBlockingModal(document)
    });
  }

  function activateFileDrop(
    event: ReactDragEvent<HTMLButtonElement>,
    spaceId: string
  ) {
    const disposition = getFileDropDisposition(event);
    if (disposition === 'ignore') return;

    event.preventDefault();
    event.stopPropagation();
    if (disposition === 'reject') {
      event.dataTransfer.dropEffect = 'none';
      cancelFileHoverOpen();
      setFileDropTargetSpaceId(null);
      return;
    }

    event.dataTransfer.dropEffect = 'copy';
    setFileDropTargetSpaceId(spaceId);
    scheduleFileHoverOpen(spaceId);
  }

  function clearFileDrop(
    event: ReactDragEvent<HTMLButtonElement>,
    spaceId: string
  ) {
    if (!hasDraggedFiles(event)) {
      return;
    }

    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    cancelFileHoverOpen(spaceId);
    setFileDropTargetSpaceId((current) =>
      current === spaceId ? null : current
    );
  }

  function dropFiles(
    event: ReactDragEvent<HTMLButtonElement>,
    spaceId: string
  ) {
    const disposition = getFileDropDisposition(event);
    if (disposition === 'ignore') return;

    event.preventDefault();
    event.stopPropagation();
    cancelFileHoverOpen();
    setFileDropTargetSpaceId(null);
    if (disposition === 'reject') {
      event.dataTransfer.dropEffect = 'none';
      return;
    }

    const files = Array.from(event.dataTransfer.files);

    if (files.length === 0) {
      onOpenPrivateSpace(spaceId);
      return;
    }

    onDropFilesToPrivateSpace(spaceId, files);
  }

  return (
    <div
      ref={listRef}
      className={`${styles.list} ui-scroll-list ui-scrollbar-none`}
      onScroll={onScroll}
    >
      {isLoadingPrivateSpaces && (
        <p className="ui-empty-state">{commonCopy.status.loading}</p>
      )}
      {!isLoadingPrivateSpaces && privateSpaces.length === 0 && (
        <p className="ui-empty-state">{communityCopy.direct.noMessages}</p>
      )}
      {orderedSpaces.map((space, index) => {
        const title = getPrivateSpaceTitle(space, currentUserId);
        const isPinned = pinnedSpaceIds.has(space.spaceId);
        const presenceStatus = getPrivateSpacePresenceStatus(
          space,
          currentUserId
        );
        const preview = getPrivateSpacePreview(space);
        const muteState = resolvePrivateSpaceMuteState(
          space.viewerSettings,
          muteClockMs
        );
        const lastMessageTime = space.lastMessage?.createdAt ?? space.updatedAt;
        const hasAttachment = Boolean(space.lastMessage?.assets.length);

        return (
          <Fragment key={space.spaceId}>
            {index === pinnedSpaces.length &&
              pinnedSpaces.length > 0 &&
              regularSpaces.length > 0 && (
                <div className={styles.pinnedSeparator} aria-hidden="true">
                  <span />
                </div>
              )}
            <DraggableDirectMessage
              space={space}
              disabled={!folderDragEnabled || isPinned}
              isDropTarget={
                activeDragSpaceId !== space.spaceId &&
                overSpaceId === space.spaceId
              }
              dropPlacement={dropPlacement}
              tooltip={getPrivateSpaceTooltipModel(space, currentUserId)}
              className={`${styles.item} ui-list-row ${
                activePrivateSpaceId === space.spaceId ? styles.active : ''
              } ${
                fileDropTargetSpaceId === space.spaceId
                  ? styles.fileDropTarget
                  : ''
              } ${isPinned ? styles.pinnedItem : ''}`}
              onClick={() => onOpenPrivateSpace(space.spaceId)}
              onContextMenu={(event) => onOpenContextMenu(event, space)}
              onDragEnter={(event) => activateFileDrop(event, space.spaceId)}
              onDragOver={(event) => activateFileDrop(event, space.spaceId)}
              onDragLeave={(event) => clearFileDrop(event, space.spaceId)}
              onDrop={(event) => dropFiles(event, space.spaceId)}
            >
              <PrivateSpaceAvatar
                className={styles.avatar}
                space={space}
                currentUserId={currentUserId}
                title={title}
              />
              <span className={styles.body}>
                <span className={styles.titleRow}>
                  <span className={styles.titleIdentity}>
                    <PresenceName status={presenceStatus}>
                      <strong className="ui-ellipsis">{title}</strong>
                    </PresenceName>
                    {muteState.isMuted && (
                      <span
                        className={styles.mutedIndicator}
                        aria-label={communityCopy.direct.notificationsMuted}
                      >
                        <SystemIcon name="speaker" size={13} />
                      </span>
                    )}
                  </span>
                  <span className={styles.titleMeta}>
                    {isPinned && (
                      <span
                        className={styles.pinnedIndicator}
                        aria-label={communityCopy.direct.pinned}
                      >
                        <SystemIcon name="pin" size={13} />
                      </span>
                    )}
                    <time dateTime={lastMessageTime}>
                      {formatPrivateSpaceTime(lastMessageTime)}
                    </time>
                    <UnreadBadge count={space.unreadCount} />
                  </span>
                </span>
                <span className={styles.previewRow}>
                  {hasAttachment && (
                    <span
                      className={styles.attachmentIcon}
                      aria-label={communityCopy.direct.attachment}
                    >
                      <SystemIcon name="paperclip" size={18} />
                    </span>
                  )}
                  <small className="ui-ellipsis">{preview}</small>
                </span>
              </span>
            </DraggableDirectMessage>
          </Fragment>
        );
      })}
    </div>
  );
}

function DraggableDirectMessage({
  space,
  disabled,
  isDropTarget,
  dropPlacement,
  tooltip,
  className,
  children,
  ...buttonProps
}: {
  space: PrivateSpaceResponse;
  disabled: boolean;
  isDropTarget: boolean;
  dropPlacement: FolderDropPlacement | null;
  tooltip: PrivateSpaceTooltipModel;
  className: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'>) {
  const overlay = (
    <div className={`${className} ${styles.dragOverlayItem}`}>{children}</div>
  );
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `private-space:${space.spaceId}`,
    disabled,
    data: {
      dragType: 'private-space',
      spaceId: space.spaceId,
      overlay
    }
  });
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `private-space-drop:${space.spaceId}`,
    disabled,
    data: { spaceId: space.spaceId }
  });
  const setCombinedNodeRef = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      setNodeRef(node);
      setDroppableRef(node);
    },
    [setDroppableRef, setNodeRef]
  );
  return (
    <>
      <button
        ref={setCombinedNodeRef}
        data-private-space-drag-source
        className={`${className} ${isDragging ? styles.folderDragging : ''} ${
          isDropTarget && dropPlacement === 'before' ? styles.reorderBefore : ''
        } ${
          isDropTarget && dropPlacement === 'after' ? styles.reorderAfter : ''
        }`}
        type="button"
        {...buttonProps}
        {...attributes}
        {...listeners}
        aria-describedby={
          [
            attributes['aria-describedby'],
            buttonProps['aria-describedby'],
            isTooltipOpen ? `private-space-tooltip-${space.spaceId}` : null
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
        onPointerEnter={(event) => {
          setIsTooltipOpen(true);
          buttonProps.onPointerEnter?.(event);
        }}
        onPointerLeave={(event) => {
          setIsTooltipOpen(false);
          buttonProps.onPointerLeave?.(event);
        }}
        onFocus={(event) => {
          setIsTooltipOpen(true);
          buttonProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsTooltipOpen(false);
          buttonProps.onBlur?.(event);
        }}
      >
        {children}
      </button>
      <PrivateSpaceListTooltip
        anchorRef={buttonRef}
        id={`private-space-tooltip-${space.spaceId}`}
        isOpen={isTooltipOpen && !isDragging}
        model={tooltip}
      />
    </>
  );
}
