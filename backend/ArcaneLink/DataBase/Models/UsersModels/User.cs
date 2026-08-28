using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.AuthModels;
using ArcaneLink.DataBase.Models.ServersModels;

namespace ArcaneLink.DataBase.Models.UsersModels
{
    public class User
    {
        public Guid Id { get; set; }

        public required string Login { get; set; }
        public required string LoginNorm { get; set; }

        public required string Email { get; set; }
        public required string EmailNorm { get; set; }

        public DateTime? EmailConfirmedAt { get; set; }

        public required string PasswordHash { get; set; }

        public Guid StatusId { get; set; }
        public UserStatus Status { get; set; } = null!;

        public Guid SubscriptionTypeId { get; set; }
        public SubscriptionType SubscriptionType { get; set; } = null!;

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }

        public DateTime? PasswordChangedAt { get; set; }
        public DateTime? LastSeenAt { get; set; }

        public UserProfile Profile { get; set; } = null!;
        public UserProfileSettings ProfileSettings { get; set; } = null!;
        public ICollection<UserVoiceLayoutPreset> VoiceLayoutPresets { get; set; } = [];
        public ICollection<UserDeviceSession> DeviceSessions { get; set; } = [];
        public ICollection<UserRefreshToken> RefreshTokens { get; set; } = [];
        public ICollection<UserAccountActionToken> AccountActionTokens { get; set; } = [];
        public ICollection<Asset> Assets { get; set; } = [];
        public ICollection<ServerMember> ServerMemberships { get; set; } = [];
        public ICollection<FriendRequest> SentFriendRequests { get; set; } = [];
        public ICollection<FriendRequest> ReceivedFriendRequests { get; set; } = [];
        public ICollection<UserFriend> Friends { get; set; } = [];
        public ICollection<UserFriend> FriendOfUsers { get; set; } = [];
        public ICollection<UserDirectMessageBlock> DirectMessageBlocks { get; set; } = [];
        public ICollection<UserDirectMessageBlock> DirectMessageBlockedBy { get; set; } = [];
    }
}
