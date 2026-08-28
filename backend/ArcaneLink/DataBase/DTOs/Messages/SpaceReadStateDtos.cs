namespace ArcaneLink.DataBase.DTOs.Messages;

public sealed class MarkSpaceReadRequest
{
    public Guid ThroughMessageId { get; set; }
}

public sealed class SpaceReadStateResponse
{
    public Guid UserId { get; set; }
    public Guid SpaceId { get; set; }
    public Guid? ServerId { get; set; }
    public Guid? LastReadMessageId { get; set; }
    public DateTime? LastReadMessageCreatedAt { get; set; }
    public DateTime ReadAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public long UnreadCount { get; set; }
    public bool Advanced { get; set; }
}

public sealed class MarkAllPrivateSpacesReadResponse
{
    public int UpdatedSpaceCount { get; set; }
}
