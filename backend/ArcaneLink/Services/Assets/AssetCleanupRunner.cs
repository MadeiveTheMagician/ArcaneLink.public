using ArcaneLink.DataBase._Data;
using ArcaneLink.Observability;
using ArcaneLink.Services.Assets.Storage.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Assets
{
    public sealed record AssetCleanupRunResult(
        int Candidates,
        int Deleted,
        int Failed,
        bool DryRun,
        DateTime CutoffUtc);

    public sealed class AssetCleanupRunner
    {
        private readonly AppDbContext _db;
        private readonly IAssetStorageService _storage;
        private readonly AssetCleanupOptions _options;
        private readonly TimeProvider _timeProvider;
        private readonly ILogger<AssetCleanupRunner> _logger;

        public AssetCleanupRunner(
            AppDbContext db,
            IAssetStorageService storage,
            IOptions<AssetCleanupOptions> options,
            TimeProvider timeProvider,
            ILogger<AssetCleanupRunner> logger)
        {
            _db = db;
            _storage = storage;
            _options = options.Value;
            _timeProvider = timeProvider;
            _logger = logger;
        }

        public async Task<AssetCleanupRunResult> RunOnceAsync(
            CancellationToken cancellationToken = default)
        {
            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var cutoff = now.AddDays(-Math.Max(0, _options.RetentionDays));
            var batchSize = Math.Clamp(_options.BatchSize, 1, 1000);

            var assets = await _db.Assets
                .Where(x => x.DeletedAt != null &&
                            x.DeletedAt <= cutoff &&
                            x.PhysicalDeletedAt == null &&
                            !_db.ModerationEvidenceAssets.Any(evidence =>
                                evidence.AssetId == x.Id))
                .OrderBy(x => x.DeletedAt)
                .ThenBy(x => x.Id)
                .Take(batchSize)
                .ToListAsync(cancellationToken);

            var deletedCount = 0;
            var failedCount = 0;

            if (!_options.DryRun)
            {
                foreach (var asset in assets)
                {
                    try
                    {
                        await _storage.DeleteAsync(asset.StorageKey, cancellationToken);
                        asset.PhysicalDeletedAt = now;
                        deletedCount++;
                    }
                    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                    {
                        throw;
                    }
                    catch (Exception exception)
                    {
                        failedCount++;
                        ArcaneLinkDiagnostics.AssetPhysicalDeleteFailedCounter.Add(1);
                        _logger.LogError(
                            ObservabilityEventIds.AssetPhysicalDeleteFailed,
                            exception,
                            "Asset cleanup failed to delete bytes. AssetId={AssetId} StorageKey={StorageKey}",
                            asset.Id,
                            asset.StorageKey);
                    }
                }

                if (deletedCount > 0)
                {
                    await _db.SaveChangesAsync(cancellationToken);
                }
            }

            var dryRunTag = new KeyValuePair<string, object?>(
                "dry_run",
                _options.DryRun);
            ArcaneLinkDiagnostics.AssetCleanupCandidatesCounter.Add(
                assets.Count,
                dryRunTag);
            ArcaneLinkDiagnostics.AssetCleanupDeletedCounter.Add(
                deletedCount,
                dryRunTag);
            ArcaneLinkDiagnostics.AssetCleanupFailedCounter.Add(
                failedCount,
                dryRunTag);

            _logger.LogInformation(
                ObservabilityEventIds.AssetCleanupCompleted,
                "Asset cleanup pass completed. DryRun={DryRun} CutoffUtc={CutoffUtc} BatchSize={BatchSize} Candidates={Candidates} Deleted={Deleted} Failed={Failed}",
                _options.DryRun,
                cutoff,
                batchSize,
                assets.Count,
                deletedCount,
                failedCount);

            return new AssetCleanupRunResult(
                assets.Count,
                deletedCount,
                failedCount,
                _options.DryRun,
                cutoff);
        }
    }
}
