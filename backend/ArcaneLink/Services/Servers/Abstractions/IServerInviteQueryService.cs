using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions
{
    public interface IServerInviteQueryService
    {
        Task<IReadOnlyList<ServerInviteResponse>?> GetInvitesAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default);

        Task<ServerInvitePreviewResponse?> GetInvitePreviewAsync(
            string code,
            Guid? viewerUserId,
            CancellationToken cancellationToken = default);

        Task<IReadOnlyList<ServerInviteResponse>> GetMyDirectInvitesAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default);

        Task<IReadOnlyList<ServerMemberResponse>> GetMyInviteTargetServersAsync(
            Guid currentUserId,
            Guid? targetUserId = null,
            CancellationToken cancellationToken = default);
    }
}
