import type {
  PrivateSpaceMemberResponse,
  ServerMemberResponse
} from '../../../../shared/types';
import type { VoiceParticipant } from '../../../Server/hooks/voice/useVoiceChannel';
import type { ContextMenuItem } from '../../../shared/components/context-menu/ContextMenu';
import { serverCopy, voiceCopy } from '../../../shared/copy';
import type { VoiceUserAudioSettings } from '../../../shared/types/voicePlayback';
import {
  maximumVoiceParticipantVolumePercent,
  minimumVoiceParticipantVolumePercent,
  voiceParticipantVolumeFromPercent,
  voiceParticipantVolumePercentStep,
  voiceParticipantVolumeToPercent
} from '../../../shared/voice/voiceParticipantVolume';

type BuildPrivateVoiceParticipantContextMenuItemsOptions = {
  participant: VoiceParticipant;
  member: PrivateSpaceMemberResponse | null;
  currentUserId: string;
  spaceKind: 'direct' | 'group';
  audioSettings: VoiceUserAudioSettings;
  friendUserIds: ReadonlySet<string>;
  pendingOutgoingUserIds: ReadonlySet<string>;
  inviteServers: readonly ServerMemberResponse[];
  isLoadingInviteServers: boolean;
  isMutatingFriends: boolean;
  isMutatingBlock: boolean;
  isUserBlockStatusResolved: boolean;
  isUserBlocked: boolean;
  onOpenProfile: (member: PrivateSpaceMemberResponse) => void;
  onMentionUser: (participant: VoiceParticipant) => void;
  onOpenDirectSpace: (userId: string) => void;
  onStartDirectCall: (member: PrivateSpaceMemberResponse) => void;
  onSendFriendRequest: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onCreateDirectInvite: (serverId: string, userId: string) => void;
  onToggleUserBlock: (participant: VoiceParticipant) => void;
  onChangeAudioSettings: (patch: Partial<VoiceUserAudioSettings>) => void;
  onCopyUserId: (userId: string) => void;
};

export function isPrivateVoiceContextMenuKey(key: string, shiftKey: boolean) {
  return key === 'ContextMenu' || (shiftKey && key === 'F10');
}

