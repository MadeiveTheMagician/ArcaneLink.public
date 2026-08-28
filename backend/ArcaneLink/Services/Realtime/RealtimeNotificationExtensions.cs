using ArcaneLink.Services.Realtime.Abstractions;

namespace ArcaneLink.Services.Realtime
{
    internal static class RealtimeNotificationExtensions
    {
        public static async Task NotifyConnectionBestEffortAsync(
            this IRealtimeNotificationService realtime,
            ILogger logger,
            string connectionId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            try
            {
                await realtime.NotifyConnectionAsync(
                    connectionId,
                    eventName,
                    payload,
                    cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Realtime connection notification failed after the database operation completed. ConnectionId={ConnectionId} EventName={EventName}",
                    connectionId,
                    eventName);
            }
        }

        public static async Task NotifyUserBestEffortAsync(
            this IRealtimeNotificationService realtime,
            ILogger logger,
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            try
            {
                await realtime.NotifyUserAsync(
                    userId,
                    eventName,
                    payload,
                    cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Realtime user notification failed after the database operation completed. UserId={UserId} EventName={EventName}",
                    userId,
                    eventName);
            }
        }

        public static async Task NotifyServerBestEffortAsync(
            this IRealtimeNotificationService realtime,
            ILogger logger,
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            try
            {
                await realtime.NotifyServerAsync(
                    serverId,
                    eventName,
                    payload,
                    cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Realtime server notification failed after the database operation completed. ServerId={ServerId} EventName={EventName}",
                    serverId,
                    eventName);
            }
        }

        public static async Task NotifyUsersBestEffortAsync(
            this IRealtimeNotificationService realtime,
            ILogger logger,
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            try
            {
                await realtime.NotifyUsersAsync(
                    userIds,
                    eventName,
                    payload,
                    cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Realtime batch notification failed after the database operation completed. EventName={EventName}",
                    eventName);
            }
        }

    }
}
