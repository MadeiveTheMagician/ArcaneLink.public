using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.MessagesModels;

public class SpaceMessageReaction
{
    public Guid MessageId { get; set; }
    public SpaceMessage Message { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public required string EmojiCode { get; set; }
    public DateTime CreatedAt { get; set; }
}
