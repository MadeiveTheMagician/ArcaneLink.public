namespace ArcaneLink.DataBase.DTOs.Servers
{
    public class ServerLastMessageResponse
    {
        public Guid SpaceId { get; set; }
        public string SpaceTitle { get; set; } = null!;
        public string? Body { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
