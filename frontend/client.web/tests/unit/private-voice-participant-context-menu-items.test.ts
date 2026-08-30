import { expect, test } from '@playwright/test';

import type {
  PrivateSpaceMemberResponse,
  ServerMemberResponse
} from '../../src/shared/types';
import {
  buildPrivateVoiceParticipantContextMenuItems,
  isPrivateVoiceContextMenuKey
} from '../../src/system/Hub/components/private-space/privateVoiceParticipantContextMenuItems';
import type { VoiceParticipant } from '../../src/system/Server/hooks/voice/useVoiceChannel';
import type { ContextMenuItem } from '../../src/system/shared/components/context-menu/ContextMenu';
import { serverCopy, voiceCopy } from '../../src/system/shared/copy';
import type { VoiceUserAudioSettings } from '../../src/system/shared/types/voicePlayback';

function participant(userId = 'TARGET-USER'): VoiceParticipant {
  return {
    participantId: `participant:${userId}`,
    userId,
    login: 'target',
    displayName: 'Target',
    isMuted: false,
    isDeafened: false,
    isCameraEnabled: true,
    isScreenSharing: false,
    joinedAt: '2026-08-14T00:00:00Z'
  };
}

function member(userId = 'TARGET-USER'): PrivateSpaceMemberResponse {
  return {
    id: `member:${userId}`,
    spaceId: 'private-space',
    userId,
    statusCode: 'active',
    joinedAt: '2026-08-14T00:00:00Z',
    leftAt: null,
    addedByUserId: null,
    createdAt: '2026-08-14T00:00:00Z',
    updatedAt: '2026-08-14T00:00:00Z',
    user: {
      id: userId,
      login: 'target',
      displayName: 'Target',
      avatarAssetId: null,
      avatarCropOffsetX: 0,
      avatarCropOffsetY: 0,
      avatarCropZoom: 1,
      presenceStatus: 'online',
      lastSeenAt: null,
      tags: [],
      mutualServerCount: 0,
      mutualFriendCount: 0,
      sharedTagCount: 0,
      recommendationScore: 0,
      isFriend: false,
      hasIncomingFriendRequest: false,
      hasOutgoingFriendRequest: false
    }
  };
}

function inviteServer(): ServerMemberResponse {
  return {
    id: 'membership',
    serverId: 'server',
    userId: 'viewer',
    statusCode: 'active',
    joinedAt: '2026-08-14T00:00:00Z',
    leftAt: null,
    addedByUserId: null,
    createdAt: '2026-08-14T00:00:00Z',
    updatedAt: '2026-08-14T00:00:00Z',
    unreadCount: 0,
    lastMessage: null,
    server: {
      id: 'server',
      createdByUserId: 'owner',
      ownerUserId: 'owner',
      slug: 'server',
      title: 'Server',
      description: null,
      iconAssetId: null,
      iconCropOffsetX: 0,
      iconCropOffsetY: 0,
      iconCropZoom: 1,
      defaultTextSpaceId: null,
      accessMode: 'private',
      isSystem: false,
      createdAt: '2026-08-14T00:00:00Z',
      updatedAt: '2026-08-14T00:00:00Z'
    }
  };
}

function options(
  overrides: Partial<
    Parameters<typeof buildPrivateVoiceParticipantContextMenuItems>[0]
  > = {}
): Parameters<typeof buildPrivateVoiceParticipantContextMenuItems>[0] {
  return {
    participant: participant(),
    member: member(),
    currentUserId: 'VIEWER',
    spaceKind: 'group',
    audioSettings: { volume: 1, isMuted: false, isVideoHidden: false },
    friendUserIds: new Set(),
    pendingOutgoingUserIds: new Set(),
    inviteServers: [inviteServer()],
    isLoadingInviteServers: false,
    isMutatingFriends: false,
    isMutatingBlock: false,
    isUserBlockStatusResolved: true,
    isUserBlocked: false,
    onOpenProfile: () => undefined,
    onMentionUser: () => undefined,
    onOpenDirectSpace: () => undefined,
    onStartDirectCall: () => undefined,
    onSendFriendRequest: () => undefined,
    onRemoveFriend: () => undefined,
    onCreateDirectInvite: () => undefined,
    onToggleUserBlock: () => undefined,
    onChangeAudioSettings: () => undefined,
    onCopyUserId: () => undefined,
    ...overrides
  };
}

