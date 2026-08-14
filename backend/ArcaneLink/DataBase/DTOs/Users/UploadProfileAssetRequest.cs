using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Users
{
    // Multipart/form-data request for profile visual assets.
    //
    // Asset type is intentionally not accepted from the client here:
    // avatar/banner endpoints choose the correct type server-side.
    public class UploadProfileAssetRequest
    {
        [Required]
        public IFormFile File { get; set; } = null!;

        // Used by avatar uploads. Banner uploads intentionally ignore these values.
        public string? CropOffsetX { get; set; }
        public string? CropOffsetY { get; set; }
        public string? CropZoom { get; set; }
    }
}
