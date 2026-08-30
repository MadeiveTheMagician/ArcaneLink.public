export type LoginResponse = {
  id: string;
  login: string;
  displayName: string;
  email: string;
  subscriptionType: SubscriptionTypeResponse;
  accessToken: string;
  refreshToken: string;
  deviceSessionId?: string | null;
};

export type AuthTokenPair = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  deviceSessionId?: string | null;
};

export type UserResponse = {
  id: string;
  login: string;
  displayName: string;
  email: string;
  emailConfirmedAt?: string | null;
  requiresEmailConfirmation?: boolean;
  subscriptionType: SubscriptionTypeResponse;
  createdAt: string;
  presenceStatus: PresenceStatus;
  lastSeenAt: string | null;
};

export type PresenceStatus = 'online' | 'offline';
export type PresenceCustomVisibility =
  | 'custom:friends'
  | 'custom:friends_of_friends'
  | 'custom:shared_servers'
  | 'custom:friends,friends_of_friends'
  | 'custom:friends,shared_servers'
  | 'custom:friends_of_friends,shared_servers'
  | 'custom:friends,friends_of_friends,shared_servers';
export type PresenceVisibility =
  'everyone' | 'friends' | 'nobody' | PresenceCustomVisibility;
export type PresenceMode = 'automatic' | 'invisible';
export type MessageDisplayFormat = 'wall-scroll' | 'bubble';
export type MessageBubbleAlignment =
  'one-side-left' | 'one-side-right' | 'own-left' | 'own-right';
export type MessageBubbleWidth = 'standard' | 'full-width';
export type DirectMessageCustomPermission =
  | 'custom:friends'
  | 'custom:friends_of_friends'
  | 'custom:shared_servers'
  | 'custom:friends,friends_of_friends'
  | 'custom:friends,shared_servers'
  | 'custom:friends_of_friends,shared_servers'
  | 'custom:friends,friends_of_friends,shared_servers';
export type DirectMessagePermission =
  | 'everyone'
  | 'friends'
  | 'shared_servers'
  | 'nobody'
  | DirectMessageCustomPermission;

export type SubscriptionTypeResponse = {
  id: string;
  code: 'free' | 'plus' | 'prime' | string;
  title: string;
  rank: number;
};

export type PublicUserProfileResponse = {
  id: string;
  login: string;
  displayName: string;
  avatarAssetId: string | null;
  avatarCropOffsetX: number;
  avatarCropOffsetY: number;
  avatarCropZoom: number;
  bannerAssetId: string | null;
  bio: string | null;
  websiteUrl: string | null;
  createdAt: string;
  presenceStatus: PresenceStatus;
  lastSeenAt: string | null;
  subscriptionType: SubscriptionTypeResponse | null;
  tags: ProfileTagResponse[];
};

export type OwnUserProfileResponse = PublicUserProfileResponse & {
  avatarSourceAssetId: string | null;
};

