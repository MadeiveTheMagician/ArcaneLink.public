import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent
} from 'react';

import type {
  ServerMemberDetailsResponse,
  SpaceResponse
} from '../../../../shared/types';
import { SystemIcon, UnreadBadge, serverCopy } from '../../../shared';
import type { VoiceUserAudioSettings } from '../../../shared/types/voicePlayback';
import { normalizeVoiceUserId } from '../../../shared/voice/voicePlaybackPreferences';
import type { VoiceParticipant } from '../../hooks/voice/useVoiceChannel';
import type { ServerDetail } from '../../utils/serverWorkspaceModel';
import {
  VoiceParticipantAvatar,
  getVoiceParticipantMember,
  normalizeVoiceParticipantUserId
} from '../voice/participants/VoiceParticipantIdentity';
import { VoiceParticipantLocalStatus } from '../voice/participants/VoiceParticipantLocalStatus';
import {
  type SpaceDropTarget,
  type VoiceParticipantDragState,
  isVoiceParticipantDrag
} from './useSpaceTreeDragAndDrop';

import styles from './ServerChannelTreeNavigation.module.css';
import reorderStyles from './ServerChannelTreeReorder.module.css';

type SpaceNavigationButtonProps = {
  space: SpaceResponse;
  visibleDetail: ServerDetail | null;
  participants?: VoiceParticipant[];
  audioSettingsByUserId: Record<string, VoiceUserAudioSettings>;
  serverMembers?: ServerMemberDetailsResponse[];
  serverMemberCount: number;
  speakingParticipantIds?: Record<string, boolean>;
  isVoiceChatOpen: boolean;
  depth: number;
  canDragSpaces: boolean;
  canMoveVoiceParticipants: boolean;
  draggedSpaceId: string | null;
  spaceDropTarget: SpaceDropTarget | null;
  voiceDropTargetSpaceId: string | null;
  draggedVoiceParticipant: VoiceParticipantDragState | null;
  onSelect: () => void;
  onOpenVoiceChat: () => void;
  onStartSpaceDrag: (event: ReactDragEvent<HTMLElement>) => void;
  onUpdateSpaceDropTarget: (event: ReactDragEvent<HTMLElement>) => void;
  onDropSpaceOnTarget: (event: ReactDragEvent<HTMLElement>) => void;
  onClearSpaceDragState: () => void;
  onStartVoiceParticipantDrag: (
    event: ReactDragEvent<HTMLElement>,
    participant: VoiceParticipant
  ) => void;
  onUpdateVoiceParticipantDropTarget: (
    event: ReactDragEvent<HTMLElement>
  ) => void;
  onDropVoiceParticipantOnTarget: (event: ReactDragEvent<HTMLElement>) => void;
  onClearVoiceDragState: () => void;
  onOpenVoiceParticipantContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    participant: VoiceParticipant
  ) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
};

