using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions;

public interface IServerQueryService
{
    Task<IReadOnlyList<ServerMemberResponse>> GetMyServersAsync(
        Guid currentUserId,
        CancellationToken cancellationToken = default);

    Task<ServerResponse?> GetServerAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default);

    Task<ServerResponse?> GetServerBySlugAsync(
        Guid currentUserId,
        string slug,
        CancellationToken cancellationToken = default);
}
