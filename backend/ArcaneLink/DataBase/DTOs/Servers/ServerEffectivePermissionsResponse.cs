namespace ArcaneLink.DataBase.DTOs.Servers;

public sealed class ServerEffectivePermissionsResponse
{
    public Guid ServerId { get; set; }
    public Guid MemberId { get; set; }
    public Guid AuthorizationVersion { get; set; }
    public int PermissionSchemaVersion { get; set; }
    public bool IsOwner { get; set; }
    public bool IsAdministrator { get; set; }
    public string AuthorityTier { get; set; } = "everyone";
    public int? AuthorityPosition { get; set; }
    public IReadOnlyList<string> PermissionCodes { get; set; } = [];
}
