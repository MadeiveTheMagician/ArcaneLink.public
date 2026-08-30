using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ServersModels;

public class ServerMemberRole
{
    public Guid Id { get; set; }

    public Guid ServerId { get; set; }
    public Server Server { get; set; } = null!;

    public Guid MemberId { get; set; }
    public ServerMember Member { get; set; } = null!;

    public Guid RoleId { get; set; }
    public ServerRole Role { get; set; } = null!;

    public Guid? AssignedByUserId { get; set; }
    public User? AssignedByUser { get; set; }

    public DateTime AssignedAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public Guid? RevokedByUserId { get; set; }
    public User? RevokedByUser { get; set; }
}
