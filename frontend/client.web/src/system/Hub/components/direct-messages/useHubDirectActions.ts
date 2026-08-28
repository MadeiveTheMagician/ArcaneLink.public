import { useState } from 'react';

import type {
  FriendUserResponse,
  PrivateSpaceResponse,
  UserFriendResponse
} from '../../../../shared/types';
import type { ConnectedVoiceChannel } from '../../../Server/hooks/voice/voiceChannelTypes';

export type PendingPrivateSpaceDroppedFiles = {
  id: string;
  spaceId: string;
  files: File[];
};

type UseHubDirectActionsOptions = {
  friends: UserFriendResponse[];
  openDirectSpace: (
    targetUserId: string
  ) => Promise<PrivateSpaceResponse | null>;
  openPrivateSpace: (spaceId: string) => void;
  joinVoiceChannel: (channel: ConnectedVoiceChannel) => Promise<void>;
  setFriendSearchQuery: (query: string) => void;
  showFriendsWorkspace: () => void;
};

export function useHubDirectActions({
  friends,
  openDirectSpace,
  openPrivateSpace,
  joinVoiceChannel,
  setFriendSearchQuery,
  showFriendsWorkspace
}: UseHubDirectActionsOptions) {
  const [pendingPrivateSpaceDroppedFiles, setPendingPrivateSpaceDroppedFiles] =
    useState<PendingPrivateSpaceDroppedFiles | null>(null);

  function openDirectSpaceForUser(userId: string) {
    void openDirectSpace(userId).then((space) => {
      if (space) {
        openPrivateSpace(space.spaceId);
      }
    });
  }

  function startDirectVoiceForUser(
    targetUser: Pick<FriendUserResponse, 'id' | 'displayName'>
  ) {
    void openDirectSpace(targetUser.id).then((space) => {
      if (!space) {
        return;
      }

      openPrivateSpace(space.spaceId);
      void joinVoiceChannel({
        serverId: null,
        spaceId: space.spaceId,
        title: targetUser.displayName,
        channelScope: 'private'
      });
    });
  }

  function dropFilesToPrivateSpace(spaceId: string, files: File[]) {
    if (files.length === 0) {
      openPrivateSpace(spaceId);
      return;
    }

    setPendingPrivateSpaceDroppedFiles({
      id: `${spaceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      spaceId,
      files
    });
    openPrivateSpace(spaceId);
  }

  function consumePendingPrivateSpaceDroppedFiles(id: string) {
    setPendingPrivateSpaceDroppedFiles((current) =>
      current?.id === id ? null : current
    );
  }

  function openUserProfileFromDirectMessages(userId: string) {
    const friend = friends.find((item) => item.friendUserId === userId);

    setFriendSearchQuery(
      friend?.friend.login ?? friend?.friend.displayName ?? ''
    );
    showFriendsWorkspace();
  }

  return {
    pendingPrivateSpaceDroppedFiles,
    openDirectSpaceForUser,
    startDirectVoiceForUser,
    dropFilesToPrivateSpace,
    consumePendingPrivateSpaceDroppedFiles,
    openUserProfileFromDirectMessages
  };
}
