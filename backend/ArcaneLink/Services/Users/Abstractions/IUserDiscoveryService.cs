using ArcaneLink.DataBase.DTOs.Users;

namespace ArcaneLink.Services.Users.Abstractions;

public interface IUserDiscoveryService
{
    Task<IReadOnlyList<FriendUserResponse>> SearchUsersAsync(
        Guid currentUserId,
        string query,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FriendUserResponse>> DiscoverUsersAsync(
        Guid currentUserId,
        UserDiscoveryQuery query,
        CancellationToken cancellationToken = default);
}
