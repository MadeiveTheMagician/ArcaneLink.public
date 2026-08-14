using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ServersModels
{
    public class ServerInviteUsage
    {
        public Guid Id { get; set; }

        public Guid InviteId { get; set; }
        public ServerInvite Invite { get; set; } = null!;

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public DateTime UsedAt { get; set; }
    }
}
