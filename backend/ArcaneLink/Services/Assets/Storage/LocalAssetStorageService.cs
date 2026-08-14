using ArcaneLink.Services.Assets.Storage.Abstractions;

namespace ArcaneLink.Services.Assets.Storage
{
    public class LocalAssetStorageService : IAssetStorageService
    {
        private readonly IWebHostEnvironment _environment;

        public LocalAssetStorageService(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        public async Task<AssetStorageSaveResult> SaveAsync(
            Guid assetId,
            Guid ownerUserId,
            string assetTypeCode,
            string fileExtension,
            Stream content,
            CancellationToken cancellationToken = default)
        {
            // Local storage is an MVP implementation. It can be replaced by
            // S3-compatible storage without changing AssetService or controllers.
            var storageKey = Path.Combine(
                    "assets",
                    assetTypeCode,
                    ownerUserId.ToString(),
                    $"{assetId}{fileExtension}")
                .Replace('\\', '/');

            var absolutePath = Path.Combine(
                _environment.ContentRootPath,
                "storage",
                storageKey.Replace('/', Path.DirectorySeparatorChar));

            var directory = Path.GetDirectoryName(absolutePath)
                ?? throw new InvalidOperationException("Asset storage path is invalid.");

            Directory.CreateDirectory(directory);
            content.Position = 0;

            await using var fileStream = new FileStream(
                absolutePath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None);

            await content.CopyToAsync(fileStream, cancellationToken);

            return new AssetStorageSaveResult
            {
                StorageKey = storageKey
            };
        }

        public Task<AssetStorageReadResult?> OpenReadAsync(
            string storageKey,
            CancellationToken cancellationToken = default)
        {
            var absolutePath = GetSafeAbsolutePath(storageKey);

            if (!File.Exists(absolutePath))
            {
                return Task.FromResult<AssetStorageReadResult?>(null);
            }

            Stream stream = new FileStream(
                absolutePath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read);

            return Task.FromResult<AssetStorageReadResult?>(
                new AssetStorageReadResult
                {
                    Content = stream
                });
        }

        public Task DeleteAsync(
            string storageKey,
            CancellationToken cancellationToken = default)
        {
            var absolutePath = GetSafeAbsolutePath(storageKey);

            if (File.Exists(absolutePath))
            {
                File.Delete(absolutePath);
            }

            return Task.CompletedTask;
        }

        private string GetSafeAbsolutePath(string storageKey)
        {
            var storageRoot = Path.GetFullPath(
                Path.Combine(_environment.ContentRootPath, "storage"));
            var normalizedStorageKey = storageKey
                .Replace('\\', Path.DirectorySeparatorChar)
                .Replace('/', Path.DirectorySeparatorChar);

            var absolutePath = Path.GetFullPath(
                Path.Combine(storageRoot, normalizedStorageKey));
            var relativePath = Path.GetRelativePath(storageRoot, absolutePath);

            if (Path.IsPathRooted(relativePath) ||
                relativePath.Equals("..", StringComparison.Ordinal) ||
                relativePath.StartsWith(
                    $"..{Path.DirectorySeparatorChar}",
                    StringComparison.Ordinal) ||
                relativePath.StartsWith(
                    $"..{Path.AltDirectorySeparatorChar}",
                    StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Asset storage key is invalid.");
            }

            return absolutePath;
        }
    }
}
