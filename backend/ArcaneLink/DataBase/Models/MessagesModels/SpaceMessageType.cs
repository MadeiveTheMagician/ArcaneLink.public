namespace ArcaneLink.DataBase.Models.MessagesModels;

public class SpaceMessageType
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Title { get; set; }

    public ICollection<SpaceMessage> Messages { get; set; } = [];
}
