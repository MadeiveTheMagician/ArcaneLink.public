using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.PrivateSpaces
{
    public sealed record PrivateMessageTrashCleanupResult(
        int MessagesDeleted,
        int AssetsScheduledForCleanup,
        DateTime CutoffUtc);

    public sealed class PrivateMessageTrashCleanupRunner
    {
        private static readonly TimeSpan RestoreWindow = TimeSpan.FromHours(24);
        private const int BatchSize = 250;

        private readonly AppDbContext _db;
        private readonly TimeProvider _timeProvider;
        private readonly ILogger<PrivateMessageTrashCleanupRunner> _logger;

        public PrivateMessageTrashCleanupRunner(
            AppDbContext db,
            TimeProvider timeProvider,
            ILogger<PrivateMessageTrashCleanupRunner> logger)
        {
            _db = db;
            _timeProvider = timeProvider;
            _logger = logger;
        }

        public async Task<PrivateMessageTrashCleanupResult> RunOnceAsync(
            CancellationToken cancellationToken = default,
            Guid? spaceId = null,
            Guid? deletedByUserId = null)
        {
            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var cutoff = now.Subtract(RestoreWindow);
            var deletedCount = 0;
            var assetsScheduledCount = 0;

            while (true)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var messages = await _db.SpaceMessages
                    .Include(message => message.Assets)
                    .Where(message =>
                        message.Space.ServerId == null &&
                        message.Space.PrivateSpace != null &&
                        message.DeletedAt != null &&
                        message.DeletedAt <= cutoff &&
                        (!spaceId.HasValue || message.SpaceId == spaceId.Value) &&
                        (!deletedByUserId.HasValue ||
                         message.DeletedByUserId == deletedByUserId.Value) &&
                        !_db.ModerationCases.Any(moderationCase =>
                            moderationCase.MessageId == message.Id))
                    .OrderBy(message => message.DeletedAt)
                    .ThenBy(message => message.Id)
                    .Take(BatchSize)
                    .ToListAsync(cancellationToken);

                if (messages.Count == 0)
                {
                    break;
                }

                var messageIds = messages.Select(message => message.Id).ToList();
                await _db.SpaceMessages
                    .Where(message =>
                        message.ReplyToMessageId.HasValue &&
                        messageIds.Contains(message.ReplyToMessageId.Value))
                    .ExecuteUpdateAsync(
                        update => update.SetProperty(
                            message => message.ReplyToMessageId,
                            (Guid?)null),
                        cancellationToken);

                var candidateAssetIds = messages
                    .SelectMany(message => message.Assets)
                    .Select(link => link.AssetId)
                    .Distinct()
                    .ToList();
                var orphanedAttachments = candidateAssetIds.Count == 0
                    ? []
                    : await _db.Assets
                        .Where(asset =>
                            candidateAssetIds.Contains(asset.Id) &&
                            asset.AssetTypeId == AssetTypeIds.MessageAttachment &&
                            asset.DeletedAt == null &&
                            !_db.SpaceMessageAssets.Any(link =>
                                link.AssetId == asset.Id &&
                                !messageIds.Contains(link.MessageId)) &&
                            !_db.ModerationEvidenceAssets.Any(evidence =>
                                evidence.AssetId == asset.Id))
                        .ToListAsync(cancellationToken);

                foreach (var asset in orphanedAttachments)
                {
                    asset.DeletedAt = now;
                }

                _db.SpaceMessages.RemoveRange(messages);
                await _db.SaveChangesAsync(cancellationToken);
                deletedCount += messages.Count;
                assetsScheduledCount += orphanedAttachments.Count;

                if (messages.Count < BatchSize)
                {
                    break;
                }

                _db.ChangeTracker.Clear();
            }

            _logger.LogInformation(
                "Expired private-message trash cleanup completed. CutoffUtc={CutoffUtc} SpaceId={SpaceId} DeletedByUserId={DeletedByUserId} MessagesDeleted={MessagesDeleted} AssetsScheduledForCleanup={AssetsScheduledForCleanup}",
                cutoff,
                spaceId,
                deletedByUserId,
                deletedCount,
                assetsScheduledCount);

            return new PrivateMessageTrashCleanupResult(
                deletedCount,
                assetsScheduledCount,
                cutoff);
        }
    }
}
