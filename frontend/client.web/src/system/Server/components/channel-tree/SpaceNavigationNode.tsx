import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent
} from 'react';

import type {
  ServerMemberDetailsResponse,
  SpaceResponse
} from '../../../../shared/types';
import { SystemIcon } from '../../../shared';
import type { VoiceUserAudioSettings } from '../../../shared/types/voicePlayback';
import type { VoiceParticipant } from '../../hooks/voice/useVoiceChannel';
import type { ServerDetail } from '../../utils/serverWorkspaceModel';
import { canManageSpace } from '../../utils/spaceCapabilities';
import {
  SpaceNavigationButton,
  getSpaceNodeClassName
} from './SpaceNavigationButton';
import type { SpaceDropMode } from './spaceReorderModel';
import type {
  SpaceDropTarget,
  VoiceParticipantDragState
} from './useSpaceTreeDragAndDrop';

import styles from './ServerChannelTreeNavigation.module.css';

type SpaceNavigationNodeProps = {
  depth: number;
  space: SpaceResponse;
  spaces: SpaceResponse[];
  visibleDetail: ServerDetail | null;
  participantsBySpaceId: Record<string, VoiceParticipant[]>;
  audioSettingsByUserId: Record<string, VoiceUserAudioSettings>;
  serverMembers: ServerMemberDetailsResponse[];
  serverMemberCount: number;
  speakingParticipantIds: Record<string, boolean>;
  openVoiceChatSpaceId: string | null;
  collapsedCategoryIds: Set<string>;
  canDragSpaces: boolean;
  canMoveVoiceParticipants: boolean;
  draggedSpaceId: string | null;
  spaceDropTarget: SpaceDropTarget | null;
  voiceDropTargetSpaceId: string | null;
  draggedVoiceParticipant: VoiceParticipantDragState | null;
  onSelect: (space: SpaceResponse) => void;
  onOpenVoiceChat: (space: SpaceResponse) => void;
  onToggleCategory: (spaceId: string) => void;
  onStartSpaceDrag: (
    event: ReactDragEvent<HTMLElement>,
    space: SpaceResponse
  ) => void;
  onUpdateSpaceDropTarget: (
    event: ReactDragEvent<HTMLElement>,
    target: SpaceResponse,
    modeOverride?: SpaceDropMode
  ) => void;
  onDropSpaceOnTarget: (
    event: ReactDragEvent<HTMLElement>,
    target: SpaceResponse,
    modeOverride?: SpaceDropMode
  ) => void;
  onClearSpaceDragState: () => void;
  onStartVoiceParticipantDrag: (
    event: ReactDragEvent<HTMLElement>,
    sourceSpaceId: string,
    participant: VoiceParticipant
  ) => void;
  onUpdateVoiceParticipantDropTarget: (
    event: ReactDragEvent<HTMLElement>,
    target: SpaceResponse
  ) => void;
  onDropVoiceParticipantOnTarget: (
    event: ReactDragEvent<HTMLElement>,
    target: SpaceResponse
  ) => void;
  onClearVoiceDragState: () => void;
  onOpenVoiceParticipantContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    participant: VoiceParticipant,
    sourceSpaceId: string
  ) => void;
  onContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    space: SpaceResponse | null
  ) => void;
};

