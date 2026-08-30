import type { SpaceResponse } from '../../../../../shared/types';
import type { ServerDetail } from '../../../utils/serverWorkspaceModel';

export function getActiveMessageSpaceId(
  visibleChannel: Extract<ServerDetail, { type: 'channel' }> | null,
  visibleSpace: SpaceResponse | undefined,
  openVoiceChatSpaceId: string | null
) {
  if (!visibleChannel?.spaceId || !visibleSpace) {
    return null;
  }

  if (visibleChannel.kind === 'text') {
    return visibleChannel.spaceId;
  }

  return openVoiceChatSpaceId === visibleChannel.spaceId
    ? visibleSpace.voiceChatSpaceId
    : null;
}

export function getVoiceChatSpaceIdAfterSelection(
  space: SpaceResponse,
  openChat: boolean
) {
  return openChat &&
    space.typeCode === 'voice_room' &&
    Boolean(space.voiceChatSpaceId)
    ? space.id
    : null;
}

export function toggleVoiceChatSpaceId(
  currentSpaceId: string | null,
  space: SpaceResponse
) {
  return currentSpaceId === space.id
    ? null
    : getVoiceChatSpaceIdAfterSelection(space, true);
}

export function isVoiceSpaceChatOpen(
  visibleChannel: Extract<ServerDetail, { type: 'channel' }> | null,
  openVoiceChatSpaceId: string | null
) {
  return Boolean(
    visibleChannel?.kind === 'voice' &&
    visibleChannel.spaceId === openVoiceChatSpaceId
  );
}
