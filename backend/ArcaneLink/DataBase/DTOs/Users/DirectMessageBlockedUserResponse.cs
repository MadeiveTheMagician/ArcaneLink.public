namespace ArcaneLink.DataBase.DTOs.Users
{
    using System.ComponentModel.DataAnnotations;

    public sealed class UpdateDirectMessageBlockRequest
    {
        public const int CommentMaxLength = 128;

        [MaxLength(CommentMaxLength)]
        public string? Comment { get; set; }
    }

    public sealed class DirectMessageBlockStatusResponse
    {
        public Guid UserId { get; set; }
        public bool IsBlocked { get; set; }
        public string? Comment { get; set; }
        public DateTime? CreatedAt { get; set; }
    }

    public sealed class DirectMessageBlockedUsersPageResponse
    {
        public IReadOnlyList<DirectMessageBlockedUserResponse> Items { get; set; } = [];
        public string? NextCursor { get; set; }
        public long TotalCount { get; set; }
    }

    public class DirectMessageBlockedUserResponse
    {
        public Guid UserId { get; set; }
        public bool IsBlocked { get; set; } = true;
        public required string Login { get; set; }
        public required string DisplayName { get; set; }
        public Guid? AvatarAssetId { get; set; }
        public double AvatarCropOffsetX { get; set; }
        public double AvatarCropOffsetY { get; set; }
        public double AvatarCropZoom { get; set; } = 1;
        public string? Comment { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
