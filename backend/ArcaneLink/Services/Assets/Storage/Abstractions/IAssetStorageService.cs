namespace ArcaneLink.Services.Assets.Storage.Abstractions
{
    public interface IAssetStorageService
    {
        // Saves already validated file bytes and returns an internal storage key.
        // Implementations decide where bytes live: local disk, S3, CDN origin, etc.
        Task<AssetStorageSaveResult> SaveAsync(
            Guid assetId,
            Guid ownerUserId,
            string assetTypeCode,
            string fileExtension,
            Stream content,
            CancellationToken cancellationToken = default);

        // Opens stored asset content for reading by internal storage key.
        // Returns null when the physical file/object is missing.
        Task<AssetStorageReadResult?> OpenReadAsync(
            string storageKey,
            CancellationToken cancellationToken = default);

        Task DeleteAsync(
            string storageKey,
            CancellationToken cancellationToken = default);
    }
}
