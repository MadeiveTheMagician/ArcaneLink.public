namespace ArcaneLink.DataBase.DTOs.Servers;

public class ServerMemberUserResponse
{
    public Guid Id { get; set; }
    public string Login { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public Guid? AvatarAssetId { get; set; }
    public double AvatarCropOffsetX { get; set; }
    public double AvatarCropOffsetY { get; set; }
    public double AvatarCropZoom { get; set; } = 1;
    public Guid? BannerAssetId { get; set; }
    public string? About { get; set; }
    public string? ServerStatusText { get; set; }
    public bool UsesServerProfile { get; set; }
    public string PresenceStatus { get; set; } = "offline";
    public DateTime? LastSeenAt { get; set; }
}