function labels(items: readonly ContextMenuItem[]) {
  return items.flatMap((item) =>
    item.type === 'separator' ? [] : [item.label]
  );
}

test('group private participant menu mirrors relationship and voice actions without server moderation', () => {
  const patches: Array<Partial<VoiceUserAudioSettings>> = [];
  const items = buildPrivateVoiceParticipantContextMenuItems(
    options({
      audioSettings: { volume: 2.35, isMuted: false, isVideoHidden: false },
      onChangeAudioSettings: (patch) => patches.push(patch)
    })
  );
  const itemLabels = labels(items);

  expect(itemLabels).toEqual(
    expect.arrayContaining([
      serverCopy.contextMenu.profile,
      voiceCopy.participantMenu.mention,
      serverCopy.contextMenu.directMessage,
      voiceCopy.participantMenu.startCall,
      voiceCopy.participantMenu.volume,
      voiceCopy.participantMenu.localMute,
      voiceCopy.participantMenu.hideVideo,
      serverCopy.contextMenu.addFriend,
      serverCopy.contextMenu.inviteToServer,
      serverCopy.contextMenu.block,
      voiceCopy.participantMenu.copyUserId
    ])
  );
  expect(itemLabels).not.toContain(voiceCopy.participantMenu.serverManagement);
  expect(itemLabels).not.toContain(voiceCopy.participantMenu.disconnect);

  const volume = items.find((item) => item.type === 'range');
  expect(volume?.type).toBe('range');
  if (volume?.type === 'range') {
    expect(volume).toMatchObject({
      min: 0,
      max: 400,
      step: 1,
      value: 235,
      valueLabel: '235%'
    });
    volume.onChange(346);
  }
  expect(patches).toEqual([{ volume: 3.46 }]);
});

test('direct private participant menu omits redundant conversation actions', () => {
  const itemLabels = labels(
    buildPrivateVoiceParticipantContextMenuItems(
      options({
        spaceKind: 'direct'
      })
    )
  );

  expect(itemLabels).toContain(serverCopy.contextMenu.profile);
  expect(itemLabels).not.toContain(voiceCopy.participantMenu.mention);
  expect(itemLabels).not.toContain(serverCopy.contextMenu.directMessage);
  expect(itemLabels).not.toContain(voiceCopy.participantMenu.startCall);
});

test('self detection is case-insensitive and hides remote-only actions', () => {
  const itemLabels = labels(
    buildPrivateVoiceParticipantContextMenuItems(
      options({
        currentUserId: 'target-user'
      })
    )
  );

  expect(itemLabels).not.toContain(voiceCopy.participantMenu.volume);
  expect(itemLabels).not.toContain(serverCopy.contextMenu.addFriend);
  expect(itemLabels).not.toContain(serverCopy.contextMenu.block);
  expect(itemLabels).toContain(voiceCopy.participantMenu.copyUserId);
});

test('friend and blocked state comparisons are case-insensitive', () => {
  const itemLabels = labels(
    buildPrivateVoiceParticipantContextMenuItems(
      options({
        friendUserIds: new Set(['target-user']),
        pendingOutgoingUserIds: new Set(['TARGET-USER']),
        isUserBlocked: true
      })
    )
  );

  expect(itemLabels).toContain(serverCopy.contextMenu.removeFriend);
  expect(itemLabels).not.toContain(serverCopy.contextMenu.addFriend);
  expect(itemLabels).toContain(serverCopy.contextMenu.unblock);
});

test('keyboard context-menu gesture supports the menu key and Shift+F10', () => {
  expect(isPrivateVoiceContextMenuKey('ContextMenu', false)).toBe(true);
  expect(isPrivateVoiceContextMenuKey('F10', true)).toBe(true);
  expect(isPrivateVoiceContextMenuKey('F10', false)).toBe(false);
  expect(isPrivateVoiceContextMenuKey('Enter', false)).toBe(false);
});