export type AssetResponse = {
  id: string;
  ownerUserId: string | null;
  assetTypeId: string;
  assetTypeCode: string;
  originalFileName: string | null;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type ProfileSession = {
  accessToken: string;
  refreshToken: string;
  deviceSessionId?: string | null;
  user: UserResponse;
  publicProfile: OwnUserProfileResponse;
  profileSettings: UserProfileSettingsResponse;
};

export type UserProfileSettingsResponse = {
  userId: string;
  interfaceScale: number;
  fontScale: number;
  serverInterfaceScale: number;
  isServerRailPinned: boolean;
  showPrivateReadAllButton: boolean;
  serverMessageDisplayFormat: MessageDisplayFormat;
  privateMessageDisplayFormat: MessageDisplayFormat;
  serverMessageBubbleAlignment: MessageBubbleAlignment;
  privateMessageBubbleAlignment: MessageBubbleAlignment;
  serverMessageBubbleWidth: MessageBubbleWidth;
  privateMessageBubbleWidth: MessageBubbleWidth;
  expandMessageAttachmentsByDefault: boolean;
  loadExternalMediaPreviews: boolean;
  horizontalVideoCardSize: number;
  verticalVideoCardSize: number;
  selectedThemeCode: string;
  profileColor: string | null;
  profileBackgroundAssetId: string | null;
  applySystemThemeToOtherProfiles: boolean;
  directMessagePermission: DirectMessagePermission;
  presenceVisibility: PresenceVisibility;
  showLastSeen: boolean;
  presenceMode: PresenceMode;
  updatedAt: string;
};

export type DirectMessageBlockedUserResponse = {
  userId: string;
  isBlocked: true;
  login: string;
  displayName: string;
  avatarAssetId: string | null;
  avatarCropOffsetX: number;
  avatarCropOffsetY: number;
  avatarCropZoom: number;
  comment: string | null;
  createdAt: string;
};

export type DirectMessageBlockStatusResponse = {
  userId: string;
  isBlocked: boolean;
  comment: string | null;
  createdAt: string | null;
};

export type DirectMessageBlockedUserPageResponse = {
  items: DirectMessageBlockedUserResponse[];
  nextCursor: string | null;
  totalCount: number;
};

export type UserDeviceSessionResponse = {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
};

export type ServerInviteResponse = {
  id: string;
  serverId: string;
  serverTitle: string | null;
  serverDescription: string | null;
  serverIconAssetId: string | null;
  serverIconCropOffsetX: number;
  serverIconCropOffsetY: number;
  serverIconCropZoom: number;
  memberCount: number;
  onlineCount: number;
  kindCode: string;
  code: string | null;
  targetUserId: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  isActive: boolean;
};

export type UserNotificationResponse = {
  id: string;
  kind: 'mention' | 'invite' | 'system' | 'achievement' | string;
  title: string;
  body: string;
  detail: string | null;
  actorUserId: string | null;
  actorDisplayName: string | null;
  actorAvatarAssetId: string | null;
  actorAvatarCropOffsetX: number;
  actorAvatarCropOffsetY: number;
  actorAvatarCropZoom: number;
  serverId: string | null;
  serverTitle: string | null;
  serverIconAssetId: string | null;
  serverIconCropOffsetX: number;
  serverIconCropOffsetY: number;
  serverIconCropZoom: number;
  spaceId: string | null;
  spaceTitle: string | null;
  messageId: string | null;
  messageCreatedAt: string | null;
  inviteId: string | null;
  createdAt: string;
  readAt: string | null;
};

export type ServerInvitePreviewResponse = {
  code: string;
  isActive: boolean;
  invalidReason: string | null;
  serverId: string | null;
  serverTitle: string | null;
  serverIconAssetId: string | null;
  serverIconCropOffsetX: number;
  serverIconCropOffsetY: number;
  serverIconCropZoom: number;
  memberCount: number;
  onlineCount: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
};

export type CreateServerInviteRequest = {
  kindCode?: 'link' | 'direct';
  targetUserId?: string | null;
  maxUses?: number | null;
  expiresAt?: string | null;
};

export type PermissionResponse = {
  id: string;
  code: string;
  title: string;
  description: string | null;
};

export type ServerPermissionGroupCode =
  'access' | 'messaging' | 'voice' | 'members' | 'roles' | 'spaces' | 'server';

export type ServerPermissionDefinitionResponse = {
  bit: number;
  code: string;
  group: ServerPermissionGroupCode;
  title: string;
  description: string | null;
};

export type ServerPermissionCatalogResponse = {
  permissionSchemaVersion: number;
  permissions: ServerPermissionDefinitionResponse[];
};

export type ServerRoleResponse = {
  id: string;
  serverId: string;
  code: string | null;
  title: string;
  description: string | null;
  kind: 'standard' | 'everyone' | 'integration';
  color: string | null;
  mentionable: boolean;
  createdByUserId: string | null;
  level: number;
  isSystem: boolean;
  version: string;
  directAssignmentCount: number;
  permissionSchemaVersion: number;
  permissionCodes: string[];
  permissions: PermissionResponse[];
  createdAt: string;
  updatedAt: string;
};

export type ServerRoleDeletionImpactResponse = {
  roleId: string;
  version: string;
  directAssignmentCount: number;
  roleAclCount: number;
  protectedAclCount: number;
  requiredSpaceCount: number;
  protectedSpaceCount: number;
  createdWithRoleSpaceCount: number;
  displayColorMemberCount: number;
  hasBlockingDependencies: boolean;
  canDelete: boolean;
};

export type ServerEffectivePermissionsResponse = {
  serverId: string;
  memberId: string;
  authorizationVersion: string;
  permissionSchemaVersion: number;
  isOwner: boolean;
  isAdministrator: boolean;
  authorityTier: 'owner' | 'administrator' | 'standard' | 'everyone';
  authorityPosition: number | null;
  permissionCodes: string[];
};

export type ServerMemberDisplayColorRoleResponse = {
  id: string;
  title: string;
  color: string;
  level: number;
};

export type ServerMemberDisplayColorResponse = {
  mode: 'auto' | 'default' | 'role';
  roleId: string | null;
  rolesVersion: string;
  resolvedRoleId: string | null;
  resolvedColor: string | null;
  availableRoles: ServerMemberDisplayColorRoleResponse[];
};

export type ServerMemberRoleResponse = {
  id: string;
  serverId: string;
  memberId: string;
  roleId: string;
  roleTitle: string;
  assignedAt: string;
  revokedAt: string | null;
};

export type ServerAuditLogResponse = {
  id: string;
  serverId: string;
  eventTypeCode: string;
  eventTitle: string;
  actorUserId: string | null;
  targetUserId: string | null;
  relatedRoleId: string | null;
  relatedInviteId: string | null;
  relatedSpaceId: string | null;
  payload: string | null;
  createdAt: string;
};

export type SpaceTypeCode = 'category' | 'text_room' | 'voice_room';

export type SpaceTypeResponse = {
  id: string;
  code: SpaceTypeCode;
  title: string;
  description: string | null;
};

export type SpacePermissionOverrideResponse = {
  id: string;
  spaceId: string;
  roleId: string | null;
  memberId: string | null;
  permissionId: string;
  permissionCode: string;
  allow: boolean;
  deny: boolean;
  createdAt: string;
};

export type UpsertSpacePermissionOverrideRequest = {
  roleId?: string | null;
  memberId?: string | null;
  permissionId: string;
  allow: boolean;
  deny: boolean;
};

export type SpaceResponse = {
  id: string;
  serverId: string | null;
  typeId: string;
  typeCode: SpaceTypeCode;
  parentSpaceId: string | null;
  voiceChatSpaceId: string | null;
  createdByUserId: string;
  title: string;
  description: string | null;
  requiredServerRoleId: string | null;
  position: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  unreadCount: number;
  permissionOverrides: SpacePermissionOverrideResponse[];
  effectiveCapabilities: {
    canSendMessages: boolean;
    canConnectVoice: boolean;
    canManageSpace: boolean;
  };
};

export type CreateSpaceRequest = {
  typeCode: SpaceTypeCode;
  parentSpaceId?: string | null;
  title: string;
  description?: string | null;
  requiredServerRoleId?: string | null;
  position?: number;
};

export type UpdateSpaceRequest = {
  title?: string | null;
  description?: string | null;
  clearDescription?: boolean;
  parentSpaceId?: string | null;
  clearParentSpace?: boolean;
  requiredServerRoleId?: string | null;
  clearRequiredServerRole?: boolean;
  position?: number | null;
};

export type DeleteSpaceRequest = {
  categoryChildrenAction?: 'delete' | 'promote';
};

export type SpacePositionRequest = {
  spaceId: string;
  parentSpaceId: string | null;
  position: number;
};

export type ReorderSpacesRequest = {
  spaces: SpacePositionRequest[];
};

export type SpaceMessageAssetResponse = {
  assetId: string;
  displayOrder: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  isSpoiler: boolean;
};

export type SpaceMessageReactionResponse = {
  emojiCode: string;
  count: number;
  reactedByCurrentUser: boolean;
};

export type MessageMentionKind = 'user' | 'role' | 'everyone';

export type SpaceMentionCandidatesResponse = {
  users: Array<{
    id: string;
    login: string;
    displayName: string;
    avatarAssetId: string | null;
    avatarCropOffsetX: number;
    avatarCropOffsetY: number;
    avatarCropZoom: number;
  }>;
  roles: Array<{
    id: string;
    title: string;
  }>;
};

export type SpaceMessageMentionResponse = {
  id: string;
  kind: MessageMentionKind;
  targetUserId: string | null;
  targetRoleId: string | null;
  displayText: string;
  start: number;
  length: number;
};

export type SpaceMessageReplyResponse = {
  id: string;
  senderUserId: string;
  senderDisplayName: string | null;
  senderAvatarAssetId: string | null;
  senderAvatarCropOffsetX: number;
  senderAvatarCropOffsetY: number;
  senderAvatarCropZoom: number;
  body: string | null;
  createdAt: string;
  isUnavailable: boolean;
};

export type SpaceMessageResponse = {
  id: string;
  serverId: string;
  spaceId: string;
  senderUserId: string;
  senderDisplayName: string;
  senderAvatarAssetId: string | null;
  senderAvatarCropOffsetX: number;
  senderAvatarCropOffsetY: number;
  senderAvatarCropZoom: number;
  messageTypeId: string;
  messageTypeCode: string;
  body: string | null;
  payload: string | null;
  replyToMessageId: string | null;
  replyTo?: SpaceMessageReplyResponse | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  assets: SpaceMessageAssetResponse[];
  reactions: SpaceMessageReactionResponse[];
  mentions?: SpaceMessageMentionResponse[];
  receipt?: PrivateMessageReceiptResponse | null;
};

export type PrivateMessageReceiptResponse = {
  statusCode: 'delivered' | 'read';
  recipientCount: number;
  readByCount: number;
  readAt: string | null;
};

export type PrivateMessageDeletionScope = 'me' | 'everyone';

export type PrivateDeletedMessageResponse = {
  message: SpaceMessageResponse;
  scope: PrivateMessageDeletionScope;
  deletedAt: string;
  restoreUntil: string;
};

export type SpaceReadStateResponse = {
  userId: string;
  serverId?: string | null;
  spaceId: string;
  lastReadMessageId: string | null;
  lastReadMessageCreatedAt: string | null;
  readAt: string;
  updatedAt: string;
  advanced: boolean;
  unreadCount: number;
};

export type CreateSpaceMessageRequest = {
  body?: string | null;
  payload?: string | null;
  replyToMessageId?: string | null;
  mentions?: SpaceMessageMentionRequest[] | null;
  assetIds?: string[];
  attachments?: CreateSpaceMessageAttachmentRequest[];
};

export type SpaceMessageMentionRequest = {
  kind: MessageMentionKind;
  targetId: string | null;
  start: number;
  length: number;
};

export type CreateSpaceMessageAttachmentRequest = {
  assetId: string;
  displayName?: string | null;
  isSpoiler?: boolean;
};

export type UpdateSpaceMessageRequest = {
  body?: string | null;
  payload?: string | null;
  clearPayload?: boolean;
  mentions?: SpaceMessageMentionRequest[] | null;
};

export type ServerAccessMode = 'public' | 'restricted' | 'private';

export type ServerResponse = {
  id: string;
  createdByUserId: string;
  ownerUserId: string;
  slug: string;
  title: string;
  description: string | null;
  iconAssetId: string | null;
  iconCropOffsetX: number;
  iconCropOffsetY: number;
  iconCropZoom: number;
  defaultTextSpaceId: string | null;
  accessMode: ServerAccessMode;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServerDiscoveryResponse = {
  server: ServerResponse;
  isMember: boolean;
  joinAction: 'join' | 'request' | 'pending' | 'none';
  membershipId: string | null;
  joinedAt: string | null;
  memberCount: number;
  onlineMemberCount: number;
  textSpaceCount: number;
  voiceSpaceCount: number;
  friendCount: number;
  currentUserRoleTitles: string[];
  currentUserJoinRequest: ServerJoinRequestResponse | null;
  lastActivityAt: string;
};

export type CreateServerRequest = {
  title: string;
  description?: string | null;
  iconAssetId?: string | null;
  iconCropOffsetX?: number;
  iconCropOffsetY?: number;
  iconCropZoom?: number;
  accessMode: ServerAccessMode;
};

export type UpdateServerRequest = {
  title?: string | null;
  description?: string | null;
  iconAssetId?: string | null;
  iconCropOffsetX?: number | null;
  iconCropOffsetY?: number | null;
  iconCropZoom?: number | null;
  clearIconAsset?: boolean;
  defaultTextSpaceId?: string | null;
  clearDefaultTextSpace?: boolean;
  accessMode?: ServerAccessMode | null;
};

export type ServerJoinRequestStatus =
  'pending' | 'approved' | 'declined' | 'cancelled';

export type ServerJoinRequestResponse = {
  id: string;
  serverId: string;
  userId: string;
  statusCode: ServerJoinRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  user: ServerJoinRequestUserResponse;
};

export type ServerJoinRequestUserResponse = {
  id: string;
  login: string;
  displayName: string;
  avatarAssetId: string | null;
  avatarCropOffsetX: number;
  avatarCropOffsetY: number;
  avatarCropZoom: number;
};

export type ServerJoinRequestCursorResponse = {
  createdAt: string;
  id: string;
};

export type ServerJoinRequestPageResponse = {
  items: ServerJoinRequestResponse[];
  nextCursor: ServerJoinRequestCursorResponse | null;
  totalCount: number;
};

export type ServerJoinResponse = {
  status: 'joined' | 'pending';
  membership: ServerMemberResponse | null;
  joinRequest: ServerJoinRequestResponse | null;
};

export type ServerMemberResponse = {
  id: string;
  serverId: string;
  userId: string;
  statusCode: string;
  joinedAt: string;
  leftAt: string | null;
  addedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  server: ServerResponse;
  lastMessage: ServerLastMessageResponse | null;
};

export type ServerMemberProfileInheritanceResponse = {
  displayName: boolean;
  avatar: boolean;
  banner: boolean;
  about: boolean;
};

export type ServerMemberProfileRoleResponse = {
  id: string;
  title: string;
  color: string | null;
};

export type ServerMemberProfileMutualFriendResponse = {
  userId: string;
  login: string;
  displayName: string;
  avatarAssetId: string | null;
  avatarCropOffsetX: number;
  avatarCropOffsetY: number;
  avatarCropZoom: number;
};

export type ServerMemberProfileMutualServerResponse = {
  serverId: string;
  title: string;
  iconAssetId: string | null;
  iconCropOffsetX: number;
  iconCropOffsetY: number;
  iconCropZoom: number;
};

export type ServerMemberProfileResponse = {
  serverId: string;
  userId: string;
  login: string;
  displayName: string;
  avatarAssetId: string | null;
  avatarCropOffsetX: number;
  avatarCropOffsetY: number;
  avatarCropZoom: number;
  bannerAssetId: string | null;
  about: string | null;
  statusText: string | null;
  updatedAt: string;
  inheritance: ServerMemberProfileInheritanceResponse;
};

export type ServerMemberViewerProfileResponse = ServerMemberProfileResponse & {
  memberId: string;
  joinedAt: string;
  profileThemeCode: string;
  profileColor: string | null;
  profileBackgroundAssetId: string | null;
  roles: ServerMemberProfileRoleResponse[];
  mutualFriendCount: number;
  mutualServerCount: number;
  mutualFriends: ServerMemberProfileMutualFriendResponse[];
  mutualServers: ServerMemberProfileMutualServerResponse[];
};

export type OwnServerMemberProfileResponse = ServerMemberProfileResponse & {
  avatarSourceAssetId: string | null;
};

export type UpdateServerMemberProfileRequest = {
  displayName?: string;
  avatarAssetId?: string;
  avatarSourceAssetId?: string;
  avatarCropOffsetX?: number;
  avatarCropOffsetY?: number;
  avatarCropZoom?: number;
  bannerAssetId?: string;
  about?: string;
  statusText?: string;
  useGlobalDisplayName?: boolean;
  useGlobalAvatar?: boolean;
  useGlobalBanner?: boolean;
  useGlobalAbout?: boolean;
  clearStatusText?: boolean;
};

export type ServerLastMessageResponse = {
  spaceId: string;
  spaceTitle: string;
  body: string | null;
  createdAt: string;
};

export type ServerMemberUserResponse = {
  id: string;
  login: string;
  displayName: string;
  avatarAssetId: string | null;
  avatarCropOffsetX: number;
  avatarCropOffsetY: number;
  avatarCropZoom: number;
  bannerAssetId: string | null;
  about: string | null;
  serverStatusText: string | null;
  usesServerProfile: boolean;
  presenceStatus: PresenceStatus;
  lastSeenAt: string | null;
};

export type ServerMemberDetailsResponse = {
  id: string;
  serverId: string;
  userId: string;
  statusCode: string;
  isOwner: boolean;
  joinedAt: string;
  leftAt: string | null;
  addedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  permissionCodes: string[];
  roleAssignments: ServerMemberRoleResponse[];
  user: ServerMemberUserResponse;
};

export type ServerMemberCursorResponse = {
  priority: number;
  joinedAt: string;
  id: string;
};

export type ServerMemberPageResponse = {
  items: ServerMemberDetailsResponse[];
  nextCursor: ServerMemberCursorResponse | null;
  totalCount: number;
};

export type ServerBanResponse = {
  serverId: string;
  memberId: string;
  userId: string;
  bannedAt: string;
  bannedByUserId: string | null;
  reason: string;
  user: ServerMemberUserResponse;
};

export type FriendUserResponse = {
  id: string;
  login: string;
  displayName: string;
  avatarAssetId: string | null;
  avatarCropOffsetX: number;
  avatarCropOffsetY: number;
  avatarCropZoom: number;
  presenceStatus: PresenceStatus;
  lastSeenAt: string | null;
  tags: ProfileTagResponse[];
  mutualServerCount: number;
  mutualFriendCount: number;
  sharedTagCount: number;
  recommendationScore: number;
  isFriend: boolean;
  hasIncomingFriendRequest: boolean;
  hasOutgoingFriendRequest: boolean;
};

export type ProfileTagResponse = {
  id: string;
  code: string;
  title: string;
};

export type FriendRequestResponse = {
  id: string;
  fromUserId: string;
  toUserId: string;
  statusCode: string;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  fromUser: FriendUserResponse;
  toUser: FriendUserResponse;
};

export type UserFriendResponse = {
  userId: string;
  friendUserId: string;
  createdByRequestId: string;
  createdAt: string;
  friend: FriendUserResponse;
};

export type PrivateSpaceMemberResponse = {
  id: string;
  spaceId: string;
  userId: string;
  statusCode: string;
  joinedAt: string;
  leftAt: string | null;
  addedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  user: FriendUserResponse;
};

export type PrivateSpaceResponse = {
  spaceId: string;
  createdByUserId: string;
  ownerUserId: string;
  kind: 'direct' | 'group';
  title: string | null;
  description: string | null;
  avatarAssetId: string | null;
  avatarCropOffsetX: number;
  avatarCropOffsetY: number;
  avatarCropZoom: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  unreadCount: number;
  viewerSettings: PrivateSpaceViewerSettingsResponse;
  members: PrivateSpaceMemberResponse[];
  lastMessage: SpaceMessageResponse | null;
};

export type PrivateSpaceViewerSettingsResponse = {
  note: string | null;
  customNickname: string | null;
  customAvatarAssetId: string | null;
  customAvatarCropOffsetX: number;
  customAvatarCropOffsetY: number;
  customAvatarCropZoom: number;
  mutedUntil: string | null;
  isMutedIndefinitely: boolean;
  isPeerBlocked: boolean;
};

export type PrivateSpaceMembershipMutationResponse = {
  spaceId: string;
  createdGroup: boolean;
  member: PrivateSpaceMemberResponse;
};

export type CreatePrivateSpaceRequest = {
  title?: string | null;
  description?: string | null;
  memberUserIds: string[];
};

export type PrivateSpaceFolderResponse = {
  id: string;
  name: string;
  icon: string;
  color: string | null;
  position: number;
  isSystem: boolean;
  isOrderLocked: boolean;
  spaceIds: string[];
  pinnedSpaceIds: string[];
};

export type UpsertPrivateSpaceFolderRequest = {
  name: string;
  icon: string;
  color: string | null;
  spaceIds: string[];
};
