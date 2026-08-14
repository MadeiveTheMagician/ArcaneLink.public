using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.Services.Notifications.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.PrivateSpaces
{
    public sealed class PrivateSpaceHistoryService
    {
        private readonly AppDbContext _db;
        private readonly PrivateSpaceRealtimeNotifier _notifier;
        private readonly IUserNotificationService _notifications;
        private readonly TimeProvider _timeProvider;

        public PrivateSpaceHistoryService(
            AppDbContext db,
            PrivateSpaceRealtimeNotifier notifier,
            IUserNotificationService notifications,
            TimeProvider timeProvider)
        {
            _db = db;
            _notifier = notifier;
            _notifications = notifications;
            _timeProvider = timeProvider;
        }

        public async Task<bool> ClearAsync(
            Guid currentUserId,
            Guid spaceId,
            bool hideDirectFromList,
            CancellationToken cancellationToken = default)
        {
            var membership = await _db.PrivateSpaceMembers
                .Include(member => member.PrivateSpace)
                    .ThenInclude(space => space.Space)
                .FirstOrDefaultAsync(
                    member =>
                        member.SpaceId == spaceId &&
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive &&
                        member.PrivateSpace.DeletedAt == null &&
                        member.PrivateSpace.Space.DeletedAt == null,
                    cancellationToken);
            if (membership == null ||
                hideDirectFromList &&
                membership.PrivateSpace.Kind != PrivateSpaceKindCodes.Direct)
            {
                return false;
            }

            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var latestVisibleMessage = await _db.SpaceMessages
                .AsNoTracking()
                .Where(message =>
                    message.SpaceId == spaceId &&
                    message.DeletedAt == null &&
                    !message.UserDeletions.Any(deletion =>
                        deletion.UserId == currentUserId) &&
                    (!membership.HistoryClearedAt.HasValue ||
                     message.CreatedAt >
                     membership.HistoryClearedAt.Value))
                .OrderByDescending(message => message.CreatedAt)
                .ThenByDescending(message => message.Id)
                .Select(message => new
                {
                    message.Id,
                    message.CreatedAt
                })
                .FirstOrDefaultAsync(cancellationToken);

            membership.HistoryClearedAt =
                !membership.HistoryClearedAt.HasValue ||
                membership.HistoryClearedAt < now
                    ? now
                    : membership.HistoryClearedAt;
            if (hideDirectFromList)
            {
                membership.HiddenFromListAt = now;
            }
            membership.UpdatedAt = now;

            if (latestVisibleMessage != null)
            {
                var readState = await _db.SpaceReadStates
                    .FirstOrDefaultAsync(
                        state =>
                            state.UserId == currentUserId &&
                            state.SpaceId == spaceId,
                        cancellationToken);
                if (readState == null)
                {
                    _db.SpaceReadStates.Add(new SpaceReadState
                    {
                        UserId = currentUserId,
                        SpaceId = spaceId,
                        LastReadMessageId = latestVisibleMessage.Id,
                        LastReadMessageCreatedAt =
                            latestVisibleMessage.CreatedAt,
                        ReadAt = now,
                        UpdatedAt = now
                    });
                }
                else if (IsAfter(
                             latestVisibleMessage.CreatedAt,
                             latestVisibleMessage.Id,
                             readState))
                {
                    readState.LastReadMessageId = latestVisibleMessage.Id;
                    readState.LastReadMessageCreatedAt =
                        latestVisibleMessage.CreatedAt;
                    readState.ReadAt = now;
                    readState.UpdatedAt = now;
                }
            }

            var mentionNotifications = await _db.UserNotifications
                .Where(notification =>
                    notification.UserId == currentUserId &&
                    notification.SpaceId == spaceId &&
                    notification.MessageId.HasValue &&
                    notification.Message != null &&
                    notification.Message.CreatedAt <= now &&
                    notification.ReadAt == null)
                .ToListAsync(cancellationToken);
            foreach (var notification in mentionNotifications)
            {
                notification.ReadAt = now;
            }

            await _db.SaveChangesAsync(cancellationToken);
            await _notifier.NotifySpacesChangedForUserAsync(
                currentUserId,
                spaceId,
                CancellationToken.None);
            await _notifier.NotifyMessagesChangedAsync(
                spaceId,
                messageId: null,
                CancellationToken.None);
            if (mentionNotifications.Count > 0)
            {
                await _notifications.NotifyChangedAsync(
                    [currentUserId],
                    CancellationToken.None);
            }

            return true;
        }

        private static bool IsAfter(
            DateTime createdAt,
            Guid messageId,
            SpaceReadState state)
        {
            if (!state.LastReadMessageCreatedAt.HasValue)
            {
                return true;
            }

            var comparison = createdAt.CompareTo(
                state.LastReadMessageCreatedAt.Value);
            return comparison > 0 ||
                   comparison == 0 &&
                   (!state.LastReadMessageId.HasValue ||
                    messageId.CompareTo(state.LastReadMessageId.Value) > 0);
        }
    }
}
