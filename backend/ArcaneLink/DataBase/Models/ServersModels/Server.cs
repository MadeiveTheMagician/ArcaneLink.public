using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ServersModels
{
    public class Server
    {
        public Guid Id { get; set; }

        public Guid CreatedByUserId { get; set; }
        public User CreatedByUser { get; set; } = null!;

        public Guid OwnerUserId { get; set; }
        public User OwnerUser { get; set; } = null!;

        public required string Slug { get; set; }
        public required string Title { get; set; }
        public string? Description { get; set; }

        public Guid? IconAssetId { get; set; }
        public Asset? IconAsset { get; set; }
        public double IconCropOffsetX { get; set; }
        public double IconCropOffsetY { get; set; }
        public double IconCropZoom { get; set; } = 1;

        public Guid? DefaultTextSpaceId { get; set; }
        public Space? DefaultTextSpace { get; set; }

        public required string AccessMode { get; set; }
        public bool IsSystem { get; set; }
        public Guid SpaceAclRevision { get; set; } = Guid.NewGuid();
        public Guid AuthorizationVersion { get; set; } = Guid.NewGuid();

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }

        public ICollection<ServerMember> Members { get; set; } = [];
        public ICollection<ServerRole> Roles { get; set; } = [];
        public ICollection<ServerInvite> Invites { get; set; } = [];
        public ICollection<ServerJoinRequest> JoinRequests { get; set; } = [];
        public ICollection<ServerOwnershipTransfer> OwnershipTransfers { get; set; } = [];
        public ICollection<ServerAuditLog> AuditLogs { get; set; } = [];
        public ICollection<Space> Spaces { get; set; } = [];
    }
}
