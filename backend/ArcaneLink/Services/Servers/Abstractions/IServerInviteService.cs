using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions
{
    public interface IServerInviteService
    {
        Task<ServerInviteResponse?> CreateInviteAsync(Guid currentUserId, Guid serverId, CreateServerInviteRequest request, CancellationToken cancellationToken = default);
        Task<bool> RevokeInviteAsync(Guid currentUserId, Guid serverId, Guid inviteId, CancellationToken cancellationToken = default);
    }
}
