using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions
{
    public interface IServerOwnershipService
    {
        Task<ServerOwnershipTransferResponse?> TransferOwnershipAsync(Guid currentUserId, Guid serverId, TransferServerOwnershipRequest request, CancellationToken cancellationToken = default);
    }
}
