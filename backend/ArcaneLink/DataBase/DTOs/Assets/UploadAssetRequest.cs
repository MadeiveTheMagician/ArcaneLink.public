using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Assets
{
    // Multipart/form-data request for user asset upload.
    //
    // The client sends only the asset type and file.
    // Backend calculates storage key, size, sha256 and other metadata itself.
    public class UploadAssetRequest
    {
        public Guid AssetTypeId { get; set; }

        [Required]
        public IFormFile File { get; set; } = null!;
    }
}
