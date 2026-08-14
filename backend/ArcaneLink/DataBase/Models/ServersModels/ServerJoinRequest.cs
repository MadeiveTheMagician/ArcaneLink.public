using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ServersModels
{
    public class ServerJoinRequest
    {
        public Guid Id { get; set; }

        public Guid ServerId { get; set; }
        public Server Server { get; set; } = null!;

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public required string StatusCode { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public DateTime? ReviewedAt { get; set; }
        public Guid? ReviewedByUserId { get; set; }
        public User? ReviewedByUser { get; set; }
    }
}
