using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Servers
{
    public class ServerMemberProfileResponse
    {
        public Guid ServerId { get; set; }
        public Guid UserId { get; set; }
        public string Login { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public Guid? AvatarAssetId { get; set; }
        public double AvatarCropOffsetX { get; set; }
        public double AvatarCropOffsetY { get; set; }
        public double AvatarCropZoom { get; set; } = 1;
        public Guid? BannerAssetId { get; set; }
        public string? About { get; set; }
        public string? StatusText { get; set; }
        public DateTime UpdatedAt { get; set; }
        public ServerMemberProfileInheritanceResponse Inheritance { get; set; } = new();
    }

    public sealed class OwnServerMemberProfileResponse : ServerMemberProfileResponse
    {
        public Guid? AvatarSourceAssetId { get; set; }
    }

    public sealed class ServerMemberProfileInheritanceResponse
    {
        public bool DisplayName { get; set; }
        public bool Avatar { get; set; }
        public bool Banner { get; set; }
        public bool About { get; set; }
    }

    public sealed class UpdateServerMemberProfileRequest
    {
        [MinLength(1)]
        [MaxLength(128)]
        public string? DisplayName { get; set; }

        public Guid? AvatarAssetId { get; set; }
        public Guid? AvatarSourceAssetId { get; set; }
        [Range(-1d, 1d)]
        public double? AvatarCropOffsetX { get; set; }
        [Range(-1d, 1d)]
        public double? AvatarCropOffsetY { get; set; }
        [Range(0.5d, 3d)]
        public double? AvatarCropZoom { get; set; }

        public Guid? BannerAssetId { get; set; }

        [MaxLength(512)]
        public string? About { get; set; }

        [MaxLength(128)]
        public string? StatusText { get; set; }

        public bool UseGlobalDisplayName { get; set; }
        public bool UseGlobalAvatar { get; set; }
        public bool UseGlobalBanner { get; set; }
        public bool UseGlobalAbout { get; set; }
        public bool ClearStatusText { get; set; }
    }

    public sealed class SetServerMemberProfileAvatarRequest
    {
        [Range(-1d, 1d)]
        public double CropOffsetX { get; set; }

        [Range(-1d, 1d)]
        public double CropOffsetY { get; set; }

        [Range(0.5d, 3d)]
        public double CropZoom { get; set; } = 1;
    }
}
