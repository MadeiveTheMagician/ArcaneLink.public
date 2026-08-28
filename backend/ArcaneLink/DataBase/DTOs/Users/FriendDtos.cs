namespace ArcaneLink.DataBase.DTOs.Users;

public class CreateFriendRequestRequest
{
    public Guid ToUserId { get; set; }
}

public class ProfileTagResponse
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
}

public class UpdateUserProfileTagsRequest
{
    public IReadOnlyList<Guid> TagIds { get; set; } = [];
}

public class UserDiscoveryQuery
{
    public string? Query { get; set; }
    public string? Scope { get; set; }
    public string? Sort { get; set; }
    public bool? Online { get; set; }
    public Guid[] TagIds { get; set; } = [];
}

public class FriendUserResponse
{
    public Guid Id { get; set; }
    public string Login { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public Guid? AvatarAssetId { get; set; }
    public double AvatarCropOffsetX { get; set; }
    public double AvatarCropOffsetY { get; set; }
    public double AvatarCropZoom { get; set; } = 1;
    public string PresenceStatus { get; set; } = "offline";
    public DateTime? LastSeenAt { get; set; }
    public IReadOnlyList<ProfileTagResponse> Tags { get; set; } = [];
    public int MutualServerCount { get; set; }
    public int MutualFriendCount { get; set; }
    public int SharedTagCount { get; set; }
    public int RecommendationScore { get; set; }
    public bool IsFriend { get; set; }
    public bool HasIncomingFriendRequest { get; set; }
    public bool HasOutgoingFriendRequest { get; set; }
}

public class FriendRequestResponse
{
    public Guid Id { get; set; }
    public Guid FromUserId { get; set; }
    public Guid ToUserId { get; set; }
    public string StatusCode { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
    public FriendUserResponse FromUser { get; set; } = null!;
    public FriendUserResponse ToUser { get; set; } = null!;
}

public class UserFriendResponse
{
    public Guid UserId { get; set; }
    public Guid FriendUserId { get; set; }
    public Guid CreatedByRequestId { get; set; }
    public DateTime CreatedAt { get; set; }
    public FriendUserResponse Friend { get; set; } = null!;
}
