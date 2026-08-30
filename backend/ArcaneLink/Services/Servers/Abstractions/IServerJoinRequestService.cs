using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions;

public interface IServerJoinRequestService
{
    Task<ServerJoinResponse?> JoinAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default);

    Task<ServerJoinRequestPageResponse?> GetPendingAsync(
        Guid currentUserId,
        Guid serverId,
        DateTime? afterCreatedAt,
        Guid? afterId,
        int limit,
        CancellationToken cancellationToken = default);

    Task<ServerMemberResponse?> ApproveAsync(
        Guid currentUserId,
        Guid serverId,
        Guid requestId,
        CancellationToken cancellationToken = default);

    Task<bool> DeclineAsync(
        Guid currentUserId,
        Guid serverId,
        Guid requestId,
        CancellationToken cancellationToken = default);

    Task<bool> CancelAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default);
}
