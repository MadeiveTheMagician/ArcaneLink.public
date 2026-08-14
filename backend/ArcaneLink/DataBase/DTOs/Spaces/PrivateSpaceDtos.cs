using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Users;
using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Spaces
{
    public class CreatePrivateSpaceRequest
    {
        [MaxLength(128)]
        public string? Title { get; set; }

        [MaxLength(512)]
        public string? Description { get; set; }

        public IReadOnlyList<Guid> MemberUserIds { get; set; } = [];
    }

    public class AddPrivateSpaceMemberRequest
    {
        public Guid UserId { get; set; }
    }

    public sealed class UpdatePrivateSpacePersonalSettingsRequest
    {
        public const int NoteMaxLength = 64;
        public const int CustomNicknameMaxLength = 64;
        public const int MuteModeMaxLength = 16;

        [MaxLength(NoteMaxLength)]
        public string? Note { get; set; }
        public bool ClearNote { get; set; }

        [MaxLength(CustomNicknameMaxLength)]
        public string? CustomNickname { get; set; }
        public bool ClearCustomNickname { get; set; }

        public Guid? CustomAvatarAssetId { get; set; }
        public bool ClearCustomAvatar { get; set; }
        public double? CustomAvatarCropOffsetX { get; set; }
        public double? CustomAvatarCropOffsetY { get; set; }
        public double? CustomAvatarCropZoom { get; set; }

        [MaxLength(MuteModeMaxLength)]
        public string? MuteMode { get; set; }
    }

    public sealed class UploadPrivateSpacePersonalAvatarRequest
    {
        [Required]
        public IFormFile File { get; set; } = null!;

        public string? CropOffsetX { get; set; }
        public string? CropOffsetY { get; set; }
        public string? CropZoom { get; set; }
    }

    public sealed class UpdateGroupPrivateSpaceRequest
    {
        [MaxLength(128)]
        public string? Title { get; set; }
        public bool ClearTitle { get; set; }

        [MaxLength(512)]
        public string? Description { get; set; }
        public bool ClearDescription { get; set; }

        public Guid? AvatarAssetId { get; set; }
        public bool ClearAvatar { get; set; }
        public double? AvatarCropOffsetX { get; set; }
        public double? AvatarCropOffsetY { get; set; }
        public double? AvatarCropZoom { get; set; }
    }

    public sealed class PrivateSpaceViewerSettingsResponse
    {
        public string? Note { get; set; }
        public string? CustomNickname { get; set; }
        public Guid? CustomAvatarAssetId { get; set; }
        public double CustomAvatarCropOffsetX { get; set; }
        public double CustomAvatarCropOffsetY { get; set; }
        public double CustomAvatarCropZoom { get; set; } = 1;
        public DateTime? MutedUntil { get; set; }
        public bool IsMutedIndefinitely { get; set; }
        public bool IsPeerBlocked { get; set; }
    }

    public sealed class PrivateSpaceMembershipMutationResponse
    {
        public Guid SpaceId { get; set; }
        public bool CreatedGroup { get; set; }
        public PrivateSpaceMemberResponse Member { get; set; } = null!;
    }

    public class PrivateSpaceMemberResponse
    {
        public Guid Id { get; set; }
        public Guid SpaceId { get; set; }
        public Guid UserId { get; set; }
        public string StatusCode { get; set; } = "";
        public DateTime JoinedAt { get; set; }
        public DateTime? LeftAt { get; set; }
        public Guid? AddedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public FriendUserResponse User { get; set; } = null!;
    }

    public class PrivateSpaceResponse
    {
        public Guid SpaceId { get; set; }
        public Guid CreatedByUserId { get; set; }
        public Guid OwnerUserId { get; set; }
        public string Kind { get; set; } = "group";
        public string? Title { get; set; }
        public string? Description { get; set; }
        public Guid? AvatarAssetId { get; set; }
        public double AvatarCropOffsetX { get; set; }
        public double AvatarCropOffsetY { get; set; }
        public double AvatarCropZoom { get; set; } = 1;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public long UnreadCount { get; set; }
        public PrivateSpaceViewerSettingsResponse ViewerSettings { get; set; } = new();
        public IReadOnlyList<PrivateSpaceMemberResponse> Members { get; set; } = [];
        public SpaceMessageResponse? LastMessage { get; set; }
    }
}
