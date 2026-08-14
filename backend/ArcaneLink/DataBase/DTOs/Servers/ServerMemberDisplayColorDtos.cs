using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Servers;

public sealed class UpdateServerMemberDisplayColorRequest
{
    [Required]
    [StringLength(16)]
    public required string Mode { get; set; }

    public Guid? RoleId { get; set; }
    public Guid ExpectedRolesVersion { get; set; }
}

public sealed class ServerMemberDisplayColorRoleResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = "";
    public string Color { get; set; } = "";
    public int Level { get; set; }
}

public sealed class ServerMemberDisplayColorResponse
{
    public string Mode { get; set; } = "auto";
    public Guid? RoleId { get; set; }
    public Guid RolesVersion { get; set; }
    public Guid? ResolvedRoleId { get; set; }
    public string? ResolvedColor { get; set; }
    public IReadOnlyList<ServerMemberDisplayColorRoleResponse> AvailableRoles { get; set; } = [];
}
