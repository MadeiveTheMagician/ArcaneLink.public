using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions
{
    public interface IServerDiscoveryService
    {
        Task<IReadOnlyList<ServerDiscoveryResponse>> DiscoverServersAsync(
            Guid currentUserId,
            ServerDiscoveryQuery query,
            CancellationToken cancellationToken = default);
    }
}
