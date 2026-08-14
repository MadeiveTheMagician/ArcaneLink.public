namespace ArcaneLink.DataBase.Models.ServersModels
{
    public class ServerInviteKind
    {
        public Guid Id { get; set; }
        public required string Code { get; set; }
        public required string Title { get; set; }
    }
}
