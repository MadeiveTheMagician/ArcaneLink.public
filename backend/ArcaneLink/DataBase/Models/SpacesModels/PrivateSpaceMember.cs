using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.SpacesModels
{
    public class PrivateSpaceMember
    {
        public Guid Id { get; set; }

        public Guid SpaceId { get; set; }
        public PrivateSpace PrivateSpace { get; set; } = null!;

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public Guid StatusId { get; set; }
        public PrivateSpaceMemberStatus Status { get; set; } = null!;

        public int ListPosition { get; set; }
        public DateTime ListActivityAt { get; set; }
        public DateTime? PinnedAt { get; set; }
        public string? Note { get; set; }
        public string? PeerNickname { get; set; }
        public Guid? PeerAvatarAssetId { get; set; }
        public Asset? PeerAvatarAsset { get; set; }
        public double PeerAvatarCropOffsetX { get; set; }
        public double PeerAvatarCropOffsetY { get; set; }
        public double PeerAvatarCropZoom { get; set; } = 1;
        public DateTime? MutedUntil { get; set; }
        public bool IsMutedIndefinitely { get; set; }
        public DateTime? HistoryClearedAt { get; set; }
        public DateTime? HiddenFromListAt { get; set; }
        public DateTime JoinedAt { get; set; }
        public DateTime? LeftAt { get; set; }

        public Guid? AddedByUserId { get; set; }
        public User? AddedByUser { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
