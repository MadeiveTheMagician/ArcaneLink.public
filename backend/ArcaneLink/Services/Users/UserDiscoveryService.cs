using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.Users.UserProfileResponseMapper;

namespace ArcaneLink.Services.Users
{
    public class UserDiscoveryService : IUserDiscoveryService
    {
        private readonly AppDbContext _db;
        private readonly IUserPresencePolicyService _presencePolicy;

        public UserDiscoveryService(
            AppDbContext db,
            IUserPresencePolicyService presencePolicy)
        {
            _db = db;
            _presencePolicy = presencePolicy;
        }

        public async Task<IReadOnlyList<FriendUserResponse>> SearchUsersAsync(
            Guid currentUserId,
            string query,
            CancellationToken cancellationToken = default)
        {
            var normalizedQuery = query.Trim().ToUpperInvariant();
            if (normalizedQuery.Length < 2)
            {
                return [];
            }

            var users = await _db.Users
                .AsNoTracking()
                .Include(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .Where(
                    x => x.Id != currentUserId &&
                         x.DeletedAt == null &&
                         x.StatusId == UserStatusIds.Active &&
                         (x.LoginNorm.Contains(normalizedQuery) ||
                          x.Profile.DisplayNameNorm.Contains(normalizedQuery)))
                .OrderBy(x => x.Profile.DisplayNameNorm)
                .Take(20)
                .ToListAsync(cancellationToken);

            var presence = await _presencePolicy.ResolveAsync(
                currentUserId,
                users.Select(user => user.Id),
                cancellationToken);

            return users
                .Select(user => ToFriendUserResponse(
                    user,
                    presence.GetValueOrDefault(
                        user.Id,
                        UserPresenceSnapshot.Hidden)))
                .ToList();
        }

        public async Task<IReadOnlyList<FriendUserResponse>> DiscoverUsersAsync(
            Guid currentUserId,
            UserDiscoveryQuery query,
            CancellationToken cancellationToken = default)
        {
            var normalizedQuery = query.Query?.Trim().ToUpperInvariant();
            var scope = query.Scope?.Trim().ToLowerInvariant() ?? "all";
            var sort = query.Sort?.Trim().ToLowerInvariant() ?? "recommended";
            var selectedTagIds = query.TagIds
                .Where(x => x != Guid.Empty)
                .Distinct()
                .ToHashSet();
            var currentFriendIds = await _db.UserFriends
                .AsNoTracking()
                .Where(x => x.UserId == currentUserId)
                .Select(x => x.FriendUserId)
                .ToListAsync(cancellationToken);
            var friendIdSet = currentFriendIds.ToHashSet();

            var currentServerIds = await _db.ServerMembers
                .AsNoTracking()
                .Where(x => x.UserId == currentUserId &&
                            x.StatusId == ServerMemberStatusIds.Active &&
                            x.Server.DeletedAt == null)
                .Select(x => x.ServerId)
                .ToListAsync(cancellationToken);
            var serverIdSet = currentServerIds.ToHashSet();

            var currentTagIds = await _db.UserProfileTags
                .AsNoTracking()
                .Where(x => x.UserId == currentUserId)
                .Select(x => x.TagId)
                .ToListAsync(cancellationToken);
            var currentTagIdSet = currentTagIds.ToHashSet();

            var candidatesQuery = _db.Users
                .AsNoTracking()
                .Include(x => x.Profile)
                    .ThenInclude(x => x.Tags)
                    .ThenInclude(x => x.Tag)
                .Where(x => x.Id != currentUserId &&
                            x.DeletedAt == null &&
                            x.StatusId == UserStatusIds.Active &&
                            !friendIdSet.Contains(x.Id));

            if (!string.IsNullOrWhiteSpace(normalizedQuery))
            {
                candidatesQuery = candidatesQuery.Where(x =>
                    x.LoginNorm.Contains(normalizedQuery) ||
                    x.Profile.DisplayNameNorm.Contains(normalizedQuery));
            }

            if (selectedTagIds.Count > 0)
            {
                candidatesQuery = candidatesQuery.Where(x =>
                    x.Profile.Tags.Any(tag => selectedTagIds.Contains(tag.TagId)));
            }

            if (scope == "shared-servers" || scope == "recommended")
            {
                candidatesQuery = candidatesQuery.Where(x =>
                    x.ServerMemberships.Any(member =>
                        serverIdSet.Contains(member.ServerId) &&
                        member.StatusId == ServerMemberStatusIds.Active &&
                        member.Server.DeletedAt == null));
            }

            var candidates = await candidatesQuery
                .OrderBy(x => x.Profile.DisplayNameNorm)
                .Take(200)
                .ToListAsync(cancellationToken);
            var presence = await _presencePolicy.ResolveAsync(
                currentUserId,
                candidates.Select(user => user.Id),
                cancellationToken);

            if (query.Online == true)
            {
                candidates = candidates
                    .Where(user =>
                        presence.GetValueOrDefault(
                            user.Id,
                            UserPresenceSnapshot.Hidden).PresenceStatus ==
                        PresenceStatusCodes.Online)
                    .ToList();
            }

            var candidateIds = candidates.Select(x => x.Id).ToHashSet();

            if (candidateIds.Count == 0)
            {
                return [];
            }

            var mutualFriendCounts = await _db.UserFriends
                .AsNoTracking()
                .Where(x => candidateIds.Contains(x.UserId) &&
                            friendIdSet.Contains(x.FriendUserId))
                .GroupBy(x => x.UserId)
                .Select(x => new { UserId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count, cancellationToken);

            var mutualServerCounts = await _db.ServerMembers
                .AsNoTracking()
                .Where(x => candidateIds.Contains(x.UserId) &&
                            serverIdSet.Contains(x.ServerId) &&
                            x.StatusId == ServerMemberStatusIds.Active &&
                            x.Server.DeletedAt == null)
                .GroupBy(x => x.UserId)
                .Select(x => new { UserId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count, cancellationToken);

            var sharedTagCounts = await _db.UserProfileTags
                .AsNoTracking()
                .Where(x => candidateIds.Contains(x.UserId) &&
                            currentTagIdSet.Contains(x.TagId))
                .GroupBy(x => x.UserId)
                .Select(x => new { UserId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count, cancellationToken);

            var incomingRequestUserIds = await _db.FriendRequests
                .AsNoTracking()
                .Where(x => x.ToUserId == currentUserId &&
                            x.StatusId == FriendRequestStatusIds.Pending &&
                            candidateIds.Contains(x.FromUserId))
                .Select(x => x.FromUserId)
                .ToListAsync(cancellationToken);
            var incomingRequestSet = incomingRequestUserIds.ToHashSet();

            var outgoingRequestUserIds = await _db.FriendRequests
                .AsNoTracking()
                .Where(x => x.FromUserId == currentUserId &&
                            x.StatusId == FriendRequestStatusIds.Pending &&
                            candidateIds.Contains(x.ToUserId))
                .Select(x => x.ToUserId)
                .ToListAsync(cancellationToken);
            var outgoingRequestSet = outgoingRequestUserIds.ToHashSet();

            var randomOrder = candidateIds.ToDictionary(
                x => x,
                _ => Random.Shared.NextDouble());
            var scoredUsers = candidates
                .Select(user =>
                {
                    var mutualFriends = mutualFriendCounts.GetValueOrDefault(user.Id);
                    var mutualServers = mutualServerCounts.GetValueOrDefault(user.Id);
                    var sharedTags = sharedTagCounts.GetValueOrDefault(user.Id);
                    var userPresence = presence.GetValueOrDefault(
                        user.Id,
                        UserPresenceSnapshot.Hidden);
                    var isOnline = userPresence.PresenceStatus == PresenceStatusCodes.Online;
                    var score =
                        mutualFriends * 8 +
                        mutualServers * 5 +
                        sharedTags * 3 +
                        (isOnline ? 1 : 0);

                    return new
                    {
                        User = user,
                        MutualFriends = mutualFriends,
                        MutualServers = mutualServers,
                        SharedTags = sharedTags,
                        Score = score,
                        IsOnline = isOnline,
                        Presence = userPresence,
                        Random = randomOrder[user.Id]
                    };
                });

            scoredUsers = sort switch
            {
                "online" => scoredUsers
                    .OrderByDescending(x => x.IsOnline)
                    .ThenByDescending(x => x.Score)
                    .ThenBy(x => x.Random),
                "recent" => scoredUsers
                    .OrderByDescending(x => x.Presence.LastSeenAt)
                    .ThenByDescending(x => x.Score),
                "name" => scoredUsers
                    .OrderBy(x => x.User.Profile.DisplayNameNorm),
                _ => scoredUsers
                    .OrderByDescending(x => x.Score)
                    .ThenBy(x => x.Random)
            };

            return scoredUsers
                .Take(48)
                .Select(x => ToFriendUserResponse(
                    x.User,
                    x.Presence,
                    x.MutualServers,
                    x.MutualFriends,
                    x.SharedTags,
                    x.Score,
                    isFriend: false,
                    hasIncomingFriendRequest: incomingRequestSet.Contains(x.User.Id),
                    hasOutgoingFriendRequest: outgoingRequestSet.Contains(x.User.Id)))
                .ToList();
        }
    }
}
