namespace ArcaneLink.DataBase.DTOs.Servers
{
    public sealed class ServerMemberCursorResponse
    {
        public int Priority { get; set; }
        public DateTime JoinedAt { get; set; }
        public Guid Id { get; set; }
    }

    public sealed class ServerMemberPageResponse
    {
        public IReadOnlyList<ServerMemberDetailsResponse> Items { get; set; } = [];
        public ServerMemberCursorResponse? NextCursor { get; set; }
        public int TotalCount { get; set; }
    }

    public class ServerMemberDetailsResponse
    {
        public Guid Id { get; set; }
        public Guid ServerId { get; set; }
        public Guid UserId { get; set; }
        public string StatusCode { get; set; } = null!;
        public bool IsOwner { get; set; }
        public DateTime JoinedAt { get; set; }
        public DateTime? LeftAt { get; set; }
        public Guid? AddedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public IReadOnlyList<string> PermissionCodes { get; set; } = [];
        public IReadOnlyList<ServerMemberRoleResponse> RoleAssignments { get; set; } = [];
        public ServerMemberUserResponse User { get; set; } = null!;
    }
}
