namespace ArcaneLink.DataBase.Models.MessagesModels;

public class SpaceMessageUserDeletion
{
    public Guid MessageId { get; set; }
    public SpaceMessage Message { get; set; } = null!;

    public Guid UserId { get; set; }

    public DateTime DeletedAt { get; set; }
    public DateTime RestoreUntil { get; set; }
}
