namespace ArcaneLink.DataBase.Models.ServersModels;

public class ServerRolePermission
{
    public Guid RoleId { get; set; }
    public ServerRole Role { get; set; } = null!;

    public Guid PermissionId { get; set; }
    public PermissionCatalog Permission { get; set; } = null!;

    public bool IsGranted { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}
