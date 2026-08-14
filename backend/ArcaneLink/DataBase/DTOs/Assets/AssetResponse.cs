namespace ArcaneLink.DataBase.DTOs.Assets
{
    // Safe API/service response with public asset metadata.
    public class AssetResponse
    {
        public Guid Id { get; set; }
        public Guid? OwnerUserId { get; set; }
        public Guid AssetTypeId { get; set; }
        public string AssetTypeCode { get; set; } = null!;
        public string? OriginalFileName { get; set; }
        public string MimeType { get; set; } = null!;
        public long SizeBytes { get; set; }
        public string Sha256 { get; set; } = null!;
        public int? Width { get; set; }
        public int? Height { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
