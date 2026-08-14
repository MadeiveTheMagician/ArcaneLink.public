namespace ArcaneLink.DataBase.Models.UsersModels
{
    public class SubscriptionType
    {
        public Guid Id { get; set; }

        public required string Code { get; set; }

        public required string Title { get; set; }

        public int Rank { get; set; }

        public ICollection<User> Users { get; set; } = [];
    }
}
