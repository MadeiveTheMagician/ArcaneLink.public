namespace ArcaneLink.DataBase.Models.UsersModels
{
    public class UserDirectMessageBlock
    {
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public Guid BlockedUserId { get; set; }
        public User BlockedUser { get; set; } = null!;

        public string? Comment { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
