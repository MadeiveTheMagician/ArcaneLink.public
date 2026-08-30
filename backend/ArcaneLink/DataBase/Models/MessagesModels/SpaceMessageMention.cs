using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.MessagesModels;

public class SpaceMessageMention
{
    public Guid Id { get; set; }
    public Guid MessageId { get; set; }
    public SpaceMessage Message { get; set; } = null!;
    public required string Kind { get; set; }
    public Guid? TargetUserId { get; set; }
    public User? TargetUser { get; set; }
    public Guid? TargetRoleId { get; set; }
    public ServerRole? TargetRole { get; set; }
    public required string DisplayText { get; set; }
    public int Start { get; set; }
    public int Length { get; set; }
    public DateTime CreatedAt { get; set; }
}
