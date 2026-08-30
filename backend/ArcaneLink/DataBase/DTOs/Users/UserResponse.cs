namespace ArcaneLink.DataBase.DTOs.Users;

public class UserResponse
{
    public Guid Id { get; set; }
    public string Login { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public string Email { get; set; } = null!;
    public SubscriptionTypeResponse SubscriptionType { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string PresenceStatus { get; set; } = "offline";
    public DateTime? LastSeenAt { get; set; }
    public DateTime? EmailConfirmedAt { get; set; }
    public bool RequiresEmailConfirmation => this.EmailConfirmedAt == null;
}
