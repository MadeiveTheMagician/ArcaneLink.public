export type MessageMentionKind = 'user' | 'role' | 'everyone';

export type MentionUserCandidate = {
  readonly id: string;
  readonly login: string;
  readonly displayName: string;
  readonly avatarAssetId?: string | null;
  readonly avatarCropOffsetX?: number;
  readonly avatarCropOffsetY?: number;
  readonly avatarCropZoom?: number;
};

export type MentionRoleCandidate = {
  readonly id: string;
  readonly title: string;
};

export type MentionOption = {
  readonly key: string;
  readonly kind: MessageMentionKind;
  readonly targetId: string | null;
  readonly token: string;
  readonly label: string;
  readonly secondaryLabel?: string;
  readonly avatarAssetId?: string | null;
  readonly avatarCropOffsetX?: number;
  readonly avatarCropOffsetY?: number;
  readonly avatarCropZoom?: number;
};

export type ActiveMentionQuery = {
  readonly start: number;
  readonly end: number;
  readonly query: string;
};

export type DraftMention = {
  readonly kind: MessageMentionKind;
  readonly targetId: string | null;
  readonly token: string;
  readonly start: number;
  readonly length: number;
};

export type MessageMentionRequest = {
  readonly kind: MessageMentionKind;
  readonly targetId: string | null;
  readonly start: number;
  readonly length: number;
};
