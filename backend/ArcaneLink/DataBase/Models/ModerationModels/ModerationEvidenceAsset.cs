using ArcaneLink.DataBase.Models.AssetsModels;

namespace ArcaneLink.DataBase.Models.ModerationModels
{
    public class ModerationEvidenceAsset
    {
        public Guid Id { get; set; }
        public Guid EvidenceId { get; set; }
        public ModerationEvidence Evidence { get; set; } = null!;
        public Guid AssetId { get; set; }
        public Asset Asset { get; set; } = null!;
        public int DisplayOrder { get; set; }
        public string? DisplayName { get; set; }
        public bool IsSpoiler { get; set; }
        public string? OriginalFileName { get; set; }
        public required string MimeType { get; set; }
        public long SizeBytes { get; set; }
        public required string Sha256 { get; set; }
        public int? Width { get; set; }
        public int? Height { get; set; }
        public DateTime AssetCreatedAt { get; set; }
    }
}
