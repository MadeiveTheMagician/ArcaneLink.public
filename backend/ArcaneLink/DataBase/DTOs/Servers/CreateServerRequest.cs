using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Servers
{
    public class CreateServerRequest
    {
        [Required]
        [MinLength(3)]
        [MaxLength(128)]
        public string Title { get; set; } = null!;

        [MaxLength(512)]
        public string? Description { get; set; }

        public Guid? IconAssetId { get; set; }

        public double IconCropOffsetX { get; set; }
        public double IconCropOffsetY { get; set; }
        public double IconCropZoom { get; set; } = 1;

        public string AccessMode { get; set; } = "private";
    }
}
