using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.MessagesModels
{
    public class SpacePinnedMessage
    {
        public Guid Id { get; set; }

        public Guid SpaceId { get; set; }
        public Space Space { get; set; } = null!;

        public Guid MessageId { get; set; }
        public SpaceMessage Message { get; set; } = null!;

        public Guid PinnedByUserId { get; set; }
        public User PinnedByUser { get; set; } = null!;

        public DateTime PinnedAt { get; set; }
        public DateTime? UnpinnedAt { get; set; }

        public Guid? UnpinnedByUserId { get; set; }
        public User? UnpinnedByUser { get; set; }
    }
}
