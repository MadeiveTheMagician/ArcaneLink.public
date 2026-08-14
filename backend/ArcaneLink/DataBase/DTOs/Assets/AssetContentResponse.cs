namespace ArcaneLink.DataBase.DTOs.Assets
{
    // Represents asset bytes ready to be returned by an API endpoint.
    //
    // Caller owns Content lifetime and should dispose it after response handling.
    public class AssetContentResponse
    {
        public required Stream Content { get; set; }
        public required string MimeType { get; set; }
        public required string FileName { get; set; }
        public required string Sha256 { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsSafeInline { get; set; }
        public bool IsPubliclyCacheable { get; set; }
    }
}
