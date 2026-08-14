using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Spaces;

namespace ArcaneLink.Services.Messages
{
    public class SpaceMessageNotifier
    {
        private readonly IRealtimeNotificationService _realtime;
        private readonly ServerSpaceRealtimeAudienceService _audience;
        private readonly SpaceMessageAccessService _access;
        private readonly ILogger<SpaceMessageNotifier> _logger;

        public SpaceMessageNotifier(
            IRealtimeNotificationService realtime,
            ServerSpaceRealtimeAudienceService audience,
            SpaceMessageAccessService access,
            ILogger<SpaceMessageNotifier> logger)
        {
            _realtime = realtime;
            _audience = audience;
            _access = access;
            _logger = logger;
        }

        public async Task NotifyMessagesChangedAsync(
            Guid serverId,
            Guid spaceId,
            Guid? messageId,
            CancellationToken cancellationToken)
        {
            try
            {
                var legacyRecipients = await _audience.GetAuthorizedUserIdsAsync(
                    serverId,
                    spaceId,
                    SpaceAction.View,
                    cancellationToken);
                var recipients = await _access.FilterReadableMessageUserIdsAsync(
                    serverId,
                    spaceId,
                    legacyRecipients,
                    cancellationToken);
                if (recipients.Count == 0)
                {
                    return;
                }

                await _realtime.NotifyUsersAsync(
                    recipients,
                    RealtimeEventNames.SpaceMessagesChanged,
                    new { serverId, spaceId, messageId },
                    cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Realtime server-space message notification failed after the database operation completed. ServerId={ServerId} SpaceId={SpaceId} EventName={EventName}",
                    serverId,
                    spaceId,
                    RealtimeEventNames.SpaceMessagesChanged);
            }
        }

        public async Task NotifyPrivateMessagesChangedAsync(
            IReadOnlyCollection<Guid> userIds,
            Guid spaceId,
            Guid? messageId,
            CancellationToken cancellationToken)
        {
            foreach (var userId in userIds.Distinct())
            {
                await _realtime.NotifyUserBestEffortAsync(
                    _logger,
                    userId,
                    RealtimeEventNames.PrivateSpaceMessagesChanged,
                    new { spaceId, messageId },
                    cancellationToken);
            }
        }
    }
}
