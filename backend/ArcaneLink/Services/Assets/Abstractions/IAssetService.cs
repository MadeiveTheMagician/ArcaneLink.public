using ArcaneLink.DataBase.DTOs.Assets;

namespace ArcaneLink.Services.Assets.Abstractions
{
    public interface IAssetService
    {
        // Uploads a user file, saves it to storage and creates the asset record.
        // The backend calculates size, sha256 and storage key itself.
        Task<AssetResponse> UploadAssetAsync(
            Guid ownerUserId,
            UploadAssetRequest request,
            CancellationToken cancellationToken = default);

        Task<AssetResponse> UploadOptimizedAvatarAsync(
            Guid ownerUserId,
            IFormFile file,
            int sizePixels,
            CancellationToken cancellationToken = default);

        Task<AssetResponse> UploadMessageAttachmentAsync(
            Guid ownerUserId,
            IFormFile file,
            CancellationToken cancellationToken = default);

        // Returns an active asset only when it is readable by the current user.
        //
        // Public profile/server assets permit an anonymous currentUserId.
        // Message attachments are checked against their live message space.
        Task<AssetResponse?> GetReadableAssetAsync(
            Guid? currentUserId,
            Guid assetId,
            CancellationToken cancellationToken = default);

        // Returns active assets owned by a user.
        //
        // When assetTypeId is provided, only assets of that type are returned.
        Task<IReadOnlyList<AssetResponse>> GetOwnedAssetsAsync(
            Guid ownerUserId,
            Guid? assetTypeId = null,
            CancellationToken cancellationToken = default);

        // Opens asset file content only when it is readable by the current user.
        //
        // Returns null if metadata or physical content is missing.
        Task<AssetContentResponse?> GetReadableAssetContentAsync(
            Guid? currentUserId,
            Guid assetId,
            CancellationToken cancellationToken = default);

        // Opens active asset bytes for an already-authorized internal workflow.
        // API endpoints must use GetReadableAssetContentAsync instead.
        Task<AssetContentResponse?> GetAssetContentAsync(
            Guid assetId,
            CancellationToken cancellationToken = default);

        // Opens bytes for an immutable moderation evidence reference. Unlike
        // normal asset reads this permits a soft-deleted asset, but never one
        // whose physical bytes were already removed.
        Task<AssetContentResponse?> GetRetainedAssetContentAsync(
            Guid assetId,
            CancellationToken cancellationToken = default);

        Task<OwnedAssetDeleteResult> DeleteOwnedAssetAsync(
            Guid ownerUserId,
            Guid assetId,
            CancellationToken cancellationToken = default);
    }

    public enum OwnedAssetDeleteResult
    {
        Deleted,
        NotFound,
        ManagedByDomain
    }
}
