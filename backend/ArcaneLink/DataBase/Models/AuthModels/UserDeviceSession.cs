using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.AuthModels
{
    // Пользовательская сессия устройства/браузера.
    //
    // Одна device session может иметь много refresh tokens,
    // потому что при rotation refresh token меняется,
    // а сессия устройства остаётся той же.
    public class UserDeviceSession
    {
        public Guid Id { get; set; }

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public DateTime CreatedAt { get; set; }
        public DateTime LastUsedAt { get; set; }

        public DateTime? RevokedAt { get; set; }

        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }

        public string? DeviceName { get; set; }

        public ICollection<UserRefreshToken> RefreshTokens { get; set; } = [];

        public bool IsRevoked => RevokedAt != null;
        public bool IsActive => RevokedAt == null;
    }
}