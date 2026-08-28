using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.PrivateSpaces
{
    public sealed class PrivateSpaceRealtimeNotifier
    {
        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;
        private readonly SpaceMessageNotifier _messageNotifier;
        private readonly ILogger<PrivateSpaceRealtimeNotifier> _logger;
        private readonly TimeProvider _timeProvider;

        public PrivateSpaceRealtimeNotifier(
            AppDbContext db,
            IRealtimeNotificationService realtime,
            SpaceMessageNotifier messageNotifier,
            ILogger<PrivateSpaceRealtimeNotifier> logger,
            TimeProvider? timeProvider = null)
        {
            this._db = db;
            this._realtime = realtime;
            this._messageNotifier = messageNotifier;
            this._logger = logger;
            this._timeProvider = timeProvider ?? TimeProvider.System;
        }

        internal async Task NotifySpacesChangedAsync(
            Guid spaceId,
            CancellationToken cancellationToken,
            Guid? additionalUserId = null)
        {
            try
            {
                var userIds = (await this.GetActiveMemberUserIdsAsync(spaceId, cancellationToken))
                    .ToHashSet();
                if (additionalUserId.HasValue)
                {
                    userIds.Add(additionalUserId.Value);
                }

                await this._realtime.NotifyUsersBestEffortAsync(
                    this._logger,
                    userIds,
                    RealtimeEventNames.PrivateSpacesChanged,
                    new { spaceId },
                    CancellationToken.None);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                this._logger.LogDebug(
                    "Private-space notification resolution was canceled after the database operation completed. SpaceId={SpaceId}",
                    spaceId);
            }
            catch (Exception exception)
            {
                this._logger.LogWarning(
                    exception,
                    "Private-space notification failed after the database operation completed. SpaceId={SpaceId}",
                    spaceId);
            }
        }

        internal async Task NotifyMessagesChangedAsync(
            Guid spaceId,
            Guid? messageId,
            CancellationToken cancellationToken)
        {
            var userIds = await this.GetActiveMemberUserIdsAsync(spaceId, cancellationToken);
            await this._messageNotifier.NotifyPrivateMessagesChangedAsync(
                userIds,
                spaceId,
                messageId,
                cancellationToken);
        }

        internal async Task NotifyMessageReceivedAsync(
            Guid spaceId,
            Guid messageId,
            Guid senderUserId,
            CancellationToken cancellationToken)
        {
            var now = this._timeProvider.GetUtcNow().UtcDateTime;
            var userIds = await this._db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(member =>
                    member.SpaceId == spaceId &&
                    member.UserId != senderUserId &&
                    member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    !member.IsMutedIndefinitely &&
                    (!member.MutedUntil.HasValue ||
                     member.MutedUntil <= now))
                .Select(member => member.UserId)
                .ToArrayAsync(cancellationToken);
            await this._realtime.NotifyUsersBestEffortAsync(
                this._logger,
                userIds,
                RealtimeEventNames.PrivateMessageReceived,
                new { spaceId, messageId, senderUserId },
                cancellationToken);
        }

        internal Task NotifyMessagesChangedForUserAsync(
            Guid userId,
            Guid spaceId,
            Guid? messageId,
            CancellationToken cancellationToken)
        {
            return this._messageNotifier.NotifyPrivateMessagesChangedAsync(
                [userId],
                spaceId,
                messageId,
                cancellationToken);
        }

        internal Task NotifySpacesChangedForUserAsync(
            Guid userId,
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            return this._realtime.NotifyUserBestEffortAsync(
                this._logger,
                userId,
                RealtimeEventNames.PrivateSpacesChanged,
                new { spaceId },
                cancellationToken);
        }

        private async Task<IReadOnlyList<Guid>> GetActiveMemberUserIdsAsync(
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            return await this._db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(x =>
                    x.SpaceId == spaceId &&
                    x.StatusId == PrivateSpaceIds.MemberStatusActive)
                .Select(x => x.UserId)
                .ToListAsync(cancellationToken);
        }
    }
}
