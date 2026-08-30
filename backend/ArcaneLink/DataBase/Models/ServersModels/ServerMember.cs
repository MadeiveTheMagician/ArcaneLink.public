using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ServersModels;

public class ServerMember
{
    public Guid Id { get; set; }

    public Guid ServerId { get; set; }
    public Server Server { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid StatusId { get; set; }
    public ServerMemberStatus Status { get; set; } = null!;

    public DateTime JoinedAt { get; set; }
    public DateTime? LeftAt { get; set; }

    public DateTime? BannedAt { get; set; }
    public Guid? BannedByUserId { get; set; }
    public User? BannedByUser { get; set; }
    public string? BanReason { get; set; }

    public Guid? AddedByUserId { get; set; }
    public User? AddedByUser { get; set; }

    public string DisplayColorMode { get; set; } =
        ServerMemberDisplayColorModeCodes.Auto;
    public Guid? DisplayColorRoleId { get; set; }
    public ServerRole? DisplayColorRole { get; set; }
    public Guid RolesVersion { get; set; } = Guid.NewGuid();

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ServerMemberProfile? ServerProfile { get; set; }
    public ICollection<ServerMemberRole> Roles { get; set; } = [];
}
