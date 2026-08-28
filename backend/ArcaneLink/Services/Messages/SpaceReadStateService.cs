using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.Services.Notifications;
using ArcaneLink.Services.PrivateSpaces;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Spaces;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Messages
{
    public sealed class SpaceReadStateService
    {
        private const int MaxConcurrencyAttempts = 8;

        private readonly AppDbContext _db;
        private readonly SpaceMessageAccessService _serverAccess;
        private readonly PrivateSpaceAccessService _privateAccess;
        private readonly UnreadCountService _unreadCounts;
        private readonly IRealtimeNotificationService _realtime;
        private readonly TimeProvider _timeProvider;
        private readonly ILogger<SpaceReadStateService> _logger;

        public SpaceReadStateService(
            AppDbContext db,
            SpaceMessageAccessService serverAccess,
            PrivateSpaceAccessService privateAccess,
            UnreadCountService unreadCounts,
            IRealtimeNotificationService realtime,
            TimeProvider timeProvider,
            ILogger<SpaceReadStateService> logger)
        {
            this._db = db;
            this._serverAccess = serverAccess;
            this._privateAccess = privateAccess;
            this._unreadCounts = unreadCounts;
            this._realtime = realtime;
            this._timeProvider = timeProvider;
            this._logger = logger;
        }

        public async Task<SpaceReadStateResponse?> MarkServerSpaceReadAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid throughMessageId,
            CancellationToken cancellationToken = default)
        {
            if (throughMessageId == Guid.Empty ||
                await this._serverAccess.GetReadableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                return null;
            }

            return await this.MarkThroughMessageAsync(
                currentUserId,
                serverId,
                spaceId,
                throughMessageId,
                cancellationToken);
        }

        public async Task<MarkAllPrivateSpacesReadResponse>
            MarkAllPrivateSpacesReadAsync(
                Guid currentUserId,
                CancellationToken cancellationToken = default)
        {
            IReadOnlyList<Guid> changedSpaceIds = [];
            var notificationsChanged = false;
            for (var attempt = 0; attempt < MaxConcurrencyAttempts; attempt++)
            {
                var spaceIds = await this._db.PrivateSpaceMembers
                    .AsNoTracking()
                    .Where(member =>
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive &&
                        member.PrivateSpace.DeletedAt == null &&
                        member.PrivateSpace.Space.DeletedAt == null)
                    .Select(member => member.SpaceId)
                    .ToArrayAsync(cancellationToken);
                if (spaceIds.Length == 0)
                {
                    return new MarkAllPrivateSpacesReadResponse();
                }

                var latestMessageIds = await this._db.SpaceMessages
                    .AsNoTracking()
                    .Where(message =>
                        spaceIds.Contains(message.SpaceId) &&
                        message.DeletedAt == null &&
                        !message.UserDeletions.Any(deletion =>
                            deletion.UserId == currentUserId))
                    .ApplyHistoryCutoff(this._db, currentUserId)
                    .GroupBy(message => message.SpaceId)
                    .Select(group => group
                        .OrderByDescending(message => message.CreatedAt)
                        .ThenByDescending(message => message.Id)
                        .Select(message => message.Id)
                        .First())
                    .ToArrayAsync(cancellationToken);
                var latestMessages = await this._db.SpaceMessages
                    .AsNoTracking()
                    .Where(message => latestMessageIds.Contains(message.Id))
                    .Select(message => new
                    {
                        message.SpaceId,
                        Cursor = new MessageCursor(
                            message.Id,
                            message.CreatedAt)
                    })
                    .ToArrayAsync(cancellationToken);
                var existingStates = await this._db.SpaceReadStates
                    .Where(state =>
                        state.UserId == currentUserId &&
                        spaceIds.Contains(state.SpaceId))
                    .ToDictionaryAsync(
                        state => state.SpaceId,
                        cancellationToken);
                var now = this._timeProvider.GetUtcNow().UtcDateTime;
                var changed = new List<Guid>();
                foreach (var latest in latestMessages)
                {
                    if (existingStates.TryGetValue(
                            latest.SpaceId,
                            out var state))
                    {
                        if (!IsAfter(latest.Cursor, state))
                        {
                            continue;
                        }

                        state.LastReadMessageId = latest.Cursor.MessageId;
                        state.LastReadMessageCreatedAt =
                            latest.Cursor.CreatedAt;
                        state.ReadAt = now;
                        state.UpdatedAt = now;
                    }
                    else
                    {
                        this._db.SpaceReadStates.Add(new SpaceReadState
                        {
                            UserId = currentUserId,
                            SpaceId = latest.SpaceId,
                            LastReadMessageId = latest.Cursor.MessageId,
                            LastReadMessageCreatedAt =
                                latest.Cursor.CreatedAt,
                            ReadAt = now,
                            UpdatedAt = now
                        });
                    }
                    changed.Add(latest.SpaceId);
                }

                var mentionNotifications = await this._db.UserNotifications
                    .Where(notification =>
                        notification.UserId == currentUserId &&
                        notification.ServerId == null &&
                        notification.SpaceId.HasValue &&
                        spaceIds.Contains(notification.SpaceId.Value) &&
                        notification.Kind ==
                        UserNotificationText.MentionKind &&
                        notification.ReadAt == null)
                    .ToListAsync(cancellationToken);
                foreach (var notification in mentionNotifications)
                {
                    notification.ReadAt = now;
                }

                try
                {
                    await this._db.SaveChangesAsync(cancellationToken);
                    changedSpaceIds = changed;
                    notificationsChanged = mentionNotifications.Count > 0;
                    break;
                }
                catch (DbUpdateConcurrencyException exception)
                {
                    this.DetachEntries(exception.Entries);
                    if (attempt == MaxConcurrencyAttempts - 1)
                    {
                        throw;
                    }
                }
                catch (DbUpdateException exception)
                {
                    this.DetachEntries(exception.Entries);
                    if (attempt == MaxConcurrencyAttempts - 1)
                    {
                        throw;
                    }
                }
            }

            if (notificationsChanged)
            {
                await this._realtime.NotifyUserBestEffortAsync(
                    this._logger,
                    currentUserId,
                    RealtimeEventNames.UserNotificationsChanged,
                    new { userId = currentUserId },
                    CancellationToken.None);
            }

            if (changedSpaceIds.Count > 0)
            {
                await this._realtime.NotifyUserBestEffortAsync(
                    this._logger,
                    currentUserId,
                    RealtimeEventNames.SpaceReadStateChanged,
                    new
                    {
                        allPrivate = true,
                        unreadCount = 0
                    },
                    CancellationToken.None);
                foreach (var spaceId in changedSpaceIds)
                {
                    await this.NotifyPrivateReceiptChangedAsync(
                        spaceId,
                        CancellationToken.None);
                }
            }

            return new MarkAllPrivateSpacesReadResponse
            {
                UpdatedSpaceCount = changedSpaceIds.Count
            };
        }

        public async Task<SpaceReadStateResponse?> MarkPrivateSpaceReadAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid throughMessageId,
            CancellationToken cancellationToken = default)
        {
            if (throughMessageId == Guid.Empty ||
                !await this._privateAccess.IsActiveMemberAsync(
                    currentUserId,
                    spaceId,
                    cancellationToken))
            {
                return null;
            }

            return await this.MarkThroughMessageAsync(
                currentUserId,
                serverId: null,
                spaceId,
                throughMessageId,
                cancellationToken);
        }

        private async Task<SpaceReadStateResponse?> MarkThroughMessageAsync(
            Guid currentUserId,
            Guid? serverId,
            Guid spaceId,
            Guid throughMessageId,
            CancellationToken cancellationToken)
        {
            var messageQuery = this._db.SpaceMessages
                .AsNoTracking()
                .Where(x =>
                    x.Id == throughMessageId &&
                    x.SpaceId == spaceId &&
                    x.DeletedAt == null &&
                    !x.UserDeletions.Any(deletion =>
                        deletion.UserId == currentUserId));
            if (!serverId.HasValue)
            {
                messageQuery = messageQuery.ApplyHistoryCutoff(
                    this._db,
                    currentUserId);
            }

            var message = await messageQuery
                .Select(x => new MessageCursor(x.Id, x.CreatedAt))
                .SingleOrDefaultAsync(cancellationToken);
            if (message == null)
            {
                return null;
            }

            var response = await this.AdvanceAsync(
                currentUserId,
                spaceId,
                message,
                cancellationToken);
            response.ServerId = serverId;
            response.UnreadCount = await this.GetUnreadCountAsync(
                currentUserId,
                serverId,
                spaceId,
                cancellationToken);
            if (response.Advanced)
            {
                await this._realtime.NotifyUserBestEffortAsync(
                    this._logger,
                    currentUserId,
                    RealtimeEventNames.SpaceReadStateChanged,
                    response,
                    CancellationToken.None);
                if (!serverId.HasValue)
                {
                    await this.NotifyPrivateReceiptChangedAsync(
                        spaceId,
                        CancellationToken.None);
                }
            }

            return response;
        }

        private async Task<long> GetUnreadCountAsync(
            Guid currentUserId,
            Guid? serverId,
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            var counts = serverId.HasValue
                ? await this._unreadCounts.GetServerSpaceUnreadCountsAsync(
                    currentUserId,
                    serverId.Value,
                    [spaceId],
                    cancellationToken)
                : await this._unreadCounts.GetPrivateSpaceUnreadCountsAsync(
                    currentUserId,
                    [spaceId],
                    cancellationToken);
            return counts.GetValueOrDefault(spaceId);
        }

        private async Task<SpaceReadStateResponse> AdvanceAsync(
            Guid currentUserId,
            Guid spaceId,
            MessageCursor target,
            CancellationToken cancellationToken)
        {
            for (var attempt = 0; attempt < MaxConcurrencyAttempts; attempt++)
            {
                var state = await this._db.SpaceReadStates
                    .SingleOrDefaultAsync(
                        x => x.UserId == currentUserId && x.SpaceId == spaceId,
                        cancellationToken);

                if (state != null && !IsAfter(target, state))
                {
                    return ToResponse(state, advanced: false);
                }

                var now = this._timeProvider.GetUtcNow().UtcDateTime;
                if (state == null)
                {
                    state = new SpaceReadState
                    {
                        UserId = currentUserId,
                        SpaceId = spaceId,
                        LastReadMessageId = target.MessageId,
                        LastReadMessageCreatedAt = target.CreatedAt,
                        ReadAt = now,
                        UpdatedAt = now
                    };
                    this._db.SpaceReadStates.Add(state);
                }
                else
                {
                    state.LastReadMessageId = target.MessageId;
                    state.LastReadMessageCreatedAt = target.CreatedAt;
                    state.ReadAt = now;
                    state.UpdatedAt = now;
                }

                try
                {
                    await this._db.SaveChangesAsync(cancellationToken);
                    return ToResponse(state, advanced: true);
                }
                catch (DbUpdateConcurrencyException exception)
                {
                    this.DetachEntries(exception.Entries);
                }
                catch (DbUpdateException exception)
                {
                    // A concurrent request may have inserted the composite-key row.
                    // Detach and retry against the winner; persistent failures surface below.
                    this.DetachEntries(exception.Entries);
                    if (attempt == MaxConcurrencyAttempts - 1)
                    {
                        throw;
                    }
                }
            }

            throw new DbUpdateConcurrencyException(
                "Could not advance the space read marker after repeated concurrent updates.");
        }

        private static bool IsAfter(MessageCursor target, SpaceReadState current)
        {
            if (!current.LastReadMessageCreatedAt.HasValue)
            {
                return true;
            }

            var timeComparison = target.CreatedAt.CompareTo(
                current.LastReadMessageCreatedAt.Value);
            if (timeComparison != 0)
            {
                return timeComparison > 0;
            }

            return !current.LastReadMessageId.HasValue ||
                   target.MessageId.CompareTo(current.LastReadMessageId.Value) > 0;
        }

        private void DetachEntries(IEnumerable<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry> entries)
        {
            foreach (var entry in entries)
            {
                entry.State = EntityState.Detached;
            }

            foreach (var entry in this._db.ChangeTracker.Entries<SpaceReadState>().ToList())
            {
                entry.State = EntityState.Detached;
            }
        }

        private async Task NotifyPrivateReceiptChangedAsync(
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            var userIds = await this._db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(member =>
                    member.SpaceId == spaceId &&
                    member.StatusId ==
                    PrivateSpaceIds.MemberStatusActive)
                .Select(member => member.UserId)
                .ToArrayAsync(cancellationToken);
            await this._realtime.NotifyUsersBestEffortAsync(
                this._logger,
                userIds,
                RealtimeEventNames.PrivateSpaceMessagesChanged,
                new { spaceId, messageId = (Guid?)null },
                CancellationToken.None);
        }

        private static SpaceReadStateResponse ToResponse(
            SpaceReadState state,
            bool advanced)
        {
            return new SpaceReadStateResponse
            {
                UserId = state.UserId,
                SpaceId = state.SpaceId,
                LastReadMessageId = state.LastReadMessageId,
                LastReadMessageCreatedAt = state.LastReadMessageCreatedAt,
                ReadAt = state.ReadAt,
                UpdatedAt = state.UpdatedAt,
                Advanced = advanced
            };
        }

        private sealed record MessageCursor(Guid MessageId, DateTime CreatedAt);
    }
}
