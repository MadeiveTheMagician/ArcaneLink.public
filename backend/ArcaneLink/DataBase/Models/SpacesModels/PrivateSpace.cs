using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.SpacesModels
{
    public class PrivateSpace
    {
        public Guid SpaceId { get; set; }
        public Space Space { get; set; } = null!;

        public Guid CreatedByUserId { get; set; }
        public User CreatedByUser { get; set; } = null!;
        public Guid OwnerUserId { get; set; }
        public User OwnerUser { get; set; } = null!;

        public string Kind { get; set; } = PrivateSpaceKindCodes.Group;
        public Guid? DirectUserLowId { get; set; }
        public User? DirectUserLow { get; set; }
        public Guid? DirectUserHighId { get; set; }
        public User? DirectUserHigh { get; set; }

        public string? Title { get; set; }
        public string? Description { get; set; }
        public Guid? AvatarAssetId { get; set; }
        public Asset? AvatarAsset { get; set; }
        public double AvatarCropOffsetX { get; set; }
        public double AvatarCropOffsetY { get; set; }
        public double AvatarCropZoom { get; set; } = 1;

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }

        public ICollection<PrivateSpaceMember> Members { get; set; } = [];
    }
}
