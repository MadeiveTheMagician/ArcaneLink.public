using ArcaneLink.DataBase.Models.AssetsModels;

namespace ArcaneLink.DataBase.Models.UsersModels
{
    public class UserProfile
    {
        public Guid UserId { get; set; }

        public required string DisplayName { get; set; }
        public required string DisplayNameNorm { get; set; }

        public Guid? AvatarAssetId { get; set; }
        public Asset? AvatarAsset { get; set; }
        public Guid? AvatarSourceAssetId { get; set; }
        public Asset? AvatarSourceAsset { get; set; }
        public double AvatarCropOffsetX { get; set; }
        public double AvatarCropOffsetY { get; set; }
        public double AvatarCropZoom { get; set; } = 1;

        public Guid? BannerAssetId { get; set; }
        public Asset? BannerAsset { get; set; }

        public string? Bio { get; set; }
        public string? WebsiteUrl { get; set; }

        public DateTime UpdatedAt { get; set; }

        public User User { get; set; } = null!;
        public ICollection<UserProfileTag> Tags { get; set; } = [];
    }
}
