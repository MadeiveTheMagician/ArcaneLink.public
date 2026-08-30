using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.MessagesModels;

public sealed class PrivateMessageRecipient
{
    public Guid MessageId { get; set; }
    public SpaceMessage Message { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
}
