namespace ArcaneLink.DataBase.Models.ServersModels;

public class ServerAuditEventType
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
}
