using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.AuthModels
{
    public class UserRefreshToken
    {
        public Guid Id { get; set; }

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public string TokenHash { get; set; } = null!;

        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }

        public DateTime? RevokedAt { get; set; }
        public Guid? ReplacedByTokenId { get; set; }

        public UserRefreshToken? ReplacedByToken { get; set; }
        public Guid? DeviceSessionId { get; set; }
        public UserDeviceSession? DeviceSession { get; set; }

        public string? CreatedByIp { get; set; }
        public string? RevokedByIp { get; set; }

        public string? UserAgent { get; set; }

        public bool IsRevoked => this.RevokedAt != null;
        public bool IsExpired => DateTime.UtcNow >= this.ExpiresAt;
        public bool IsActive => !this.IsRevoked && !this.IsExpired;
    }
}
