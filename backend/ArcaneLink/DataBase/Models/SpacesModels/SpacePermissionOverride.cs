using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.SpacesModels
{
    public class SpacePermissionOverride
    {
        public Guid Id { get; set; }

        public Guid ServerId { get; set; }
        public Server Server { get; set; } = null!;

        public Guid SpaceId { get; set; }
        public Space Space { get; set; } = null!;

        public Guid? RoleId { get; set; }
        public ServerRole? Role { get; set; }

        public Guid? MemberId { get; set; }
        public ServerMember? Member { get; set; }

        public Guid PermissionId { get; set; }
        public PermissionCatalog Permission { get; set; } = null!;

        public bool Allow { get; set; }
        public bool Deny { get; set; }

        public Guid? CreatedByUserId { get; set; }
        public User? CreatedByUser { get; set; }

        public Guid? ProtectionRoleId { get; set; }
        public ServerRole? ProtectionRole { get; set; }

        public Guid Version { get; set; } = Guid.NewGuid();

        public DateTime CreatedAt { get; set; }
    }
}
