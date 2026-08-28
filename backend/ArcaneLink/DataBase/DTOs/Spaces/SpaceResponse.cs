namespace ArcaneLink.DataBase.DTOs.Spaces;

public class SpaceResponse
{
    public Guid Id { get; set; }
    public Guid? ServerId { get; set; }
    public Guid TypeId { get; set; }
    public string TypeCode { get; set; } = "";
    public Guid? ParentSpaceId { get; set; }
    public Guid? VoiceChatSpaceId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public Guid? RequiredServerRoleId { get; set; }
    public int Position { get; set; }
    public bool IsSystem { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public long UnreadCount { get; set; }
    public SpaceEffectiveCapabilitiesResponse EffectiveCapabilities { get; set; } = new();
    public IReadOnlyList<SpacePermissionOverrideResponse> PermissionOverrides { get; set; } = [];
}

public class SpaceEffectiveCapabilitiesResponse
{
    public bool CanSendMessages { get; set; }
    public bool CanConnectVoice { get; set; }
    public bool CanManageSpace { get; set; }
    public bool CanManageSpaceAccess { get; set; }
}
