namespace ArcaneLink.DataBase.Models.UsersModels
{
    public class ProfileTag
    {
        public Guid Id { get; set; }
        public required string Code { get; set; }
        public required string Title { get; set; }
        public int DisplayOrder { get; set; }

        public ICollection<UserProfileTag> ProfileTags { get; set; } = [];
    }
}
