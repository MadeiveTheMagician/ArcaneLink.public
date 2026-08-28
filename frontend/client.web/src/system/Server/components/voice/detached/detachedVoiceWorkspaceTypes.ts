import type { ServerMemberDetailsResponse } from '../../../../../shared/types';
import type { VoiceParticipant } from '../../../hooks/voice/useVoiceChannel';

export type DetachedVoiceWorkspaceControlState = {
  isMuted: boolean;
  isDeafened: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
};

export type DetachedVoiceWorkspaceActions = {
  onToggleMuted: () => void;
  onToggleDeafened: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onLeaveVoiceChannel: () => void;
  onOpenSettings: () => void;
  onToggleVoiceChat?: () => void;
};

export type VoiceParticipantCard = {
  hasVideo: boolean;
  isSelf: boolean;
  isSpeaking: boolean;
  accent: string;
  mediaKind: 'camera' | 'screen';
  normalizedParticipantId: string;
  participant: VoiceParticipant;
  participantMember: ServerMemberDetailsResponse | undefined;
  participantStream: MediaStream | null | undefined;
  status: string;
};

export type DetachedVoiceWorkspaceWindow = Window & {
  voiceChatHost?: HTMLElement | null;
  disposeVoiceWorkspaceRuntime?: () => void;
  renderVoiceWorkspaceCards?: (
    spaceTitle: string,
    participantCards: VoiceParticipantCard[],
    controlState: DetachedVoiceWorkspaceControlState
  ) => void;
  updateVoiceWorkspaceSpeakingState?: (
    participantCards: VoiceParticipantCard[]
  ) => void;
  updateVoiceWorkspaceControlState?: (
    controlState: DetachedVoiceWorkspaceControlState
  ) => void;
  updateVoiceWorkspaceChatState?: (isOpen: boolean) => void;
};
