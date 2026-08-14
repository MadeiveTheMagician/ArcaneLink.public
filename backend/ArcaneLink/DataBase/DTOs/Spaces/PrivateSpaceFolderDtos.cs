using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Spaces
{
    public sealed class PrivateSpaceFolderResponse
    {
        public Guid Id { get; init; }
        public required string Name { get; init; }
        public required string Icon { get; init; }
        public string? Color { get; init; }
        public int Position { get; init; }
        public bool IsSystem { get; init; }
        public bool IsOrderLocked { get; init; }
        public required IReadOnlyList<Guid> SpaceIds { get; init; }
        public required IReadOnlyList<Guid> PinnedSpaceIds { get; init; }
    }

    public sealed class UpsertPrivateSpaceFolderRequest
    {
        public const int NameMaxLength = 12;

        [Required, MaxLength(NameMaxLength)]
        public required string Name { get; init; }

        [Required, MaxLength(16)]
        public required string Icon { get; init; }

        [MaxLength(9)]
        public string? Color { get; init; }

        public IReadOnlyList<Guid> SpaceIds { get; init; } = [];
    }

    public sealed class ReorderPrivateSpaceFoldersRequest
    {
        public IReadOnlyList<Guid> FolderIds { get; init; } = [];
    }

    public sealed class ReorderPrivateSpaceFolderItemsRequest
    {
        public IReadOnlyList<Guid> SpaceIds { get; init; } = [];
    }

    public sealed class SetPrivateSpacePinnedRequest
    {
        public bool IsPinned { get; init; }
    }

    public sealed class SetPrivateSpaceFolderOrderLockRequest
    {
        public bool IsLocked { get; init; }
    }
}
