namespace ArcaneLink.DataBase.DTOs.Servers
{
    public class ServerMemberResponse
    {
        public Guid Id { get; set; }
        public Guid ServerId { get; set; }
        public Guid UserId { get; set; }
        public string StatusCode { get; set; } = null!;
        public DateTime JoinedAt { get; set; }
        public DateTime? LeftAt { get; set; }
        public Guid? AddedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public long UnreadCount { get; set; }
        public ServerResponse Server { get; set; } = null!;
        public ServerLastMessageResponse? LastMessage { get; set; }
    }
}
