using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ServersModels;

public class ServerInvite
{
    public Guid Id { get; set; }

    public Guid ServerId { get; set; }
    public Server Server { get; set; } = null!;

    public Guid CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public Guid KindId { get; set; }
    public ServerInviteKind Kind { get; set; } = null!;

    public string? Code { get; set; }

    public Guid? TargetUserId { get; set; }
    public User? TargetUser { get; set; }

    public int? MaxUses { get; set; }
    public int UsedCount { get; set; }

    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public DateTime? RevokedAt { get; set; }
    public Guid? RevokedByUserId { get; set; }
    public User? RevokedByUser { get; set; }

    public ICollection<ServerInviteUsage> Usages { get; set; } = [];
}
