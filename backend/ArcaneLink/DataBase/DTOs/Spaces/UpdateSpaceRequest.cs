using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Spaces;

public class UpdateSpaceRequest
{
    [MinLength(1)]
    [MaxLength(128)]
    public string? Title { get; set; }

    [MaxLength(512)]
    public string? Description { get; set; }

    public bool ClearDescription { get; set; }
    public Guid? ParentSpaceId { get; set; }
    public bool ClearParentSpace { get; set; }
    public Guid? RequiredServerRoleId { get; set; }
    public bool ClearRequiredServerRole { get; set; }
    public int? Position { get; set; }
}
