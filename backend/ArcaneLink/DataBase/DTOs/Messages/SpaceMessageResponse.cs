namespace ArcaneLink.DataBase.DTOs.Messages;

public class SpaceMessageResponse
{
    public Guid Id { get; set; }
    public Guid ServerId { get; set; }
    public Guid SpaceId { get; set; }
    public Guid SenderUserId { get; set; }
    public string SenderDisplayName { get; set; } = "";
    public Guid? SenderAvatarAssetId { get; set; }
    public double SenderAvatarCropOffsetX { get; set; }
    public double SenderAvatarCropOffsetY { get; set; }
    public double SenderAvatarCropZoom { get; set; } = 1;
    public Guid MessageTypeId { get; set; }
    public string MessageTypeCode { get; set; } = "";
    public string? Body { get; set; }
    public string? Payload { get; set; }
    public Guid? ReplyToMessageId { get; set; }
    public SpaceMessageReplyPreviewResponse? ReplyTo { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? EditedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public IReadOnlyList<SpaceMessageAssetResponse> Assets { get; set; } = [];
    public IReadOnlyList<SpaceMessageReactionResponse> Reactions { get; set; } = [];
    public IReadOnlyList<SpaceMessageMentionResponse> Mentions { get; set; } = [];
    public PrivateMessageReceiptResponse? Receipt { get; set; }
}

public sealed class PrivateMessageReceiptResponse
{
    public string StatusCode { get; set; } = "delivered";
    public int RecipientCount { get; set; }
    public int ReadByCount { get; set; }
    public DateTime? ReadAt { get; set; }
}
