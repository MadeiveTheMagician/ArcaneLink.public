using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ArcaneLink.Services.Users
{
    public class FriendService : Abstractions.IFriendService
    {
        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;
        private readonly IUserNotificationService _notifications;
        private readonly IUserPresencePolicyService _presencePolicy;
        private readonly IUserPresenceCoordinator _presenceCoordinator;
        private readonly ILogger<FriendService> _logger;

        public FriendService(
            AppDbContext db,
            IRealtimeNotificationService realtime,
            IUserNotificationService notifications,
            IUserPresencePolicyService presencePolicy,
            IUserPresenceCoordinator presenceCoordinator,
            ILogger<FriendService> logger)
        {
            _db = db;
            _realtime = realtime;
            _notifications = notifications;
            _presencePolicy = presencePolicy;
            _presenceCoordinator = presenceCoordinator;
            _logger = logger;
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
            if (request.ToUserId == currentUserId)
            {
                return null;
            }

            FriendRequestResponse? response = null;
            FriendRequest? acceptedReverseRequest = null;
            FriendRequest? createdRequest = null;

            // The process-local presence gates keep SQLite tests and a single
            // instance serialized. PostgreSQL additionally locks both user rows
            // in database GUID order, so A -> B and B -> A are serialized across
            // every application instance before either pending-state check.
            await _presenceCoordinator.ExecuteMutationAsync(
                [currentUserId, request.ToUserId],
                async token =>
                {
                    await using var transaction =
                        await _db.Database.BeginTransactionAsync(token);
                    await LockFriendMutationUsersAsync(
                        currentUserId,
                        request.ToUserId,
                        token);

                    if (!await IsActiveUserAsync(currentUserId, token) ||
                        !await IsActiveUserAsync(request.ToUserId, token) ||
                        await AreFriendsAsync(currentUserId, request.ToUserId, token))
                    {
                        return;
                    }

                    var reverseRequest = await _db.FriendRequests
                        .FirstOrDefaultAsync(
                            x => x.FromUserId == request.ToUserId &&
                                 x.ToUserId == currentUserId &&
                                 x.StatusId == FriendRequestStatusIds.Pending,
                            token);

                    if (reverseRequest != null)
                    {
                        response = await AcceptRequestCoreAsync(
                            currentUserId,
                            reverseRequest,
                            token);
                        await transaction.CommitAsync(token);
                        acceptedReverseRequest = reverseRequest;
                        return;
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
                            token);

                    if (existing != null)
                    {
                        await transaction.CommitAsync(token);
                        response = await ToRequestResponseAsync(
                            currentUserId,
                            existing,
                            token);
                        return;
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
                    await _notifications.StageFriendRequestAsync(
                        friendRequest.ToUserId,
                        friendRequest.FromUserId,
                        token);
                    await _db.SaveChangesAsync(token);
                    response = await LoadRequestResponseAsync(
                        currentUserId,
                        friendRequest.Id,
                        token);
                    await transaction.CommitAsync(token);
                    createdRequest = friendRequest;
                },
                cancellationToken);

            if (acceptedReverseRequest != null)
            {
                await TryNotifyPostCommitAsync(
                    acceptedReverseRequest.Id,
                    "presence audience refresh",
                    token => _presenceCoordinator.AudienceChangedAsync(
                        [acceptedReverseRequest.FromUserId, acceptedReverseRequest.ToUserId],
                        token));
                await NotifyFriendRequestClosedAsync(acceptedReverseRequest);
                return response;
            }

            if (createdRequest == null)
            {
                return response;
            }

            await TryNotifyPostCommitAsync(
                createdRequest.Id,
                "notification-list refresh",
                token => _notifications.NotifyChangedAsync(
                    [createdRequest.ToUserId],
                    token));
            await TryNotifyPostCommitAsync(
                createdRequest.Id,
                "receiver friend-request event",
                token => _realtime.NotifyUserAsync(
                    createdRequest.ToUserId,
                    RealtimeEventNames.FriendRequestReceived,
                    new { requestId = createdRequest.Id, fromUserId = currentUserId },
                    token));
            await TryNotifyPostCommitAsync(
                createdRequest.Id,
                "sender friend-request event",
                token => _realtime.NotifyUserAsync(
                    currentUserId,
                    RealtimeEventNames.FriendRequestUpdated,
                    new { requestId = createdRequest.Id, toUserId = createdRequest.ToUserId },
                    token));

            return response;
        }

        public async Task<FriendRequestResponse?> AcceptRequestAsync(
            Guid currentUserId,
            Guid requestId,
            CancellationToken cancellationToken = default)
        {
            var participants = await _db.FriendRequests
                .AsNoTracking()
                .Where(
                    x => x.Id == requestId &&
                         x.ToUserId == currentUserId)
                .Select(x => new { x.FromUserId, x.ToUserId })
                .FirstOrDefaultAsync(
                    cancellationToken);

            if (participants == null)
            {
                return null;
            }

            FriendRequestResponse? response = null;
            FriendRequest? acceptedRequest = null;
            await _presenceCoordinator.ExecuteMutationAsync(
                [participants.FromUserId, participants.ToUserId],
                async token =>
                {
                    await using var transaction =
                        await _db.Database.BeginTransactionAsync(token);
                    await LockFriendMutationUsersAsync(
                        participants.FromUserId,
                        participants.ToUserId,
                        token);

                    var request = await _db.FriendRequests
                        .FirstOrDefaultAsync(
                            x => x.Id == requestId &&
                                 x.ToUserId == currentUserId &&
                                 x.StatusId == FriendRequestStatusIds.Pending,
                            token);
                    if (request == null)
                    {
                        return;
                    }

                    response = await AcceptRequestCoreAsync(
                        currentUserId,
                        request,
                        token);
                    if (response == null)
                    {
                        return;
                    }

                    await transaction.CommitAsync(token);
                    acceptedRequest = request;
                },
                cancellationToken);

            if (acceptedRequest == null)
            {
                return response;
            }

            await TryNotifyPostCommitAsync(
                acceptedRequest.Id,
                "presence audience refresh",
                token => _presenceCoordinator.AudienceChangedAsync(
                    [acceptedRequest.FromUserId, acceptedRequest.ToUserId],
                    token));
            await NotifyFriendRequestClosedAsync(acceptedRequest);
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
            var removed = false;
            await _presenceCoordinator.ExecuteMutationAsync(
                [currentUserId, friendUserId],
                async token =>
                {
                    await using var transaction =
                        await _db.Database.BeginTransactionAsync(token);
                    await LockFriendMutationUsersAsync(
                        currentUserId,
                        friendUserId,
                        token);

                    var rows = await _db.UserFriends
                        .Where(
                            x => (x.UserId == currentUserId && x.FriendUserId == friendUserId) ||
                                 (x.UserId == friendUserId && x.FriendUserId == currentUserId))
                        .ToListAsync(token);
                    if (rows.Count == 0)
                    {
                        return;
                    }

                    _db.UserFriends.RemoveRange(rows);
                    await _db.SaveChangesAsync(token);
                    await transaction.CommitAsync(token);
                    removed = true;
                },
                cancellationToken);

            if (!removed)
            {
                return false;
            }

            await TryNotifyPostCommitAsync(
                friendUserId,
                "presence audience refresh after friend removal",
                token => _presenceCoordinator.AudienceChangedAsync(
                    [currentUserId, friendUserId],
                    token));
            await TryNotifyPostCommitAsync(
                friendUserId,
                "current-user friend-list event after friend removal",
                token => _realtime.NotifyUserAsync(
                    currentUserId,
                    RealtimeEventNames.FriendListChanged,
                    new { friendUserId },
                    token));
            await TryNotifyPostCommitAsync(
                friendUserId,
                "removed-user friend-list event after friend removal",
                token => _realtime.NotifyUserAsync(
                    friendUserId,
                    RealtimeEventNames.FriendListChanged,
                    new { friendUserId = currentUserId },
                    token));
            return true;
        }

        private async Task LockFriendMutationUsersAsync(
            Guid firstUserId,
            Guid secondUserId,
            CancellationToken cancellationToken)
        {
            if (!_db.Database.IsNpgsql())
            {
                return;
            }

            _ = await _db.Users
                .FromSqlInterpolated($$"""
                    SELECT *
                    FROM users
                    WHERE id IN ({{firstUserId}}, {{secondUserId}})
                    ORDER BY id
                    FOR UPDATE
                    """)
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }

        private async Task NotifyFriendRequestClosedAsync(FriendRequest request)
        {
            await TryNotifyPostCommitAsync(
                request.Id,
                "notification-list refresh",
                token => _notifications.NotifyChangedAsync(
                    [request.ToUserId],
                    token));

            if (request.StatusId == FriendRequestStatusIds.Accepted)
            {
                await TryNotifyPostCommitAsync(
                    request.Id,
                    "sender friend-list event",
                    token => _realtime.NotifyUserAsync(
                        request.FromUserId,
                        RealtimeEventNames.FriendListChanged,
                        new { requestId = request.Id, friendUserId = request.ToUserId },
                        token));
                await TryNotifyPostCommitAsync(
                    request.Id,
                    "receiver friend-list event",
                    token => _realtime.NotifyUserAsync(
                        request.ToUserId,
                        RealtimeEventNames.FriendListChanged,
                        new { requestId = request.Id, friendUserId = request.FromUserId },
                        token));
            }

            await TryNotifyPostCommitAsync(
                request.Id,
                "sender friend-request event",
                token => _realtime.NotifyUserAsync(
                    request.FromUserId,
                    RealtimeEventNames.FriendRequestUpdated,
                    new { requestId = request.Id, statusId = request.StatusId },
                    token));
            await TryNotifyPostCommitAsync(
                request.Id,
                "receiver friend-request event",
                token => _realtime.NotifyUserAsync(
                    request.ToUserId,
                    RealtimeEventNames.FriendRequestUpdated,
                    new { requestId = request.Id, statusId = request.StatusId },
                    token));
        }

        private async Task TryNotifyPostCommitAsync(
            Guid subjectId,
            string operation,
            Func<CancellationToken, Task> callback)
        {
            try
            {
                await callback(CancellationToken.None);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Friend mutation {SubjectId} committed, but post-commit operation {Operation} failed.",
                    subjectId,
                    operation);
            }
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

            await _notifications.StageFriendRequestReadAsync(
                request.ToUserId,
                request.FromUserId,
                cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
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
            var participants = await _db.FriendRequests
                .AsNoTracking()
                .Where(
                    x => x.Id == requestId &&
                         (requireReceiver
                             ? x.ToUserId == currentUserId
                             : x.FromUserId == currentUserId))
                .Select(x => new { x.FromUserId, x.ToUserId })
                .FirstOrDefaultAsync(
                    cancellationToken);

            if (participants == null)
            {
                return null;
            }

            FriendRequestResponse? response = null;
            FriendRequest? closedRequest = null;
            await _presenceCoordinator.ExecuteMutationAsync(
                [participants.FromUserId, participants.ToUserId],
                async token =>
                {
                    await using var transaction =
                        await _db.Database.BeginTransactionAsync(token);
                    await LockFriendMutationUsersAsync(
                        participants.FromUserId,
                        participants.ToUserId,
                        token);

                    var request = await _db.FriendRequests
                        .FirstOrDefaultAsync(
                            x => x.Id == requestId &&
                                 x.StatusId == FriendRequestStatusIds.Pending &&
                                 (requireReceiver
                                     ? x.ToUserId == currentUserId
                                     : x.FromUserId == currentUserId),
                            token);
                    if (request == null)
                    {
                        return;
                    }

                    var now = DateTime.UtcNow;
                    request.StatusId = statusId;
                    request.UpdatedAt = now;
                    request.RespondedAt = now;

                    await _notifications.StageFriendRequestReadAsync(
                        request.ToUserId,
                        request.FromUserId,
                        token);
                    await _db.SaveChangesAsync(token);
                    response = await LoadRequestResponseAsync(
                        currentUserId,
                        request.Id,
                        token);
                    await transaction.CommitAsync(token);
                    closedRequest = request;
                },
                cancellationToken);

            if (closedRequest == null)
            {
                return response;
            }

            await NotifyFriendRequestClosedAsync(closedRequest);
            return response;
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
