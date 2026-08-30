import type { ReactNode, RefObject } from 'react';

import { SystemIcon, communityCopy, serverCopy } from '../../../shared';

import workspaceStyles from '../shell/ServerWorkspace.module.css';
import styles from './ServerMessageHeader.module.css';

export function ServerMessageHeader({
  title,
  titleIcon,
  titleAccessory,
  leadingAction,
  headerActions,
  pinnedMessageCount,
  isPinnedPanelOpen,
  onTogglePinnedPanel,
  trashMessageCount,
  trashHasMore,
  isTrashPanelOpen,
  onToggleTrashPanel,
  trashToggleRef
}: {
  title: string;
  titleIcon?: ReactNode;
  titleAccessory?: ReactNode;
  leadingAction?: ReactNode;
  headerActions?: ReactNode;
  pinnedMessageCount: number;
  isPinnedPanelOpen: boolean;
  onTogglePinnedPanel: () => void;
  trashMessageCount?: number;
  trashHasMore?: boolean;
  isTrashPanelOpen?: boolean;
  onToggleTrashPanel?: () => void;
  trashToggleRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header>
      {leadingAction}
      <div>
        {titleIcon ?? <span>#</span>}
        <strong>{title}</strong>
        {titleAccessory}
      </div>
      <div
        className={`${workspaceStyles.messageHeaderActions} ${styles.messageHeaderActions}`}
      >
        <button
          className={styles.pinnedToggle}
          type="button"
          aria-label={serverCopy.messages.openPinned}
          title={serverCopy.messages.openPinned}
          aria-pressed={isPinnedPanelOpen}
          onClick={onTogglePinnedPanel}
        >
          <span className={styles.pinnedToggleIcon} aria-hidden="true">
            <SystemIcon name="pin" size={16} />
          </span>
          {pinnedMessageCount > 0 ? <em>{pinnedMessageCount}</em> : null}
        </button>
        {onToggleTrashPanel && trashMessageCount && trashMessageCount > 0 ? (
          <button
            ref={trashToggleRef}
            className={styles.pinnedToggle}
            type="button"
            aria-label={communityCopy.direct.openDeletedMessages}
            title={communityCopy.direct.openDeletedMessages}
            aria-pressed={Boolean(isTrashPanelOpen)}
            onClick={onToggleTrashPanel}
          >
            <span className={styles.pinnedToggleIcon} aria-hidden="true">
              <SystemIcon name="trash" size={16} />
            </span>
            <em>
              {trashMessageCount}
              {trashHasMore ? '+' : ''}
            </em>
          </button>
        ) : null}
        {headerActions}
      </div>
    </header>
  );
}
