namespace ArcaneLink.DataBase.DTOs.Users;

public class PublicUserProfileResponse
{
    public Guid Id { get; set; }
    public string Login { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public Guid? AvatarAssetId { get; set; }
    public double AvatarCropOffsetX { get; set; }
    public double AvatarCropOffsetY { get; set; }
    public double AvatarCropZoom { get; set; } = 1;
    public Guid? BannerAssetId { get; set; }
    public string? Bio { get; set; }
    public string? WebsiteUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public string PresenceStatus { get; set; } = "offline";
    public DateTime? LastSeenAt { get; set; }
    public SubscriptionTypeResponse? SubscriptionType { get; set; }
    public IReadOnlyList<ProfileTagResponse> Tags { get; set; } = [];
}

public sealed class OwnUserProfileResponse : PublicUserProfileResponse
{
    public Guid? AvatarSourceAssetId { get; set; }
}
