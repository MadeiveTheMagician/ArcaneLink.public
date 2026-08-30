namespace ArcaneLink.DataBase.DTOs.Servers;

public class ServerResponse
{
    public Guid Id { get; set; }
    public Guid CreatedByUserId { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Slug { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public Guid? IconAssetId { get; set; }
    public double IconCropOffsetX { get; set; }
    public double IconCropOffsetY { get; set; }
    public double IconCropZoom { get; set; } = 1;
    public Guid? DefaultTextSpaceId { get; set; }
    public string AccessMode { get; set; } = "private";
    public bool IsSystem { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ServerDiscoveryQuery
{
    public string? Query { get; set; }
    public string? Visibility { get; set; }
    public string? Sort { get; set; }
}

public class ServerDiscoveryResponse
{
    public ServerResponse Server { get; set; } = null!;
    public bool IsMember { get; set; }
    public Guid? MembershipId { get; set; }
    public DateTime? JoinedAt { get; set; }
    public int MemberCount { get; set; }
    public int OnlineMemberCount { get; set; }
    public int TextSpaceCount { get; set; }
    public int VoiceSpaceCount { get; set; }
    public int FriendCount { get; set; }
    public IReadOnlyList<string> CurrentUserRoleTitles { get; set; } = [];
    public DateTime LastActivityAt { get; set; }
    public string JoinAction { get; set; } = "none";
    public ServerJoinRequestResponse? CurrentUserJoinRequest { get; set; }
}
