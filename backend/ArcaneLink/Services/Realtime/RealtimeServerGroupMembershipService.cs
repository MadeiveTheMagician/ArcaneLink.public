using ArcaneLink.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace ArcaneLink.Services.Realtime
{
    public sealed class RealtimeServerGroupMembershipService
    {
        private readonly IHubContext<RealtimeHub> _hubContext;
        private readonly RealtimeConnectionRegistry _connections;
        private readonly ILogger<RealtimeServerGroupMembershipService> _logger;

        public RealtimeServerGroupMembershipService(
            IHubContext<RealtimeHub> hubContext,
            RealtimeConnectionRegistry connections,
            ILogger<RealtimeServerGroupMembershipService> logger)
        {
            _hubContext = hubContext;
            _connections = connections;
            _logger = logger;
        }

        public async Task RemoveUserBestEffortAsync(
            Guid userId,
            Guid serverId)
        {
            await UpdateUserBestEffortAsync(
                userId,
                serverId,
                add: false);
        }

        public async Task AddUserBestEffortAsync(
            Guid userId,
            Guid serverId)
        {
            await UpdateUserBestEffortAsync(
                userId,
                serverId,
                add: true);
        }

        private async Task UpdateUserBestEffortAsync(
            Guid userId,
            Guid serverId,
            bool add)
        {
            var connectionIds = _connections.GetConnectionIds(userId);
            foreach (var connectionId in connectionIds)
            {
                try
                {
                    if (add)
                    {
                        await _hubContext.Groups.AddToGroupAsync(
                            connectionId,
                            RealtimeGroups.Server(serverId),
                            CancellationToken.None);
                    }
                    else
                    {
                        await _hubContext.Groups.RemoveFromGroupAsync(
                            connectionId,
                            RealtimeGroups.Server(serverId),
                            CancellationToken.None);
                    }
                }
                catch (Exception exception)
                {
                    _logger.LogWarning(
                        exception,
                        "Failed to update a realtime connection's server group after membership changed. UserId={UserId} ServerId={ServerId} ConnectionId={ConnectionId} Add={Add}",
                        userId,
                        serverId,
                        connectionId,
                        add);
                }
            }
        }
    }
}
