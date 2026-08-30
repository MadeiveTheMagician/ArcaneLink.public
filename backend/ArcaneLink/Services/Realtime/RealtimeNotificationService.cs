using ArcaneLink.Hubs;
using ArcaneLink.Services.Realtime.Abstractions;
using Microsoft.AspNetCore.SignalR;

namespace ArcaneLink.Services.Realtime;

public class RealtimeNotificationService : IRealtimeNotificationService
{
    private readonly IHubContext<RealtimeHub> _hubContext;

    public RealtimeNotificationService(IHubContext<RealtimeHub> hubContext)
    {
        this._hubContext = hubContext;
    }

    public async Task NotifyConnectionAsync(
        string connectionId,
        string eventName,
        object? payload = null,
        CancellationToken cancellationToken = default)
    {
        await this._hubContext.Clients
            .Client(connectionId)
            .SendAsync(eventName, payload, cancellationToken);
    }

    public async Task NotifyUserAsync(
        Guid userId,
        string eventName,
        object? payload = null,
        CancellationToken cancellationToken = default)
    {
        await this._hubContext.Clients
            .Group(RealtimeGroups.User(userId))
            .SendAsync(eventName, payload, cancellationToken);
    }

    public async Task NotifyUsersAsync(
        IEnumerable<Guid> userIds,
        string eventName,
        object? payload = null,
        CancellationToken cancellationToken = default)
    {
        var userGroups = userIds
            .Distinct()
            .Select(RealtimeGroups.User)
            .ToList();
        if (userGroups.Count == 0)
        {
            return;
        }

        await this._hubContext.Clients
            .Groups(userGroups)
            .SendAsync(eventName, payload, cancellationToken);
    }

    public async Task NotifyServerAsync(
        Guid serverId,
        string eventName,
        object? payload = null,
        CancellationToken cancellationToken = default)
    {
        await this._hubContext.Clients
            .Group(RealtimeGroups.Server(serverId))
            .SendAsync(eventName, payload, cancellationToken);
    }
}
