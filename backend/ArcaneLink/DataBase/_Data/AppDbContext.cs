using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.AuthModels;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.DataBase.Models.ModerationModels;
using ArcaneLink.DataBase.Models.NotificationsModels;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.DataBase._Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users => Set<User>();
        public DbSet<UserStatus> UserStatuses => Set<UserStatus>();
        public DbSet<SubscriptionType> SubscriptionTypes => Set<SubscriptionType>();
        public DbSet<SystemTheme> SystemThemes => Set<SystemTheme>();
        public DbSet<ProfileTag> ProfileTags => Set<ProfileTag>();
        public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
        public DbSet<UserProfileTag> UserProfileTags => Set<UserProfileTag>();
        public DbSet<UserProfileSettings> UserProfileSettings => Set<UserProfileSettings>();
        public DbSet<UserVoiceLayoutPreset> UserVoiceLayoutPresets => Set<UserVoiceLayoutPreset>();
        public DbSet<UserVoiceLayoutPresetSlot> UserVoiceLayoutPresetSlots => Set<UserVoiceLayoutPresetSlot>();
        public DbSet<FriendRequestStatus> FriendRequestStatuses => Set<FriendRequestStatus>();
        public DbSet<FriendRequest> FriendRequests => Set<FriendRequest>();
        public DbSet<UserFriend> UserFriends => Set<UserFriend>();
        public DbSet<UserDirectMessageBlock> UserDirectMessageBlocks =>
            Set<UserDirectMessageBlock>();
        public DbSet<UserNotification> UserNotifications => Set<UserNotification>();

        public DbSet<UserRefreshToken> UserRefreshTokens => Set<UserRefreshToken>();
        public DbSet<UserDeviceSession> UserDeviceSessions => Set<UserDeviceSession>();
        public DbSet<UserAccountActionToken> UserAccountActionTokens => Set<UserAccountActionToken>();
        public DbSet<EmailOutboxMessage> EmailOutboxMessages => Set<EmailOutboxMessage>();

        public DbSet<AssetType> AssetTypes => Set<AssetType>();
        public DbSet<Asset> Assets => Set<Asset>();

        public DbSet<Server> Servers => Set<Server>();
        public DbSet<ServerMemberStatus> ServerMemberStatuses => Set<ServerMemberStatus>();
        public DbSet<ServerMember> ServerMembers => Set<ServerMember>();
        public DbSet<ServerMemberProfile> ServerMemberProfiles =>
            Set<ServerMemberProfile>();
        public DbSet<ServerInviteKind> ServerInviteKinds => Set<ServerInviteKind>();
        public DbSet<ServerInvite> ServerInvites => Set<ServerInvite>();
        public DbSet<ServerInviteUsage> ServerInviteUsages => Set<ServerInviteUsage>();
        public DbSet<ServerJoinRequest> ServerJoinRequests => Set<ServerJoinRequest>();
        public DbSet<ServerOwnershipTransferType> ServerOwnershipTransferTypes => Set<ServerOwnershipTransferType>();
        public DbSet<ServerOwnershipTransfer> ServerOwnershipTransfers => Set<ServerOwnershipTransfer>();
        public DbSet<PermissionCatalog> PermissionCatalog => Set<PermissionCatalog>();
        public DbSet<ServerRole> ServerRoles => Set<ServerRole>();
        public DbSet<ServerRolePermission> ServerRolePermissions => Set<ServerRolePermission>();
        public DbSet<ServerMemberRole> ServerMemberRoles => Set<ServerMemberRole>();
        public DbSet<ServerAuditEventType> ServerAuditEventTypes => Set<ServerAuditEventType>();
        public DbSet<ServerAuditLog> ServerAuditLogs => Set<ServerAuditLog>();

        public DbSet<SpaceType> SpaceTypes => Set<SpaceType>();
        public DbSet<Space> Spaces => Set<Space>();
        public DbSet<SpacePermissionOverride> SpacePermissionOverrides => Set<SpacePermissionOverride>();
        public DbSet<PrivateSpace> PrivateSpaces => Set<PrivateSpace>();
        public DbSet<PrivateSpaceMemberStatus> PrivateSpaceMemberStatuses => Set<PrivateSpaceMemberStatus>();
        public DbSet<PrivateSpaceMember> PrivateSpaceMembers => Set<PrivateSpaceMember>();
        public DbSet<PrivateSpaceFolder> PrivateSpaceFolders => Set<PrivateSpaceFolder>();
        public DbSet<PrivateSpaceFolderItem> PrivateSpaceFolderItems => Set<PrivateSpaceFolderItem>();

        public DbSet<SpaceMessageType> SpaceMessageTypes => Set<SpaceMessageType>();
        public DbSet<SpaceMessage> SpaceMessages => Set<SpaceMessage>();
        public DbSet<SpaceMessageAsset> SpaceMessageAssets => Set<SpaceMessageAsset>();
        public DbSet<SpaceMessageReaction> SpaceMessageReactions => Set<SpaceMessageReaction>();
        public DbSet<SpaceMessageMention> SpaceMessageMentions => Set<SpaceMessageMention>();
        public DbSet<PrivateMessageRecipient> PrivateMessageRecipients =>
            Set<PrivateMessageRecipient>();
        public DbSet<SpaceMessageUserDeletion> SpaceMessageUserDeletions => Set<SpaceMessageUserDeletion>();
        public DbSet<SpacePinnedMessage> SpacePinnedMessages => Set<SpacePinnedMessage>();
        public DbSet<SpaceReadState> SpaceReadStates => Set<SpaceReadState>();
        public DbSet<ModerationCase> ModerationCases => Set<ModerationCase>();
        public DbSet<ModerationSubmission> ModerationSubmissions => Set<ModerationSubmission>();
        public DbSet<ModerationEvidence> ModerationEvidence => Set<ModerationEvidence>();
        public DbSet<ModerationEvidenceAsset> ModerationEvidenceAssets => Set<ModerationEvidenceAsset>();
        public DbSet<ModerationCaseAction> ModerationCaseActions => Set<ModerationCaseAction>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        }
    }
}
