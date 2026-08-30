using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.Services.Assets;
using ArcaneLink.Services.Assets.Storage;
using ArcaneLink.Services.Assets.Storage.Abstractions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Tests.Assets;

public sealed class AssetCleanupRunnerTests
{
    private static readonly DateTime NowUtc =
        new(2026, 7, 19, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task RunOnce_UsesInclusiveRetentionCutoff()
    {
        await using var fixture = await CleanupFixture.CreateAsync(
            dryRun: true,
            retentionDays: 7,
            batchSize: 100);
        var cutoff = NowUtc.AddDays(-7);

        await fixture.AddAssetAsync("older", cutoff.AddSeconds(-1));
        await fixture.AddAssetAsync("at-cutoff", cutoff);
        await fixture.AddAssetAsync("too-new", cutoff.AddSeconds(1));
        await fixture.AddAssetAsync("not-deleted", deletedAt: null);
        await fixture.AddAssetAsync(
            "already-physical",
            cutoff.AddDays(-1),
            physicalDeletedAt: cutoff);

        var result = await fixture.Runner.RunOnceAsync();

        Assert.Equal(2, result.Candidates);
        Assert.Equal(cutoff, result.CutoffUtc);
        Assert.Equal(0, result.Deleted);
        Assert.Equal(0, result.Failed);
    }

    [Fact]
    public async Task RunOnce_ProcessesAtMostConfiguredBatchSize()
    {
        await using var fixture = await CleanupFixture.CreateAsync(
            dryRun: false,
            retentionDays: 7,
            batchSize: 2);
        var deletedAt = NowUtc.AddDays(-8);

        await fixture.AddAssetAsync("asset-1", deletedAt);
        await fixture.AddAssetAsync("asset-2", deletedAt);
        await fixture.AddAssetAsync("asset-3", deletedAt);

        var first = await fixture.Runner.RunOnceAsync();
        var second = await fixture.Runner.RunOnceAsync();

        Assert.Equal(2, first.Candidates);
        Assert.Equal(2, first.Deleted);
        Assert.Equal(1, second.Candidates);
        Assert.Equal(1, second.Deleted);
        Assert.Empty(fixture.Storage.Bytes);
    }

    [Fact]
    public async Task RunOnce_DryRunDoesNotTouchBytesOrMetadata()
    {
        await using var fixture = await CleanupFixture.CreateAsync(
            dryRun: true,
            retentionDays: 7,
            batchSize: 100);
        var asset = await fixture.AddAssetAsync(
            "dry-run-asset",
            NowUtc.AddDays(-8));

        var result = await fixture.Runner.RunOnceAsync();
        var persisted = await fixture.Db.Assets
            .AsNoTracking()
            .SingleAsync(x => x.Id == asset.Id);

        Assert.True(result.DryRun);
        Assert.Equal(1, result.Candidates);
        Assert.Equal(0, result.Deleted);
        Assert.Empty(fixture.Storage.DeleteCalls);
        Assert.Contains(asset.StorageKey, fixture.Storage.Bytes);
        Assert.Null(persisted.PhysicalDeletedAt);
    }

    [Fact]
    public async Task RunOnce_LiveModeDeletesBytesAndMarksMetadata()
    {
        await using var fixture = await CleanupFixture.CreateAsync(
            dryRun: false,
            retentionDays: 7,
            batchSize: 100);
        var asset = await fixture.AddAssetAsync(
            "live-asset",
            NowUtc.AddDays(-8));

        var result = await fixture.Runner.RunOnceAsync();
        var persisted = await fixture.Db.Assets
            .AsNoTracking()
            .SingleAsync(x => x.Id == asset.Id);

        Assert.False(result.DryRun);
        Assert.Equal(1, result.Deleted);
        Assert.Equal(0, result.Failed);
        Assert.DoesNotContain(asset.StorageKey, fixture.Storage.Bytes);
        Assert.Equal(NowUtc, persisted.PhysicalDeletedAt);
    }

    [Fact]
    public async Task RunOnce_DeleteFailureLeavesAssetRetryable()
    {
        await using var fixture = await CleanupFixture.CreateAsync(
            dryRun: false,
            retentionDays: 7,
            batchSize: 100);
        var asset = await fixture.AddAssetAsync(
            "retryable-asset",
            NowUtc.AddDays(-8));
        fixture.Storage.FailDeletes.Add(asset.StorageKey);

        var failed = await fixture.Runner.RunOnceAsync();
        var afterFailure = await fixture.Db.Assets
            .AsNoTracking()
            .SingleAsync(x => x.Id == asset.Id);

        Assert.Equal(1, failed.Candidates);
        Assert.Equal(0, failed.Deleted);
        Assert.Equal(1, failed.Failed);
        Assert.Contains(asset.StorageKey, fixture.Storage.Bytes);
        Assert.Null(afterFailure.PhysicalDeletedAt);

        fixture.Storage.FailDeletes.Remove(asset.StorageKey);
        var retried = await fixture.Runner.RunOnceAsync();
        var afterRetry = await fixture.Db.Assets
            .AsNoTracking()
            .SingleAsync(x => x.Id == asset.Id);

        Assert.Equal(1, retried.Candidates);
        Assert.Equal(1, retried.Deleted);
        Assert.Equal(0, retried.Failed);
        Assert.DoesNotContain(asset.StorageKey, fixture.Storage.Bytes);
        Assert.Equal(NowUtc, afterRetry.PhysicalDeletedAt);
    }

    private sealed class CleanupFixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;

        private CleanupFixture(
            SqliteConnection connection,
            AppDbContext db,
            TestAssetStorage storage,
            AssetCleanupRunner runner)
        {
            this._connection = connection;
            this.Db = db;
            this.Storage = storage;
            this.Runner = runner;
        }

        public AppDbContext Db { get; }
        public TestAssetStorage Storage { get; }
        public AssetCleanupRunner Runner { get; }

        public static async Task<CleanupFixture> CreateAsync(
            bool dryRun,
            int retentionDays,
            int batchSize)
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();

            var dbOptions = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(connection)
                .Options;
            var db = new AppDbContext(dbOptions);
            await db.Database.EnsureCreatedAsync();

            var storage = new TestAssetStorage();
            var runner = new AssetCleanupRunner(
                db,
                storage,
                Options.Create(new AssetCleanupOptions
                {
                    Enabled = true,
                    DryRun = dryRun,
                    RetentionDays = retentionDays,
                    BatchSize = batchSize
                }),
                new FixedTimeProvider(NowUtc),
                NullLogger<AssetCleanupRunner>.Instance);

            return new CleanupFixture(connection, db, storage, runner);
        }

