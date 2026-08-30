using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.MessagesModels;

public class SpaceReadState
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid SpaceId { get; set; }
    public Space Space { get; set; } = null!;

    public Guid? LastReadMessageId { get; set; }

    public DateTime? LastReadMessageCreatedAt { get; set; }
    public DateTime ReadAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
