using ArcaneLink.DataBase.Models.AssetsModels;

namespace ArcaneLink.DataBase.Models.MessagesModels;

public class SpaceMessageAsset
{
    public Guid MessageId { get; set; }
    public SpaceMessage Message { get; set; } = null!;

    public Guid AssetId { get; set; }
    public Asset Asset { get; set; } = null!;

    public int DisplayOrder { get; set; }

    public string? DisplayName { get; set; }

    public bool IsSpoiler { get; set; }
}