        public async Task<Asset> AddAssetAsync(
            string storageKey,
            DateTime? deletedAt,
            DateTime? physicalDeletedAt = null)
        {
            var asset = new Asset
            {
                Id = Guid.NewGuid(),
                AssetTypeId = AssetTypeIds.Other,
                StorageKey = storageKey,
                MimeType = "application/octet-stream",
                SizeBytes = 4,
                Sha256 = new string('A', 64),
                CreatedAt = NowUtc.AddDays(-30),
                DeletedAt = deletedAt,
                PhysicalDeletedAt = physicalDeletedAt
            };

            this.Storage.Bytes.Add(storageKey);
            this.Db.Assets.Add(asset);
            await this.Db.SaveChangesAsync();
            return asset;
        }

        public async ValueTask DisposeAsync()
        {
            await this.Db.DisposeAsync();
            await this._connection.DisposeAsync();
        }
    }

    private sealed class FixedTimeProvider(DateTime utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() =>
            new(utcNow, TimeSpan.Zero);
    }

    private sealed class TestAssetStorage : IAssetStorageService
    {
        public HashSet<string> Bytes { get; } = new(StringComparer.Ordinal);
        public HashSet<string> FailDeletes { get; } = new(StringComparer.Ordinal);
        public List<string> DeleteCalls { get; } = [];

        public Task<AssetStorageSaveResult> SaveAsync(
            Guid assetId,
            Guid ownerUserId,
            string assetTypeCode,
            string fileExtension,
            Stream content,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<AssetStorageReadResult?> OpenReadAsync(
            string storageKey,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task DeleteAsync(
            string storageKey,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            this.DeleteCalls.Add(storageKey);

            if (this.FailDeletes.Contains(storageKey))
            {
                throw new IOException("Simulated storage delete failure.");
            }

            this.Bytes.Remove(storageKey);
            return Task.CompletedTask;
        }
    }
}
