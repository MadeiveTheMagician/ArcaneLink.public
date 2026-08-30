using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Messages;

public class CreateSpaceMessageAttachmentRequest
{
    public Guid AssetId { get; set; }

    [MaxLength(255)]
    public string? DisplayName { get; set; }

    public bool IsSpoiler { get; set; }
}