export function SpaceNavigationNode({
  depth,
  space,
  spaces,
  visibleDetail,
  participantsBySpaceId,
  audioSettingsByUserId,
  serverMembers,
  serverMemberCount,
  speakingParticipantIds,
  openVoiceChatSpaceId,
  collapsedCategoryIds,
  canDragSpaces,
  canMoveVoiceParticipants,
  draggedSpaceId,
  spaceDropTarget,
  voiceDropTargetSpaceId,
  draggedVoiceParticipant,
  onSelect,
  onOpenVoiceChat,
  onToggleCategory,
  onStartSpaceDrag,
  onUpdateSpaceDropTarget,
  onDropSpaceOnTarget,
  onClearSpaceDragState,
  onStartVoiceParticipantDrag,
  onUpdateVoiceParticipantDropTarget,
  onDropVoiceParticipantOnTarget,
  onClearVoiceDragState,
  onOpenVoiceParticipantContextMenu,
  onContextMenu
}: SpaceNavigationNodeProps) {
  if (space.typeCode === 'category') {
    const childSpaces = spaces
      .filter((item) => item.parentSpaceId === space.id)
      .sort(compareSpaces);
    const isCollapsed = collapsedCategoryIds.has(space.id);

    return (
      <div
        className={getSpaceNodeClassName(
          styles.spaceCategory,
          space,
          draggedSpaceId,
          spaceDropTarget
        )}
        data-collapsed={isCollapsed ? 'true' : 'false'}
        data-depth={depth}
      >
        <button
          className={styles.spaceCategoryButton}
          type="button"
          draggable={canDragSpaces && canManageSpace(space)}
          aria-expanded={!isCollapsed}
          onClick={() => onToggleCategory(space.id)}
          onDragStart={(event) => onStartSpaceDrag(event, space)}
          onDragEnd={onClearSpaceDragState}
          onDragOver={(event) => onUpdateSpaceDropTarget(event, space)}
          onDrop={(event) => onDropSpaceOnTarget(event, space)}
          onContextMenu={(event) => onContextMenu(event, space)}
        >
          <span aria-hidden="true">
            <SystemIcon name="chevron-down" size={14} />
          </span>
          <strong>{space.title}</strong>
        </button>
        <div
          className={styles.spaceCategoryChildren}
          aria-hidden={isCollapsed}
          onDragOver={(event) => onUpdateSpaceDropTarget(event, space, 'after')}
          onDrop={(event) => onDropSpaceOnTarget(event, space, 'after')}
        >
          <div className={styles.spaceCategoryChildrenInner}>
            {childSpaces.map((child) => (
              <SpaceNavigationNode
                key={child.id}
                depth={depth + 1}
                space={child}
                spaces={spaces}
                visibleDetail={visibleDetail}
                participantsBySpaceId={participantsBySpaceId}
                audioSettingsByUserId={audioSettingsByUserId}
                serverMembers={serverMembers}
                serverMemberCount={serverMemberCount}
                speakingParticipantIds={speakingParticipantIds}
                openVoiceChatSpaceId={openVoiceChatSpaceId}
                collapsedCategoryIds={collapsedCategoryIds}
                canDragSpaces={canDragSpaces}
                canMoveVoiceParticipants={canMoveVoiceParticipants}
                draggedSpaceId={draggedSpaceId}
                spaceDropTarget={spaceDropTarget}
                voiceDropTargetSpaceId={voiceDropTargetSpaceId}
                draggedVoiceParticipant={draggedVoiceParticipant}
                onSelect={onSelect}
                onOpenVoiceChat={onOpenVoiceChat}
                onToggleCategory={onToggleCategory}
                onStartSpaceDrag={onStartSpaceDrag}
                onUpdateSpaceDropTarget={onUpdateSpaceDropTarget}
                onDropSpaceOnTarget={onDropSpaceOnTarget}
                onClearSpaceDragState={onClearSpaceDragState}
                onStartVoiceParticipantDrag={onStartVoiceParticipantDrag}
                onUpdateVoiceParticipantDropTarget={
                  onUpdateVoiceParticipantDropTarget
                }
                onDropVoiceParticipantOnTarget={onDropVoiceParticipantOnTarget}
                onClearVoiceDragState={onClearVoiceDragState}
                onOpenVoiceParticipantContextMenu={
                  onOpenVoiceParticipantContextMenu
                }
                onContextMenu={onContextMenu}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <SpaceNavigationButton
      space={space}
      visibleDetail={visibleDetail}
      participants={participantsBySpaceId[space.id] ?? []}
      audioSettingsByUserId={audioSettingsByUserId}
      serverMembers={serverMembers}
      serverMemberCount={serverMemberCount}
      speakingParticipantIds={speakingParticipantIds}
      isVoiceChatOpen={openVoiceChatSpaceId === space.id}
      depth={depth}
      canDragSpaces={canDragSpaces && canManageSpace(space)}
      canMoveVoiceParticipants={
        canMoveVoiceParticipants && canManageSpace(space)
      }
      draggedSpaceId={draggedSpaceId}
      spaceDropTarget={spaceDropTarget}
      voiceDropTargetSpaceId={voiceDropTargetSpaceId}
      draggedVoiceParticipant={draggedVoiceParticipant}
      onSelect={() => onSelect(space)}
      onOpenVoiceChat={() => onOpenVoiceChat(space)}
      onStartSpaceDrag={(event) => onStartSpaceDrag(event, space)}
      onUpdateSpaceDropTarget={(event) => onUpdateSpaceDropTarget(event, space)}
      onDropSpaceOnTarget={(event) => onDropSpaceOnTarget(event, space)}
      onClearSpaceDragState={onClearSpaceDragState}
      onStartVoiceParticipantDrag={(event, participant) =>
        onStartVoiceParticipantDrag(event, space.id, participant)
      }
      onUpdateVoiceParticipantDropTarget={(event) =>
        onUpdateVoiceParticipantDropTarget(event, space)
      }
      onDropVoiceParticipantOnTarget={(event) =>
        onDropVoiceParticipantOnTarget(event, space)
      }
      onClearVoiceDragState={onClearVoiceDragState}
      onOpenVoiceParticipantContextMenu={(event, participant) =>
        onOpenVoiceParticipantContextMenu(event, participant, space.id)
      }
      onContextMenu={(event) => onContextMenu(event, space)}
    />
  );
}

function compareSpaces(first: SpaceResponse, second: SpaceResponse) {
  return (
    first.position - second.position || first.title.localeCompare(second.title)
  );
}
