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

        public DbSet<User> Users => this.Set<User>();
        public DbSet<UserStatus> UserStatuses => this.Set<UserStatus>();
        public DbSet<SubscriptionType> SubscriptionTypes => this.Set<SubscriptionType>();
        public DbSet<SystemTheme> SystemThemes => this.Set<SystemTheme>();
        public DbSet<ProfileTag> ProfileTags => this.Set<ProfileTag>();
        public DbSet<UserProfile> UserProfiles => this.Set<UserProfile>();
        public DbSet<UserProfileTag> UserProfileTags => this.Set<UserProfileTag>();
        public DbSet<UserProfileSettings> UserProfileSettings => this.Set<UserProfileSettings>();
        public DbSet<UserVoiceLayoutPreset> UserVoiceLayoutPresets => this.Set<UserVoiceLayoutPreset>();
        public DbSet<UserVoiceLayoutPresetSlot> UserVoiceLayoutPresetSlots => this.Set<UserVoiceLayoutPresetSlot>();
        public DbSet<FriendRequestStatus> FriendRequestStatuses => this.Set<FriendRequestStatus>();
        public DbSet<FriendRequest> FriendRequests => this.Set<FriendRequest>();
        public DbSet<UserFriend> UserFriends => this.Set<UserFriend>();
        public DbSet<UserDirectMessageBlock> UserDirectMessageBlocks =>
            this.Set<UserDirectMessageBlock>();
        public DbSet<UserNotification> UserNotifications => this.Set<UserNotification>();

        public DbSet<UserRefreshToken> UserRefreshTokens => this.Set<UserRefreshToken>();
        public DbSet<UserDeviceSession> UserDeviceSessions => this.Set<UserDeviceSession>();
        public DbSet<UserAccountActionToken> UserAccountActionTokens => this.Set<UserAccountActionToken>();
        public DbSet<EmailOutboxMessage> EmailOutboxMessages => this.Set<EmailOutboxMessage>();

        public DbSet<AssetType> AssetTypes => this.Set<AssetType>();
        public DbSet<Asset> Assets => this.Set<Asset>();

        public DbSet<Server> Servers => this.Set<Server>();
        public DbSet<ServerMemberStatus> ServerMemberStatuses => this.Set<ServerMemberStatus>();
        public DbSet<ServerMember> ServerMembers => this.Set<ServerMember>();
        public DbSet<ServerMemberProfile> ServerMemberProfiles =>
            this.Set<ServerMemberProfile>();
        public DbSet<ServerInviteKind> ServerInviteKinds => this.Set<ServerInviteKind>();
        public DbSet<ServerInvite> ServerInvites => this.Set<ServerInvite>();
        public DbSet<ServerInviteUsage> ServerInviteUsages => this.Set<ServerInviteUsage>();
        public DbSet<ServerJoinRequest> ServerJoinRequests => this.Set<ServerJoinRequest>();
        public DbSet<ServerOwnershipTransferType> ServerOwnershipTransferTypes => this.Set<ServerOwnershipTransferType>();
        public DbSet<ServerOwnershipTransfer> ServerOwnershipTransfers => this.Set<ServerOwnershipTransfer>();
        public DbSet<PermissionCatalog> PermissionCatalog => this.Set<PermissionCatalog>();
        public DbSet<ServerRole> ServerRoles => this.Set<ServerRole>();
        public DbSet<ServerRolePermission> ServerRolePermissions => this.Set<ServerRolePermission>();
        public DbSet<ServerMemberRole> ServerMemberRoles => this.Set<ServerMemberRole>();
        public DbSet<ServerAuditEventType> ServerAuditEventTypes => this.Set<ServerAuditEventType>();
        public DbSet<ServerAuditLog> ServerAuditLogs => this.Set<ServerAuditLog>();

        public DbSet<SpaceType> SpaceTypes => this.Set<SpaceType>();
        public DbSet<Space> Spaces => this.Set<Space>();
        public DbSet<SpacePermissionOverride> SpacePermissionOverrides => this.Set<SpacePermissionOverride>();
        public DbSet<PrivateSpace> PrivateSpaces => this.Set<PrivateSpace>();
        public DbSet<PrivateSpaceMemberStatus> PrivateSpaceMemberStatuses => this.Set<PrivateSpaceMemberStatus>();
        public DbSet<PrivateSpaceMember> PrivateSpaceMembers => this.Set<PrivateSpaceMember>();
        public DbSet<PrivateSpaceFolder> PrivateSpaceFolders => this.Set<PrivateSpaceFolder>();
        public DbSet<PrivateSpaceFolderItem> PrivateSpaceFolderItems => this.Set<PrivateSpaceFolderItem>();

        public DbSet<SpaceMessageType> SpaceMessageTypes => this.Set<SpaceMessageType>();
        public DbSet<SpaceMessage> SpaceMessages => this.Set<SpaceMessage>();
        public DbSet<SpaceMessageAsset> SpaceMessageAssets => this.Set<SpaceMessageAsset>();
        public DbSet<SpaceMessageReaction> SpaceMessageReactions => this.Set<SpaceMessageReaction>();
        public DbSet<SpaceMessageMention> SpaceMessageMentions => this.Set<SpaceMessageMention>();
        public DbSet<PrivateMessageRecipient> PrivateMessageRecipients =>
            this.Set<PrivateMessageRecipient>();
        public DbSet<SpaceMessageUserDeletion> SpaceMessageUserDeletions => this.Set<SpaceMessageUserDeletion>();
        public DbSet<SpacePinnedMessage> SpacePinnedMessages => this.Set<SpacePinnedMessage>();
        public DbSet<SpaceReadState> SpaceReadStates => this.Set<SpaceReadState>();
        public DbSet<ModerationCase> ModerationCases => this.Set<ModerationCase>();
        public DbSet<ModerationSubmission> ModerationSubmissions => this.Set<ModerationSubmission>();
        public DbSet<ModerationEvidence> ModerationEvidence => this.Set<ModerationEvidence>();
        public DbSet<ModerationEvidenceAsset> ModerationEvidenceAssets => this.Set<ModerationEvidenceAsset>();
        public DbSet<ModerationCaseAction> ModerationCaseActions => this.Set<ModerationCaseAction>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        }
    }
}
