namespace ArcaneLink.DataBase.DTOs.Messages;

public class SpaceMentionAutocompleteResponse
{
    public IReadOnlyList<SpaceMentionUserOptionResponse> Users { get; set; } = [];
    public IReadOnlyList<SpaceMentionRoleOptionResponse> Roles { get; set; } = [];
}

public class SpaceMentionUserOptionResponse
{
    public Guid Id { get; set; }
    public required string Login { get; set; }
    public required string DisplayName { get; set; }
    public Guid? AvatarAssetId { get; set; }
    public double AvatarCropOffsetX { get; set; }
    public double AvatarCropOffsetY { get; set; }
    public double AvatarCropZoom { get; set; } = 1;
}

public class SpaceMentionRoleOptionResponse
{
    public Guid Id { get; set; }
    public required string Title { get; set; }
}
