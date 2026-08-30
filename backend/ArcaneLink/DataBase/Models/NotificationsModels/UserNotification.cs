using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.NotificationsModels;

public class UserNotification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public required string Kind { get; set; }
    public required string Title { get; set; }
    public required string Body { get; set; }
    public string? Detail { get; set; }
    public Guid? ActorUserId { get; set; }
    public User? ActorUser { get; set; }
    public Guid? ServerId { get; set; }
    public Server? Server { get; set; }
    public Guid? SpaceId { get; set; }
    public Space? Space { get; set; }
    public Guid? MessageId { get; set; }
    public SpaceMessage? Message { get; set; }
    public Guid? InviteId { get; set; }
    public ServerInvite? Invite { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }
}