export function SpaceNavigationButton({
  space,
  visibleDetail,
  participants = [],
  audioSettingsByUserId,
  serverMembers = [],
  serverMemberCount,
  speakingParticipantIds = {},
  isVoiceChatOpen,
  depth,
  canDragSpaces,
  canMoveVoiceParticipants,
  draggedSpaceId,
  spaceDropTarget,
  voiceDropTargetSpaceId,
  draggedVoiceParticipant,
  onSelect,
  onOpenVoiceChat,
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
}: SpaceNavigationButtonProps) {
  const kind = space.typeCode === 'voice_room' ? 'voice' : 'text';
  const hasVoiceChat = kind === 'voice' && Boolean(space.voiceChatSpaceId);
  const isVoiceDropTarget =
    kind === 'voice' && voiceDropTargetSpaceId === space.id;
  const channelCount =
    kind === 'voice' ? participants.length : serverMemberCount;
  const previewParticipants = participants.slice(0, 4);
  const hasStackedParticipants =
    participants.length > previewParticipants.length;

  return (
    <div
      className={[
        getSpaceNodeClassName(
          styles.spaceLeaf,
          space,
          draggedSpaceId,
          spaceDropTarget
        ),
        hasVoiceChat ? styles.voiceSpaceWithChat : '',
        isVoiceDropTarget ? reorderStyles.voiceParticipantDropTarget : ''
      ]
        .filter(Boolean)
        .join(' ')}
      data-depth={depth}
    >
      <button
        className={
          visibleDetail?.type === 'channel' &&
          visibleDetail.spaceId === space.id
            ? styles.active
            : ''
        }
        type="button"
        draggable={canDragSpaces}
        onClick={onSelect}
        onDragStart={onStartSpaceDrag}
        onDragEnd={() => {
          onClearSpaceDragState();
          onClearVoiceDragState();
        }}
        onDragOver={(event) => {
          onUpdateVoiceParticipantDropTarget(event);
          onUpdateSpaceDropTarget(event);
        }}
        onDrop={(event) => {
          if (isVoiceParticipantDrag(event)) {
            void onDropVoiceParticipantOnTarget(event);
            return;
          }

          void onDropSpaceOnTarget(event);
        }}
        onContextMenu={onContextMenu}
      >
        <span className={styles.mobileSpaceChannelIcon}>
          {kind === 'voice' ? <VolumeIcon /> : '#'}
        </span>
        <span className={styles.mobileSpaceChannelText}>
          <strong>{space.title}</strong>
          <span className={styles.mobileSpaceChannelSubtitle}>
            {getSpaceKindLabel(kind)}
            {kind === 'voice' && previewParticipants.length > 0 && (
              <span className={styles.mobileSpaceVoiceAvatars}>
                {previewParticipants.map((participant) => (
                  <VoiceParticipantAvatar
                    key={participant.participantId}
                    participant={participant}
                    member={getVoiceParticipantMember(
                      participant,
                      serverMembers
                    )}
                    className={styles.mobileSpaceVoiceAvatar}
                  />
                ))}
                {hasStackedParticipants && (
                  <span
                    className={styles.mobileSpaceVoiceAvatarStack}
                    aria-hidden="true"
                  >
                    +
                  </span>
                )}
              </span>
            )}
          </span>
        </span>
        <span
          className={`${styles.mobileSpaceChannelMeta} ${
            kind === 'text' && space.unreadCount > 0
              ? styles.spaceUnreadMeta
              : ''
          }`}
        >
          {kind === 'text' && <UnreadBadge count={space.unreadCount} />}
          <span className={styles.mobileSpaceChannelCount} aria-hidden="true">
            {channelCount}
          </span>
        </span>
      </button>
      {hasVoiceChat && (
        <button
          className={styles.voiceChatButton}
          type="button"
          aria-label={
            isVoiceChatOpen
              ? serverCopy.messages.closeVoiceChat
              : serverCopy.messages.openVoiceChat(space.title)
          }
          title={
            isVoiceChatOpen
              ? serverCopy.messages.closeVoiceChat
              : serverCopy.messages.openVoiceChat(space.title)
          }
          aria-pressed={isVoiceChatOpen}
          data-open={isVoiceChatOpen ? 'true' : 'false'}
          onClick={(event) => {
            event.stopPropagation();
            onOpenVoiceChat();
          }}
          onContextMenu={onContextMenu}
        >
          <SystemIcon name="message" size={16} />
          <UnreadBadge
            className={styles.voiceChatUnread}
            count={space.unreadCount}
          />
        </button>
      )}
      {kind === 'voice' && participants.length > 0 && (
        <div className={styles.voiceChannelMembers}>
          {participants.map((participant) => {
            const participantMember = getVoiceParticipantMember(
              participant,
              serverMembers
            );
            const isSpeaking = Boolean(
              speakingParticipantIds[
                normalizeVoiceParticipantUserId(participant.participantId)
              ]
            );

            return (
              <div
                key={participant.participantId}
                className={[
                  styles.voiceChannelMember,
                  isSpeaking ? styles.voiceChannelMemberSpeaking : '',
                  draggedVoiceParticipant?.participantId ===
                  participant.participantId
                    ? reorderStyles.voiceParticipantDragSource
                    : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable={canMoveVoiceParticipants}
                tabIndex={0}
                onDragStart={(event) =>
                  onStartVoiceParticipantDrag(event, participant)
                }
                onDragEnd={onClearVoiceDragState}
                onContextMenu={(event) =>
                  onOpenVoiceParticipantContextMenu(event, participant)
                }
                onKeyDown={(event) => {
                  if (
                    event.key !== 'ContextMenu' &&
                    !(event.shiftKey && event.key === 'F10')
                  ) {
                    return;
                  }

                  event.preventDefault();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  event.currentTarget.dispatchEvent(
                    new MouseEvent('contextmenu', {
                      bubbles: true,
                      cancelable: true,
                      clientX: bounds.left + 18,
                      clientY: bounds.top + 18
                    })
                  );
                }}
              >
                <VoiceParticipantAvatar
                  participant={participant}
                  member={participantMember}
                  className={styles.voiceChannelAvatar}
                />
                <strong className="ui-ellipsis">
                  {participant.displayName}
                </strong>
                <VoiceParticipantLocalStatus
                  participant={participant}
                  settings={
                    audioSettingsByUserId[
                      normalizeVoiceUserId(participant.userId)
                    ]
                  }
                  className={styles.voiceChannelLocalStatuses}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function getSpaceNodeClassName(
  baseClassName: string,
  space: SpaceResponse,
  draggedSpaceId: string | null,
  dropTarget: SpaceDropTarget | null
) {
  const classes = [baseClassName];

  if (draggedSpaceId === space.id) classes.push(reorderStyles.spaceDragSource);
  if (dropTarget?.targetSpaceId === space.id) {
    if (dropTarget.mode === 'before')
      classes.push(reorderStyles.spaceDropBefore);
    else if (dropTarget.mode === 'after')
      classes.push(reorderStyles.spaceDropAfter);
    else classes.push(reorderStyles.spaceDropInside);
  }

  return classes.join(' ');
}

function getSpaceKindLabel(kind: 'voice' | 'text') {
  return kind === 'voice'
    ? serverCopy.labels.voiceChannel
    : serverCopy.labels.textChannel;
}

function VolumeIcon() {
  return (
    <SystemIcon className={styles.voiceSpaceIcon} name="speaker" size={20} />
  );
}
