using ArcaneLink.DataBase.Models.AssetsModels;

namespace ArcaneLink.DataBase.Models.ServersModels;

public sealed class ServerMemberProfile
{
    public Guid ServerMemberId { get; set; }
    public ServerMember ServerMember { get; set; } = null!;

    public string? DisplayName { get; set; }
    public string? DisplayNameNorm { get; set; }

    public Guid? AvatarAssetId { get; set; }
    public Asset? AvatarAsset { get; set; }
    public Guid? AvatarSourceAssetId { get; set; }
    public Asset? AvatarSourceAsset { get; set; }
    public double AvatarCropOffsetX { get; set; }
    public double AvatarCropOffsetY { get; set; }
    public double AvatarCropZoom { get; set; } = 1;

    public Guid? BannerAssetId { get; set; }
    public Asset? BannerAsset { get; set; }

    public string? About { get; set; }
    public string? StatusText { get; set; }
    public DateTime UpdatedAt { get; set; }
}
