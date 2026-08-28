namespace ArcaneLink.DataBase.DTOs.Spaces;

public class SpacePermissionOverrideResponse
{
    public Guid Id { get; set; }
    public Guid SpaceId { get; set; }
    public Guid? RoleId { get; set; }
    public Guid? MemberId { get; set; }
    public Guid PermissionId { get; set; }
    public string PermissionCode { get; set; } = "";
    public bool Allow { get; set; }
    public bool Deny { get; set; }
    public DateTime CreatedAt { get; set; }
}
