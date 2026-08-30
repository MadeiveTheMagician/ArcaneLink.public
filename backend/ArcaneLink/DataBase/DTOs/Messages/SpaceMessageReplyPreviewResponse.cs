namespace ArcaneLink.DataBase.DTOs.Messages;

public class SpaceMessageReplyPreviewResponse
{
    public Guid Id { get; set; }
    public Guid SenderUserId { get; set; }
    public string? SenderDisplayName { get; set; }
    public Guid? SenderAvatarAssetId { get; set; }
    public double SenderAvatarCropOffsetX { get; set; }
    public double SenderAvatarCropOffsetY { get; set; }
    public double SenderAvatarCropZoom { get; set; } = 1;
    public string? Body { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsUnavailable { get; set; }
}
