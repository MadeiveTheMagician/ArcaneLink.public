namespace ArcaneLink.DataBase.DTOs.Spaces;

public class UpsertSpacePermissionOverrideRequest
{
    public Guid? RoleId { get; set; }
    public Guid? MemberId { get; set; }
    public Guid PermissionId { get; set; }
    public bool Allow { get; set; }
    public bool Deny { get; set; }
}
