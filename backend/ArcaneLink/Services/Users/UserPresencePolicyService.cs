using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Users
{
    public sealed class UserPresencePolicyService : IUserPresencePolicyService
    {
        private readonly AppDbContext _db;
        private readonly RealtimeConnectionRegistry _connections;

        public UserPresencePolicyService(
            AppDbContext db,
            RealtimeConnectionRegistry connections)
        {
            this._db = db;
            this._connections = connections;
        }

        public async Task<IReadOnlyDictionary<Guid, UserPresenceSnapshot>> ResolveAsync(
            Guid? viewerUserId,
            IEnumerable<Guid> targetUserIds,
            CancellationToken cancellationToken = default)
        {
            var targetIds = targetUserIds
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList();

            if (targetIds.Count == 0)
            {
                return new Dictionary<Guid, UserPresenceSnapshot>();
            }

            var targets = await this._db.Users
                .AsNoTracking()
                .Where(user =>
                    targetIds.Contains(user.Id) &&
                    user.DeletedAt == null &&
                    user.StatusId == UserStatusIds.Active)
                .Select(user => new PresenceTarget(
                    user.Id,
                    user.LastSeenAt,
                    user.ProfileSettings == null
                        ? PresenceVisibilityCodes.Everyone
                        : user.ProfileSettings.PresenceVisibility,
                    user.ProfileSettings == null || user.ProfileSettings.ShowLastSeen,
                    user.ProfileSettings == null
                        ? PresenceModeCodes.Automatic
                        : user.ProfileSettings.PresenceMode))
                .ToListAsync(cancellationToken);

            var friendIds = viewerUserId.HasValue
                ? await this._db.UserFriends
                    .AsNoTracking()
                    .Where(friend =>
                        friend.UserId == viewerUserId.Value &&
                        targetIds.Contains(friend.FriendUserId) &&
                        friend.CreatedByRequest.StatusId ==
                            FriendRequestStatusIds.Accepted)
                    .Select(friend => friend.FriendUserId)
                    .ToHashSetAsync(cancellationToken)
                : [];

            var friendsOfFriendsIds = viewerUserId.HasValue
                ? await (
                    from targetFriend in this._db.UserFriends.AsNoTracking()
                    join viewerFriend in this._db.UserFriends.AsNoTracking()
                        on targetFriend.FriendUserId equals
                        viewerFriend.FriendUserId
                    where
                        targetIds.Contains(targetFriend.UserId) &&
                        targetFriend.UserId != viewerUserId.Value &&
                        viewerFriend.UserId == viewerUserId.Value &&
                        targetFriend.CreatedByRequest.StatusId ==
                        FriendRequestStatusIds.Accepted &&
                        viewerFriend.CreatedByRequest.StatusId ==
                        FriendRequestStatusIds.Accepted &&
                        targetFriend.FriendUser.StatusId ==
                        UserStatusIds.Active &&
                        targetFriend.FriendUser.DeletedAt == null
                    select targetFriend.UserId)
                    .Distinct()
                    .ToHashSetAsync(cancellationToken)
                : [];

            var sharedServerTargetIds = viewerUserId.HasValue
                ? await this._db.ServerMembers
                    .AsNoTracking()
                    .Where(member =>
                        targetIds.Contains(member.UserId) &&
                        member.StatusId == ServerMemberStatusIds.Active &&
                        member.BannedAt == null &&
                        member.Server.DeletedAt == null &&
                        member.User.StatusId == UserStatusIds.Active &&
                        member.User.DeletedAt == null &&
                        this._db.ServerMembers.Any(viewerMember =>
                            viewerMember.ServerId == member.ServerId &&
                            viewerMember.UserId == viewerUserId.Value &&
                            viewerMember.StatusId ==
                            ServerMemberStatusIds.Active &&
                            viewerMember.BannedAt == null))
                    .Select(member => member.UserId)
                    .Distinct()
                    .ToHashSetAsync(cancellationToken)
                : [];

            var result = targetIds.ToDictionary(
                id => id,
                _ => UserPresenceSnapshot.Hidden);

            foreach (var target in targets)
            {
                var isSelf = viewerUserId == target.UserId;
                var visibility = PresenceVisibilityCodes.ParseOrNobody(
                    target.PresenceVisibility);
                var isVisible = isSelf ||
                    visibility.AllowsEveryone ||
                    viewerUserId.HasValue &&
                    (visibility.AllowsFriends &&
                     friendIds.Contains(target.UserId) ||
                     visibility.AllowsFriendsOfFriends &&
                     friendsOfFriendsIds.Contains(target.UserId) ||
                     visibility.AllowsSharedServers &&
                     sharedServerTargetIds.Contains(target.UserId));

                if (!isVisible)
                {
                    continue;
                }

                var mode = PresenceModeCodes.Normalize(target.PresenceMode)
                    ?? PresenceModeCodes.Invisible;
                var isOnline = mode == PresenceModeCodes.Automatic &&
                    this._connections.HasConnections(target.UserId);

                result[target.UserId] = new UserPresenceSnapshot(
                    isOnline
                        ? PresenceStatusCodes.Online
                        : PresenceStatusCodes.Offline,
                    target.ShowLastSeen ? target.LastSeenAt : null);
            }

            return result;
        }

        private sealed record PresenceTarget(
            Guid UserId,
            DateTime? LastSeenAt,
            string PresenceVisibility,
            bool ShowLastSeen,
            string PresenceMode);
    }
}
