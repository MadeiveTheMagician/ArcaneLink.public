using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ServersModels
{
    public class ServerRole
    {
        public Guid Id { get; set; }

        public Guid ServerId { get; set; }
        public Server Server { get; set; } = null!;

        public string? Code { get; set; }
        public required string Title { get; set; }
        public string? Description { get; set; }

        public string Kind { get; set; } = ServerRoleKindCodes.Standard;
        public string? Color { get; set; }
        public bool Mentionable { get; set; }

        public Guid? CreatedByUserId { get; set; }
        public User? CreatedByUser { get; set; }

        public int Level { get; set; }
        public bool IsSystem { get; set; }
        public byte[] PermissionMask { get; set; } = new byte[32];
        public int PermissionSchemaVersion { get; set; } = 1;
        public Guid Version { get; set; } = Guid.NewGuid();

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }

        public ICollection<ServerRolePermission> Permissions { get; set; } = [];
        public ICollection<ServerMemberRole> MemberRoles { get; set; } = [];
    }
}
