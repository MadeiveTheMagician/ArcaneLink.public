using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions;

public interface IServerInviteAcceptanceService
{
    Task<ServerMemberResponse?> AcceptInviteAsync(Guid currentUserId, AcceptServerInviteRequest request, CancellationToken cancellationToken = default);
    Task<ServerMemberResponse?> AcceptInviteAsync(Guid currentUserId, Guid inviteId, CancellationToken cancellationToken = default);
    Task<bool> DeclineInviteAsync(Guid currentUserId, Guid inviteId, CancellationToken cancellationToken = default);
}
