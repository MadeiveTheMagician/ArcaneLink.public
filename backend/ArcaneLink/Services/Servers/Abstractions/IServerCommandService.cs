using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions;

public interface IServerCommandService
{
    Task<ServerResponse> CreateServerAsync(
        Guid currentUserId,
        CreateServerRequest request,
        CancellationToken cancellationToken = default);

    Task<ServerResponse?> UpdateServerAsync(
        Guid currentUserId,
        Guid serverId,
        UpdateServerRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteServerAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default);
}
