namespace ArcaneLink.DataBase.Models.UsersModels;

public class UserProfileTag
{
    public Guid UserId { get; set; }
    public Guid TagId { get; set; }
    public DateTime CreatedAt { get; set; }

    public UserProfile Profile { get; set; } = null!;
    public ProfileTag Tag { get; set; } = null!;
}
