using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ServersModels;

public class ServerAuditLog
{
    public Guid Id { get; set; }

    public Guid ServerId { get; set; }
    public Server Server { get; set; } = null!;

    public Guid EventTypeId { get; set; }
    public ServerAuditEventType EventType { get; set; } = null!;

    public Guid? ActorUserId { get; set; }
    public User? ActorUser { get; set; }

    public Guid? TargetUserId { get; set; }
    public User? TargetUser { get; set; }

    public Guid? RelatedRoleId { get; set; }
    public ServerRole? RelatedRole { get; set; }

    public Guid? RelatedInviteId { get; set; }
    public ServerInvite? RelatedInvite { get; set; }

    public Guid? RelatedSpaceId { get; set; }
    public Space? RelatedSpace { get; set; }

    public string? Payload { get; set; }
    public DateTime CreatedAt { get; set; }
}
