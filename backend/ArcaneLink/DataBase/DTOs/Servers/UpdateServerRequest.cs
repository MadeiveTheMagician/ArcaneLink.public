using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Servers;

public class UpdateServerRequest
{
    [MinLength(3)]
    [MaxLength(128)]
    public string? Title { get; set; }

    [MaxLength(512)]
    public string? Description { get; set; }

    public Guid? IconAssetId { get; set; }

    public double? IconCropOffsetX { get; set; }
    public double? IconCropOffsetY { get; set; }
    public double? IconCropZoom { get; set; }

    public bool ClearIconAsset { get; set; }

    public Guid? DefaultTextSpaceId { get; set; }
    public bool ClearDefaultTextSpace { get; set; }

    public string? AccessMode { get; set; }
}
