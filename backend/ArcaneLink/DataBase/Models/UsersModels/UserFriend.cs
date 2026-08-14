namespace ArcaneLink.DataBase.Models.UsersModels
{
    public class UserFriend
    {
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public Guid FriendUserId { get; set; }
        public User FriendUser { get; set; } = null!;

        public Guid CreatedByRequestId { get; set; }
        public FriendRequest CreatedByRequest { get; set; } = null!;

        public DateTime CreatedAt { get; set; }
    }
}
