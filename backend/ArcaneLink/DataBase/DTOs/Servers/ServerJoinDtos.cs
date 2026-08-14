namespace ArcaneLink.DataBase.DTOs.Servers
{
    public class ServerJoinResponse
    {
        public string Status { get; set; } = "";
        public ServerMemberResponse? Membership { get; set; }
        public ServerJoinRequestResponse? JoinRequest { get; set; }
    }

    public class ServerJoinRequestResponse
    {
        public Guid Id { get; set; }
        public Guid ServerId { get; set; }
        public Guid UserId { get; set; }
        public string StatusCode { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public Guid? ReviewedByUserId { get; set; }
        public ServerJoinRequestUserResponse User { get; set; } = null!;
    }

    public class ServerJoinRequestUserResponse
    {
        public Guid Id { get; set; }
        public string Login { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public Guid? AvatarAssetId { get; set; }
        public double AvatarCropOffsetX { get; set; }
        public double AvatarCropOffsetY { get; set; }
        public double AvatarCropZoom { get; set; } = 1;
    }

    public class ServerJoinRequestPageResponse
    {
        public IReadOnlyList<ServerJoinRequestResponse> Items { get; set; } = [];
        public ServerJoinRequestCursorResponse? NextCursor { get; set; }
        public int TotalCount { get; set; }
    }

    public class ServerJoinRequestCursorResponse
    {
        public DateTime CreatedAt { get; set; }
        public Guid Id { get; set; }
    }
}
