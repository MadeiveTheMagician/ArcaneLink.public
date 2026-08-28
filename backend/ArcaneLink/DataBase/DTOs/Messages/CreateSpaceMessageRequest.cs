using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Messages;

public class CreateSpaceMessageRequest
{
    [MaxLength(4000)]
    public string? Body { get; set; }

    public string? Payload { get; set; }
    public Guid? ReplyToMessageId { get; set; }
    public IReadOnlyList<SpaceMessageMentionRequest>? Mentions { get; set; }
    public IReadOnlyList<Guid> AssetIds { get; set; } = [];
    public IReadOnlyList<CreateSpaceMessageAttachmentRequest> Attachments { get; set; } = [];
}
