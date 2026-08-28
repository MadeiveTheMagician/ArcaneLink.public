using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.AuthModels;

public sealed class UserAccountActionToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public required string Purpose { get; set; }
    public required string TokenHash { get; set; }
    public string? PendingValue { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConsumedAt { get; set; }
}
