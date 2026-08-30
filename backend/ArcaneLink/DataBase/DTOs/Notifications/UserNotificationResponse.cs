namespace ArcaneLink.DataBase.DTOs.Notifications;

public class UserNotificationResponse
{
    public Guid Id { get; set; }
    public required string Kind { get; set; }
    public required string Title { get; set; }
    public required string Body { get; set; }
    public string? Detail { get; set; }
    public Guid? ActorUserId { get; set; }
    public string? ActorDisplayName { get; set; }
    public Guid? ActorAvatarAssetId { get; set; }
    public double ActorAvatarCropOffsetX { get; set; }
    public double ActorAvatarCropOffsetY { get; set; }
    public double ActorAvatarCropZoom { get; set; } = 1;
    public Guid? ServerId { get; set; }
    public string? ServerTitle { get; set; }
    public Guid? ServerIconAssetId { get; set; }
    public double ServerIconCropOffsetX { get; set; }
    public double ServerIconCropOffsetY { get; set; }
    public double ServerIconCropZoom { get; set; } = 1;
    public Guid? SpaceId { get; set; }
    public string? SpaceTitle { get; set; }
    public Guid? MessageId { get; set; }
    public DateTime? MessageCreatedAt { get; set; }
    public Guid? InviteId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }
}
