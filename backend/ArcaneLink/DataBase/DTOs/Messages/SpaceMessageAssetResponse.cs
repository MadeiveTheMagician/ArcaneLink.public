namespace ArcaneLink.DataBase.DTOs.Messages
{
    public class SpaceMessageAssetResponse
    {
        public Guid AssetId { get; set; }
        public int DisplayOrder { get; set; }
        public string FileName { get; set; } = "";
        public string MimeType { get; set; } = "";
        public long SizeBytes { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsSpoiler { get; set; }
    }
}
