using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ModerationModels;

public class ModerationCaseAction
{
    public Guid Id { get; set; }
    public Guid CaseId { get; set; }
    public ModerationCase Case { get; set; } = null!;
    public Guid? ActorUserId { get; set; }
    public User? ActorUser { get; set; }
    public required string FromStatus { get; set; }
    public required string ToStatus { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}
