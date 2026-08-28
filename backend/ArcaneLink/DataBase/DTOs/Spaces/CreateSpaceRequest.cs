using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Spaces;

public class CreateSpaceRequest
{
    [Required]
    [MaxLength(32)]
    public required string TypeCode { get; set; }

    public Guid? ParentSpaceId { get; set; }

    [Required]
    [MinLength(1)]
    [MaxLength(128)]
    public required string Title { get; set; }

    [MaxLength(512)]
    public string? Description { get; set; }

    public Guid? RequiredServerRoleId { get; set; }
    public int Position { get; set; }
}
