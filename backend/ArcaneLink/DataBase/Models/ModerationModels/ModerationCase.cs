using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ModerationModels;

public class ModerationCase
{
    public Guid Id { get; set; }
    public Guid ServerId { get; set; }
    public Server Server { get; set; } = null!;
    public Guid SpaceId { get; set; }
    public Space Space { get; set; } = null!;
    public Guid MessageId { get; set; }
    public SpaceMessage Message { get; set; } = null!;
    public Guid ReportedUserId { get; set; }
    public User ReportedUser { get; set; } = null!;
    public required string Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<ModerationSubmission> Submissions { get; set; } = [];
    public ICollection<ModerationCaseAction> Actions { get; set; } = [];
}
