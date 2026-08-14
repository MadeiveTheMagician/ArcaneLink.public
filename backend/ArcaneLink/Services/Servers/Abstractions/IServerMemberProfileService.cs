using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions
{
    public interface IServerMemberProfileService
    {
        Task<ServerMemberProfileResponse?> GetAsync(
            Guid currentUserId,
            Guid serverId,
            Guid targetUserId,
            CancellationToken cancellationToken = default);

        Task<OwnServerMemberProfileResponse?> GetOwnAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default);

        Task<OwnServerMemberProfileResponse?> UpdateOwnAsync(
            Guid currentUserId,
            Guid serverId,
            UpdateServerMemberProfileRequest request,
            CancellationToken cancellationToken = default);

        Task<OwnServerMemberProfileResponse?> SetOwnAvatarAsync(
            Guid currentUserId,
            Guid serverId,
            Guid sourceAssetId,
            SetServerMemberProfileAvatarRequest request,
            CancellationToken cancellationToken = default);

        Task<OwnServerMemberProfileResponse?> ResetOwnAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default);
    }
}
