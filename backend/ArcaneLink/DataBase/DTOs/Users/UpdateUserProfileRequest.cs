using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Users;

public class UpdateUserProfileRequest
{
    [MinLength(1)]
    [MaxLength(128)]
    public string? DisplayName { get; set; }

    [MaxLength(512)]
    public string? Bio { get; set; }

    [MaxLength(255)]
    public string? WebsiteUrl { get; set; }

    public IReadOnlyList<Guid>? TagIds { get; set; }
}