export function buildPrivateVoiceParticipantContextMenuItems({
  participant,
  member,
  currentUserId,
  spaceKind,
  audioSettings,
  friendUserIds,
  pendingOutgoingUserIds,
  inviteServers,
  isLoadingInviteServers,
  isMutatingFriends,
  isMutatingBlock,
  isUserBlockStatusResolved,
  isUserBlocked,
  onOpenProfile,
  onMentionUser,
  onOpenDirectSpace,
  onStartDirectCall,
  onSendFriendRequest,
  onRemoveFriend,
  onCreateDirectInvite,
  onToggleUserBlock,
  onChangeAudioSettings,
  onCopyUserId
}: BuildPrivateVoiceParticipantContextMenuItemsOptions): ContextMenuItem[] {
  const participantUserId = normalizeUserId(participant.userId);
  const isSelf = participantUserId === normalizeUserId(currentUserId);
  const isFriend = hasNormalizedUserId(friendUserIds, participantUserId);
  const hasPendingFriendRequest = hasNormalizedUserId(
    pendingOutgoingUserIds,
    participantUserId
  );
  const canOpenPeerConversation = !isSelf && spaceKind === 'group';

  const identityItems: ContextMenuItem[] = [
    ...(member
      ? ([
          {
            type: 'item',
            label: serverCopy.contextMenu.profile,
            icon: 'profile',
            onSelect: () => onOpenProfile(member)
          }
        ] satisfies ContextMenuItem[])
      : []),
    ...(canOpenPeerConversation
      ? ([
          {
            type: 'item',
            label: voiceCopy.participantMenu.mention,
            icon: 'message',
            onSelect: () => onMentionUser(participant)
          },
          {
            type: 'item',
            label: serverCopy.contextMenu.directMessage,
            icon: 'message',
            onSelect: () => onOpenDirectSpace(participant.userId)
          },
          ...(member
            ? ([
                {
                  type: 'item',
                  label: voiceCopy.participantMenu.startCall,
                  icon: 'call',
                  onSelect: () => onStartDirectCall(member)
                }
              ] satisfies ContextMenuItem[])
            : [])
        ] satisfies ContextMenuItem[])
      : [])
  ];

  const audioItems: ContextMenuItem[] = isSelf
    ? []
    : [
        {
          type: 'range',
          label: voiceCopy.participantMenu.volume,
          icon: 'audio',
          min: minimumVoiceParticipantVolumePercent,
          max: maximumVoiceParticipantVolumePercent,
          step: voiceParticipantVolumePercentStep,
          value: voiceParticipantVolumeToPercent(audioSettings.volume),
          valueLabel: `${voiceParticipantVolumeToPercent(audioSettings.volume)}%`,
          onChange: (volumePercent) =>
            onChangeAudioSettings({
              volume: voiceParticipantVolumeFromPercent(volumePercent)
            })
        },
        {
          type: 'item',
          label: voiceCopy.participantMenu.localMute,
          icon: 'audio',
          selected: audioSettings.isMuted,
          onSelect: () =>
            onChangeAudioSettings({ isMuted: !audioSettings.isMuted })
        },
        ...(participant.isCameraEnabled || participant.isScreenSharing
          ? ([
              {
                type: 'item',
                label: voiceCopy.participantMenu.hideVideo,
                icon: 'video',
                selected: audioSettings.isVideoHidden === true,
                onSelect: () =>
                  onChangeAudioSettings({
                    isVideoHidden: audioSettings.isVideoHidden !== true
                  })
              }
            ] satisfies ContextMenuItem[])
          : [])
      ];

  const relationshipItems: ContextMenuItem[] = isSelf
    ? []
    : [
        ...(!isMutatingFriends && !hasPendingFriendRequest && !isFriend
          ? ([
              {
                type: 'item',
                label: serverCopy.contextMenu.addFriend,
                icon: 'friend',
                onSelect: () => onSendFriendRequest(participant.userId)
              }
            ] satisfies ContextMenuItem[])
          : []),
        ...(!isMutatingFriends && isFriend
          ? ([
              {
                type: 'item',
                label: serverCopy.contextMenu.removeFriend,
                icon: 'friend',
                onSelect: () => onRemoveFriend(participant.userId)
              }
            ] satisfies ContextMenuItem[])
          : []),
        {
          type: 'item',
          label: serverCopy.contextMenu.inviteToServer,
          icon: 'invite',
          disabled: isLoadingInviteServers || inviteServers.length === 0,
          submenu:
            inviteServers.length > 0
              ? inviteServers.map((membership) => ({
                  type: 'item' as const,
                  label: membership.server.title,
                  icon: 'invite' as const,
                  onSelect: () =>
                    onCreateDirectInvite(
                      membership.serverId,
                      participant.userId
                    )
                }))
              : undefined
        },
        {
          type: 'item',
          label: !isUserBlockStatusResolved
            ? serverCopy.contextMenu.blockStatusLoading
            : isUserBlocked
              ? serverCopy.contextMenu.unblock
              : serverCopy.contextMenu.block,
          icon: 'block',
          danger: isUserBlockStatusResolved && !isUserBlocked,
          disabled: isMutatingBlock || !isUserBlockStatusResolved,
          onSelect: () => onToggleUserBlock(participant)
        }
      ];

  const utilityItems: ContextMenuItem[] = [
    {
      type: 'item',
      label: voiceCopy.participantMenu.copyUserId,
      icon: 'copy',
      onSelect: () => onCopyUserId(participant.userId)
    }
  ];

  return joinContextMenuSections([
    identityItems,
    audioItems,
    relationshipItems,
    utilityItems
  ]);
}

function joinContextMenuSections(sections: readonly ContextMenuItem[][]) {
  return sections
    .filter((section) => section.length > 0)
    .flatMap((section, index) =>
      index === 0 ? section : [{ type: 'separator' as const }, ...section]
    );
}

function hasNormalizedUserId(userIds: ReadonlySet<string>, userId: string) {
  for (const candidate of userIds) {
    if (normalizeUserId(candidate) === userId) return true;
  }

  return false;
}

function normalizeUserId(userId: string) {
  return userId.trim().toLowerCase();
}
