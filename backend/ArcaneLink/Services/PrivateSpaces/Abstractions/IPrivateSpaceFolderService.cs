using ArcaneLink.DataBase.DTOs.Spaces;

namespace ArcaneLink.Services.PrivateSpaces.Abstractions
{
    public interface IPrivateSpaceFolderService
    {
        Task<IReadOnlyList<PrivateSpaceFolderResponse>> GetFoldersAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<PrivateSpaceFolderMutationResult> CreateFolderAsync(Guid userId, UpsertPrivateSpaceFolderRequest request, CancellationToken cancellationToken = default);
        Task<PrivateSpaceFolderMutationResult> UpdateFolderAsync(Guid userId, Guid folderId, UpsertPrivateSpaceFolderRequest request, CancellationToken cancellationToken = default);
        Task<bool> DeleteFolderAsync(Guid userId, Guid folderId, CancellationToken cancellationToken = default);
        Task<bool> AddSpaceAsync(Guid userId, Guid folderId, Guid spaceId, CancellationToken cancellationToken = default);
        Task<bool> RemoveSpaceAsync(Guid userId, Guid folderId, Guid spaceId, CancellationToken cancellationToken = default);
        Task<bool> ReorderFoldersAsync(Guid userId, IReadOnlyList<Guid> folderIds, CancellationToken cancellationToken = default);
        Task<bool> ReorderItemsAsync(Guid userId, Guid folderId, IReadOnlyList<Guid> spaceIds, CancellationToken cancellationToken = default);
        Task<PrivateSpaceFolderResponse?> SetPinnedAsync(Guid userId, Guid folderId, Guid spaceId, bool isPinned, CancellationToken cancellationToken = default);
        Task<PrivateSpaceFolderResponse?> SetOrderLockedAsync(Guid userId, Guid folderId, bool isLocked, CancellationToken cancellationToken = default);
    }

    public sealed record PrivateSpaceFolderMutationResult(
        PrivateSpaceFolderResponse? Folder,
        string? ErrorCode = null);
}
