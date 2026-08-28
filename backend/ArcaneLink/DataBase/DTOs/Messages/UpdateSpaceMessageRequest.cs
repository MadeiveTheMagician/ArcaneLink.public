using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Messages;

public class UpdateSpaceMessageRequest
{
    [MaxLength(4000)]
    public string? Body { get; set; }

    public string? Payload { get; set; }
    public bool ClearPayload { get; set; }
    public IReadOnlyList<SpaceMessageMentionRequest>? Mentions { get; set; }
}
