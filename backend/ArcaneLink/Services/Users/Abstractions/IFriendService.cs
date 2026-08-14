using ArcaneLink.DataBase.DTOs.Users;

namespace ArcaneLink.Services.Users.Abstractions
{
    public interface IFriendService
    {
        Task<IReadOnlyList<UserFriendResponse>> GetFriendsAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default);

        Task<IReadOnlyList<FriendRequestResponse>> GetIncomingRequestsAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default);

        Task<IReadOnlyList<FriendRequestResponse>> GetOutgoingRequestsAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default);

        Task<FriendRequestResponse?> SendRequestAsync(
            Guid currentUserId,
            CreateFriendRequestRequest request,
            CancellationToken cancellationToken = default);

        Task<FriendRequestResponse?> AcceptRequestAsync(
            Guid currentUserId,
            Guid requestId,
            CancellationToken cancellationToken = default);

        Task<FriendRequestResponse?> DeclineRequestAsync(
            Guid currentUserId,
            Guid requestId,
            CancellationToken cancellationToken = default);

        Task<FriendRequestResponse?> CancelRequestAsync(
            Guid currentUserId,
            Guid requestId,
            CancellationToken cancellationToken = default);

        Task<bool> RemoveFriendAsync(
            Guid currentUserId,
            Guid friendUserId,
            CancellationToken cancellationToken = default);
    }
}
