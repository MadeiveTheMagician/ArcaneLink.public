using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Users
{
    public class FriendService : Abstractions.IFriendService
    {
        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;
        private readonly IUserPresencePolicyService _presencePolicy;
        private readonly IUserPresenceCoordinator _presenceCoordinator;

        public FriendService(
            AppDbContext db,
            IRealtimeNotificationService realtime,
            IUserPresencePolicyService presencePolicy,
            IUserPresenceCoordinator presenceCoordinator)
        {
            _db = db;
            _realtime = realtime;
            _presencePolicy = presencePolicy;
            _presenceCoordinator = presenceCoordinator;
        }

        public async Task<IReadOnlyList<UserFriendResponse>> GetFriendsAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default)
        {
            var friends = await _db.UserFriends
                .AsNoTracking()
                .Include(x => x.FriendUser).ThenInclude(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .Where(
                    x => x.UserId == currentUserId &&
                         x.FriendUser.DeletedAt == null &&
                         x.FriendUser.StatusId == UserStatusIds.Active)
                .OrderBy(x => x.FriendUser.Profile.DisplayNameNorm)
                .ToListAsync(cancellationToken);

            var presence = await _presencePolicy.ResolveAsync(
                currentUserId,
                friends.Select(friend => friend.FriendUserId),
                cancellationToken);

            return friends
                .Select(friend => ToFriendResponse(friend, presence))
                .ToList();
        }

        public async Task<IReadOnlyList<FriendRequestResponse>> GetIncomingRequestsAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default)
        {
            var requests = await _db.FriendRequests
                .AsNoTracking()
                .Include(x => x.Status)
                .Include(x => x.FromUser).ThenInclude(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .Include(x => x.ToUser).ThenInclude(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .Where(
                    x => x.ToUserId == currentUserId &&
                         x.StatusId == FriendRequestStatusIds.Pending &&
                         x.FromUser.DeletedAt == null &&
                         x.FromUser.StatusId == UserStatusIds.Active)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            var presence = await ResolveRequestPresenceAsync(
                currentUserId,
                requests,
                cancellationToken);

            return requests
                .Select(request => ToRequestResponse(request, presence))
                .ToList();
        }

        public async Task<IReadOnlyList<FriendRequestResponse>> GetOutgoingRequestsAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default)
        {
            var requests = await _db.FriendRequests
                .AsNoTracking()
                .Include(x => x.Status)
                .Include(x => x.FromUser).ThenInclude(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .Include(x => x.ToUser).ThenInclude(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .Where(
                    x => x.FromUserId == currentUserId &&
                         x.StatusId == FriendRequestStatusIds.Pending &&
                         x.ToUser.DeletedAt == null &&
                         x.ToUser.StatusId == UserStatusIds.Active)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            var presence = await ResolveRequestPresenceAsync(
                currentUserId,
                requests,
                cancellationToken);

            return requests
                .Select(request => ToRequestResponse(request, presence))
                .ToList();
        }

        public async Task<FriendRequestResponse?> SendRequestAsync(
            Guid currentUserId,
            CreateFriendRequestRequest request,
            CancellationToken cancellationToken = default)
        {
            if (request.ToUserId == currentUserId ||
                !await IsActiveUserAsync(currentUserId, cancellationToken) ||
                !await IsActiveUserAsync(request.ToUserId, cancellationToken))
            {
                return null;
            }

            if (await AreFriendsAsync(currentUserId, request.ToUserId, cancellationToken))
            {
                return null;
            }

            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            var reverseRequest = await _db.FriendRequests
                .FirstOrDefaultAsync(
                    x => x.FromUserId == request.ToUserId &&
                         x.ToUserId == currentUserId &&
                         x.StatusId == FriendRequestStatusIds.Pending,
                    cancellationToken);

            if (reverseRequest != null)
            {
                FriendRequestResponse? accepted = null;
                await _presenceCoordinator.ExecuteMutationAsync(
                    [reverseRequest.FromUserId, reverseRequest.ToUserId],
                    async token =>
                    {
                        accepted = await AcceptRequestCoreAsync(
                            currentUserId,
                            reverseRequest,
                            token);
                        await transaction.CommitAsync(token);
                    },
                    cancellationToken);
                await _presenceCoordinator.AudienceChangedAsync(
                    [reverseRequest.FromUserId, reverseRequest.ToUserId],
                    CancellationToken.None);
                await NotifyFriendRequestClosedAsync(reverseRequest, cancellationToken);
                return accepted;
            }

            var existing = await _db.FriendRequests
                .Include(x => x.Status)
                .Include(x => x.FromUser).ThenInclude(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .Include(x => x.ToUser).ThenInclude(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .FirstOrDefaultAsync(
                    x => x.FromUserId == currentUserId &&
                         x.ToUserId == request.ToUserId &&
                         x.StatusId == FriendRequestStatusIds.Pending,
                    cancellationToken);

            if (existing != null)
            {
                await transaction.CommitAsync(cancellationToken);
                return await ToRequestResponseAsync(
                    currentUserId,
                    existing,
                    cancellationToken);
            }

            var now = DateTime.UtcNow;
            var friendRequest = new FriendRequest
            {
                Id = Guid.NewGuid(),
                FromUserId = currentUserId,
                ToUserId = request.ToUserId,
                StatusId = FriendRequestStatusIds.Pending,
                CreatedAt = now,
                UpdatedAt = now
            };

            _db.FriendRequests.Add(friendRequest);
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            await _realtime.NotifyUserAsync(
                friendRequest.ToUserId,
                RealtimeEventNames.FriendRequestReceived,
                new { requestId = friendRequest.Id, fromUserId = currentUserId },
                cancellationToken);
            await _realtime.NotifyUserAsync(
                currentUserId,
                RealtimeEventNames.FriendRequestUpdated,
                new { requestId = friendRequest.Id, toUserId = friendRequest.ToUserId },
                cancellationToken);

            return await LoadRequestResponseAsync(
                currentUserId,
                friendRequest.Id,
                cancellationToken);
        }

        public async Task<FriendRequestResponse?> AcceptRequestAsync(
            Guid currentUserId,
            Guid requestId,
            CancellationToken cancellationToken = default)
        {
            var request = await _db.FriendRequests
                .FirstOrDefaultAsync(
                    x => x.Id == requestId &&
                         x.ToUserId == currentUserId &&
                         x.StatusId == FriendRequestStatusIds.Pending,
                    cancellationToken);

            if (request == null)
            {
                return null;
            }

            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            FriendRequestResponse? response = null;
            await _presenceCoordinator.ExecuteMutationAsync(
                [request.FromUserId, request.ToUserId],
                async token =>
                {
                    response = await AcceptRequestCoreAsync(
                        currentUserId,
                        request,
                        token);
                    await transaction.CommitAsync(token);
                },
                cancellationToken);
            await _presenceCoordinator.AudienceChangedAsync(
                [request.FromUserId, request.ToUserId],
                CancellationToken.None);
            await NotifyFriendRequestClosedAsync(request, cancellationToken);
            return response;
        }

        public async Task<FriendRequestResponse?> DeclineRequestAsync(
            Guid currentUserId,
            Guid requestId,
            CancellationToken cancellationToken = default)
        {
            return await SetTerminalRequestStatusAsync(
                currentUserId,
                requestId,
                FriendRequestStatusIds.Declined,
                requireReceiver: true,
                cancellationToken);
        }

        public async Task<FriendRequestResponse?> CancelRequestAsync(
            Guid currentUserId,
            Guid requestId,
            CancellationToken cancellationToken = default)
        {
            return await SetTerminalRequestStatusAsync(
                currentUserId,
                requestId,
                FriendRequestStatusIds.Canceled,
                requireReceiver: false,
                cancellationToken);
        }

        public async Task<bool> RemoveFriendAsync(
            Guid currentUserId,
            Guid friendUserId,
            CancellationToken cancellationToken = default)
        {
            var rows = await _db.UserFriends
                .Where(
                    x => (x.UserId == currentUserId && x.FriendUserId == friendUserId) ||
                         (x.UserId == friendUserId && x.FriendUserId == currentUserId))
                .ToListAsync(cancellationToken);

            if (rows.Count == 0)
            {
                return false;
            }

            _db.UserFriends.RemoveRange(rows);
            await _presenceCoordinator.ExecuteMutationAsync(
                [currentUserId, friendUserId],
                token => _db.SaveChangesAsync(token),
                cancellationToken);
            await _presenceCoordinator.AudienceChangedAsync(
                [currentUserId, friendUserId],
                CancellationToken.None);
            await _realtime.NotifyUserAsync(
                currentUserId,
                RealtimeEventNames.FriendListChanged,
                new { friendUserId },
                cancellationToken);
            await _realtime.NotifyUserAsync(
                friendUserId,
                RealtimeEventNames.FriendListChanged,
                new { friendUserId = currentUserId },
                cancellationToken);
            return true;
        }

        private async Task NotifyFriendRequestClosedAsync(
            FriendRequest request,
            CancellationToken cancellationToken)
        {
            if (request.StatusId == FriendRequestStatusIds.Accepted)
            {
                await _realtime.NotifyUserAsync(
                    request.FromUserId,
                    RealtimeEventNames.FriendListChanged,
                    new { requestId = request.Id, friendUserId = request.ToUserId },
                    cancellationToken);
                await _realtime.NotifyUserAsync(
                    request.ToUserId,
                    RealtimeEventNames.FriendListChanged,
                    new { requestId = request.Id, friendUserId = request.FromUserId },
                    cancellationToken);
            }

            await _realtime.NotifyUserAsync(
                request.FromUserId,
                RealtimeEventNames.FriendRequestUpdated,
                new { requestId = request.Id, statusId = request.StatusId },
                cancellationToken);
            await _realtime.NotifyUserAsync(
                request.ToUserId,
                RealtimeEventNames.FriendRequestUpdated,
                new { requestId = request.Id, statusId = request.StatusId },
                cancellationToken);
        }

        private async Task<FriendRequestResponse?> AcceptRequestCoreAsync(
            Guid currentUserId,
            FriendRequest request,
            CancellationToken cancellationToken)
        {
            if (request.ToUserId != currentUserId ||
                !await IsActiveUserAsync(request.FromUserId, cancellationToken) ||
                !await IsActiveUserAsync(request.ToUserId, cancellationToken))
            {
                return null;
            }

            var now = DateTime.UtcNow;
            request.StatusId = FriendRequestStatusIds.Accepted;
            request.UpdatedAt = now;
            request.RespondedAt = now;

            await EnsureFriendRowsAsync(
                request.FromUserId,
                request.ToUserId,
                request.Id,
                now,
                cancellationToken);

            await _db.SaveChangesAsync(cancellationToken);
            await NotifyFriendRequestClosedAsync(request, cancellationToken);
            return await LoadRequestResponseAsync(
                currentUserId,
                request.Id,
                cancellationToken);
        }

        private async Task EnsureFriendRowsAsync(
            Guid firstUserId,
            Guid secondUserId,
            Guid requestId,
            DateTime now,
            CancellationToken cancellationToken)
        {
            if (!await _db.UserFriends.AnyAsync(
                    x => x.UserId == firstUserId &&
                         x.FriendUserId == secondUserId,
                    cancellationToken))
            {
                _db.UserFriends.Add(new UserFriend
                {
                    UserId = firstUserId,
                    FriendUserId = secondUserId,
                    CreatedByRequestId = requestId,
                    CreatedAt = now
                });
            }

            if (!await _db.UserFriends.AnyAsync(
                    x => x.UserId == secondUserId &&
                         x.FriendUserId == firstUserId,
                    cancellationToken))
            {
                _db.UserFriends.Add(new UserFriend
                {
                    UserId = secondUserId,
                    FriendUserId = firstUserId,
                    CreatedByRequestId = requestId,
                    CreatedAt = now
                });
            }
        }

        private async Task<FriendRequestResponse?> SetTerminalRequestStatusAsync(
            Guid currentUserId,
            Guid requestId,
            Guid statusId,
            bool requireReceiver,
            CancellationToken cancellationToken)
        {
            var request = await _db.FriendRequests
                .FirstOrDefaultAsync(
                    x => x.Id == requestId &&
                         x.StatusId == FriendRequestStatusIds.Pending &&
                         (requireReceiver
                             ? x.ToUserId == currentUserId
                             : x.FromUserId == currentUserId),
                    cancellationToken);

            if (request == null)
            {
                return null;
            }

            var now = DateTime.UtcNow;
            request.StatusId = statusId;
            request.UpdatedAt = now;
            request.RespondedAt = now;

            await _db.SaveChangesAsync(cancellationToken);
            return await LoadRequestResponseAsync(
                currentUserId,
                request.Id,
                cancellationToken);
        }

        private async Task<FriendRequestResponse?> LoadRequestResponseAsync(
            Guid currentUserId,
            Guid requestId,
            CancellationToken cancellationToken)
        {
            var request = await _db.FriendRequests
                .AsNoTracking()
                .Include(x => x.Status)
                .Include(x => x.FromUser).ThenInclude(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .Include(x => x.ToUser).ThenInclude(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .FirstOrDefaultAsync(x => x.Id == requestId, cancellationToken);

            return request == null
                ? null
                : await ToRequestResponseAsync(
                    currentUserId,
                    request,
                    cancellationToken);
        }

        private async Task<bool> IsActiveUserAsync(
            Guid userId,
            CancellationToken cancellationToken)
        {
            return await _db.Users.AnyAsync(
                x => x.Id == userId &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.Active,
                cancellationToken);
        }

        private async Task<bool> AreFriendsAsync(
            Guid currentUserId,
            Guid friendUserId,
            CancellationToken cancellationToken)
        {
            return await _db.UserFriends.AnyAsync(
                x => x.UserId == currentUserId &&
                     x.FriendUserId == friendUserId,
                cancellationToken);
        }

        private async Task<FriendRequestResponse> ToRequestResponseAsync(
            Guid currentUserId,
            FriendRequest request,
            CancellationToken cancellationToken)
        {
            var presence = await ResolveRequestPresenceAsync(
                currentUserId,
                [request],
                cancellationToken);

            return ToRequestResponse(request, presence);
        }

        private async Task<IReadOnlyDictionary<Guid, UserPresenceSnapshot>> ResolveRequestPresenceAsync(
            Guid currentUserId,
            IEnumerable<FriendRequest> requests,
            CancellationToken cancellationToken)
        {
            return await _presencePolicy.ResolveAsync(
                currentUserId,
                requests.SelectMany(request => new[]
                {
                    request.FromUserId,
                    request.ToUserId
                }),
                cancellationToken);
        }

        private static FriendRequestResponse ToRequestResponse(
            FriendRequest request,
            IReadOnlyDictionary<Guid, UserPresenceSnapshot> presence)
        {
            return new FriendRequestResponse
            {
                Id = request.Id,
                FromUserId = request.FromUserId,
                ToUserId = request.ToUserId,
                StatusCode = request.Status.Code,
                CreatedAt = request.CreatedAt,
                UpdatedAt = request.UpdatedAt,
                RespondedAt = request.RespondedAt,
                FromUser = ToFriendUserResponse(
                    request.FromUser,
                    presence.GetValueOrDefault(
                        request.FromUserId,
                        UserPresenceSnapshot.Hidden)),
                ToUser = ToFriendUserResponse(
                    request.ToUser,
                    presence.GetValueOrDefault(
                        request.ToUserId,
                        UserPresenceSnapshot.Hidden))
            };
        }

        private static UserFriendResponse ToFriendResponse(
            UserFriend friend,
            IReadOnlyDictionary<Guid, UserPresenceSnapshot> presence)
        {
            return new UserFriendResponse
            {
                UserId = friend.UserId,
                FriendUserId = friend.FriendUserId,
                CreatedByRequestId = friend.CreatedByRequestId,
                CreatedAt = friend.CreatedAt,
                Friend = ToFriendUserResponse(
                    friend.FriendUser,
                    presence.GetValueOrDefault(
                        friend.FriendUserId,
                        UserPresenceSnapshot.Hidden))
            };
        }

        private static FriendUserResponse ToFriendUserResponse(
            User user,
            UserPresenceSnapshot presence)
        {
            return UserProfileResponseMapper.ToFriendUserResponse(
                user,
                presence);
        }
    }
}
