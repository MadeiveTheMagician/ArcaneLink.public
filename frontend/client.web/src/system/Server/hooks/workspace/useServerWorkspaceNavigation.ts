import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ServerEffectivePermissionsResponse,
  ServerMemberDetailsResponse,
  ServerMemberResponse,
  SpaceMessageResponse,
  SpaceResponse,
  UserResponse
} from '../../../../shared/types';
import { resolveMessageFocus } from '../../../shared/messages/messageFocusModel';
import { rememberRecentServerDetail } from '../../utils/serverRecentSpace';
import {
  type ServerDetail,
  toChannelDetail
} from '../../utils/serverWorkspaceModel';
import { canConnectToVoiceSpace } from '../../utils/spaceCapabilities';
import type { FocusMessageRequest } from '../messages/useSpaceMessages';
import type { VoiceChannelController } from '../voice/useVoiceChannel';
import { useServerWorkspaceSelection } from './useServerWorkspaceSelection';
import { useServerWorkspaceState } from './useServerWorkspaceState';

const MOBILE_SERVER_WORKSPACE_QUERY = '(max-width: 760px)';

type UseServerWorkspaceNavigationOptions = {
  selectedServerMembership: ServerMemberResponse;
  user: UserResponse;
  serverMembers: ServerMemberDetailsResponse[];
  serverSpaces: SpaceResponse[];
  isLoadingSpaces: boolean;
  voice: VoiceChannelController;
  onCloseSettings: () => boolean;
  onOpenVoiceChat: (spaceId: string | null) => void;
  effectivePermissions: ServerEffectivePermissionsResponse | null;
  externalMessageFocus?: FocusMessageRequest | null;
  onExternalMessageFocusConsumed?: () => void;
};

function isMobileServerWorkspace() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia(MOBILE_SERVER_WORKSPACE_QUERY).matches
  );
}

export function useServerWorkspaceNavigation({
  selectedServerMembership,
  user,
  serverMembers,
  serverSpaces,
  isLoadingSpaces,
  voice,
  onCloseSettings,
  onOpenVoiceChat,
  effectivePermissions,
  externalMessageFocus,
  onExternalMessageFocusConsumed
}: UseServerWorkspaceNavigationOptions) {
  const serverId = selectedServerMembership.server.id;
  const [activeSelection, setActiveSelection] = useState<{
    serverId: string;
    detail: ServerDetail | null;
  }>(() => ({ serverId, detail: null }));
  const activeDetail =
    activeSelection.serverId === serverId ? activeSelection.detail : null;
  const setActiveDetail = useCallback(
    (detail: ServerDetail | null) => {
      setActiveSelection({ serverId, detail });
    },
    [serverId]
  );
  const [focusedMessage, setFocusedMessage] =
    useState<FocusMessageRequest | null>(null);
  const workspaceState = useServerWorkspaceState({
    selectedServerMembership,
    user,
    serverMembers,
    serverSpaces,
    activeDetail,
    effectivePermissions
  });
  const { collapsedCategoryIds, toggleCategory } = useServerWorkspaceSelection({
    activeDetail,
    autoSelectDefaultDetail: true,
    isLoadingSpaces,
    serverId,
    serverDefaultTextSpaceId: workspaceState.server.defaultTextSpaceId,
    serverSpaces,
    textSpaces: workspaceState.textSpaces,
    visibleDetail: workspaceState.visibleDetail,
    onSetActiveDetail: setActiveDetail
  });
  const voiceSpaceIds = useMemo(
    () =>
      serverSpaces
        .filter((space) => space.typeCode === 'voice_room')
        .map((space) => space.id),
    [serverSpaces]
  );
  const voiceSpaceIdsKey = voiceSpaceIds.join('|');

  useEffect(() => {
    if (isLoadingSpaces) return;

    void voice.refreshServerVoiceStates(
      workspaceState.server.id,
      voiceSpaceIds
    );
    // The joined key tracks identity changes without retriggering for an
    // equivalent array created by a refreshed server-space payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingSpaces, workspaceState.server.id, voiceSpaceIdsKey]);

  useEffect(() => {
    setFocusedMessage(null);
  }, [serverId]);

  function selectDetail(
    detail: ServerDetail | null,
    preserveFocusedMessage = false
  ) {
    if (!onCloseSettings()) {
      return false;
    }

    if (!preserveFocusedMessage) {
      setFocusedMessage(resolveMessageFocus({ kind: 'latest' }));
    }
    if (detail) {
      rememberRecentServerDetail(serverId, detail);
    }
    setActiveDetail(detail);
    return true;
  }

  function selectSpace(space: SpaceResponse) {
    const detail = toChannelDetail(space);
    if (!selectDetail(detail)) {
      return;
    }

    if (
      detail.type !== 'channel' ||
      detail.kind !== 'voice' ||
      !detail.spaceId
    ) {
      return;
    }

    if (isMobileServerWorkspace()) return;
    if (!canConnectToVoiceSpace(space)) return;

    if (
      voice.connectedChannel?.channelScope === 'server' &&
      voice.connectedChannel.serverId === workspaceState.server.id &&
      voice.connectedChannel.spaceId === detail.spaceId
    ) {
      return;
    }

    void voice.joinVoiceChannel({
      serverId: workspaceState.server.id,
      spaceId: detail.spaceId,
      title: detail.title,
      channelScope: 'server'
    });
  }

  function openSearchResult(message: SpaceMessageResponse) {
    const space = serverSpaces.find(
      (item) =>
        item.id === message.spaceId || item.voiceChatSpaceId === message.spaceId
    );
    if (!space || space.typeCode === 'category') return;

    if (!selectDetail(toChannelDetail(space), true)) {
      return;
    }

    setFocusedMessage(resolveMessageFocus({ kind: 'search-result', message }));
    onOpenVoiceChat(space.typeCode === 'voice_room' ? space.id : null);
  }

  useEffect(() => {
    if (!externalMessageFocus || isLoadingSpaces) return;

    const space = serverSpaces.find(
      (item) =>
        item.id === externalMessageFocus.spaceId ||
        item.voiceChatSpaceId === externalMessageFocus.spaceId
    );
    if (!space || space.typeCode === 'category') return;

    if (!selectDetail(toChannelDetail(space), true)) return;

    setFocusedMessage(externalMessageFocus);
    onOpenVoiceChat(space.typeCode === 'voice_room' ? space.id : null);
    onExternalMessageFocusConsumed?.();
    // The target is an explicit one-shot navigation request. Selection helpers
    // intentionally remain outside the dependency list to avoid replaying it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    externalMessageFocus,
    isLoadingSpaces,
    onExternalMessageFocusConsumed,
    serverSpaces
  ]);

  return {
    ...workspaceState,
    activeDetail,
    collapsedCategoryIds,
    focusedMessage,
    openSearchResult,
    selectDetail,
    selectSpace,
    setActiveDetail,
    toggleCategory
  };
}
