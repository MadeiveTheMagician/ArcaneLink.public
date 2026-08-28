using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using ArcaneLink.Services.Users;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.Servers.ServerResponseMapper;

namespace ArcaneLink.Services.Servers
{
    public class ServerDiscoveryService : IServerDiscoveryService
    {
        private readonly AppDbContext _db;
        private readonly ServerLastMessageQueryService _lastMessages;
        private readonly ISpaceAuthorizationService _spaceAuthorization;
        private readonly IUserPresencePolicyService _presencePolicy;

        public ServerDiscoveryService(
            AppDbContext db,
            ServerLastMessageQueryService lastMessages,
            ISpaceAuthorizationService spaceAuthorization,
            IUserPresencePolicyService presencePolicy)
        {
            this._db = db;
            this._lastMessages = lastMessages;
            this._spaceAuthorization = spaceAuthorization;
            this._presencePolicy = presencePolicy;
        }

        public async Task<IReadOnlyList<ServerDiscoveryResponse>> DiscoverServersAsync(
            Guid currentUserId,
            ServerDiscoveryQuery query,
            CancellationToken cancellationToken = default)
        {
            var normalizedQuery = query.Query?.Trim().ToUpperInvariant();
            var visibility = query.Visibility?.Trim().ToLowerInvariant() ?? "all";
            var sort = query.Sort?.Trim().ToLowerInvariant() ?? "active";
            var currentMemberships = await this._db.ServerMembers
                .AsNoTracking()
                .Where(x => x.UserId == currentUserId &&
                            x.StatusId == ServerMemberStatusIds.Active &&
                            x.BannedAt == null &&
                            x.Server.DeletedAt == null)
                .Select(x => new { x.ServerId, x.Id, x.JoinedAt })
                .ToListAsync(cancellationToken);
            var membershipByServerId = currentMemberships
                .ToDictionary(x => x.ServerId);
            var currentServerIds = membershipByServerId.Keys.ToHashSet();
            var bannedServerIds = (await this._db.ServerMembers
                    .AsNoTracking()
                    .Where(member =>
                        member.UserId == currentUserId &&
                        (member.StatusId == ServerMemberStatusIds.Banned ||
                         member.BannedAt != null) &&
                        member.Server.DeletedAt == null)
                    .Select(member => member.ServerId)
                    .ToListAsync(cancellationToken))
                .ToHashSet();

            var serversQuery = this._db.Servers
                .AsNoTracking()
                .Where(x => x.DeletedAt == null && !x.IsSystem);

            serversQuery = visibility switch
            {
                "public" => serversQuery.Where(x =>
                    x.AccessMode == ServerAccessModeCodes.Public ||
                    x.AccessMode == ServerAccessModeCodes.Restricted),
                "available" => serversQuery.Where(x =>
                    (x.AccessMode == ServerAccessModeCodes.Public ||
                     x.AccessMode == ServerAccessModeCodes.Restricted) &&
                    !currentServerIds.Contains(x.Id) &&
                    !bannedServerIds.Contains(x.Id)),
                "member" => serversQuery.Where(x => currentServerIds.Contains(x.Id)),
                _ => serversQuery.Where(x =>
                    x.AccessMode == ServerAccessModeCodes.Public ||
                    x.AccessMode == ServerAccessModeCodes.Restricted ||
                    currentServerIds.Contains(x.Id))
            };

            if (!string.IsNullOrWhiteSpace(normalizedQuery))
            {
                serversQuery = serversQuery.Where(x =>
                    x.Title.ToUpper().Contains(normalizedQuery) ||
                    x.Slug.ToUpper().Contains(normalizedQuery) ||
                    (x.Description != null &&
                     x.Description.ToUpper().Contains(normalizedQuery)));
            }

            var servers = await serversQuery
                .OrderByDescending(x => x.UpdatedAt)
                .Take(120)
                .ToListAsync(cancellationToken);
            var serverIds = servers.Select(x => x.Id).ToHashSet();

            if (serverIds.Count == 0)
            {
                return [];
            }

            var currentJoinRequests = await this._db.ServerJoinRequests
                .AsNoTracking()
                .Include(joinRequest => joinRequest.User)
                    .ThenInclude(user => user.Profile)
                .Where(joinRequest =>
                    serverIds.Contains(joinRequest.ServerId) &&
                    joinRequest.UserId == currentUserId &&
                    joinRequest.StatusCode ==
                    ServerJoinRequestStatusCodes.Pending)
                .OrderByDescending(joinRequest => joinRequest.CreatedAt)
                .ToListAsync(cancellationToken);
            var currentJoinRequestByServerId = currentJoinRequests
                .GroupBy(joinRequest => joinRequest.ServerId)
                .ToDictionary(
                    group => group.Key,
                    group => group.First());

            var memberCounts = await this._db.ServerMembers
                .AsNoTracking()
                .Where(x => serverIds.Contains(x.ServerId) &&
                            x.StatusId == ServerMemberStatusIds.Active &&
                            x.BannedAt == null)
                .GroupBy(x => x.ServerId)
                .Select(x => new { ServerId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.ServerId, x => x.Count, cancellationToken);

            var activeMembers = await this._db.ServerMembers
                .AsNoTracking()
                .Where(x => serverIds.Contains(x.ServerId) &&
                            x.StatusId == ServerMemberStatusIds.Active &&
                            x.BannedAt == null)
                .Select(x => new { x.ServerId, x.UserId })
                .ToListAsync(cancellationToken);
            var memberPresence = await this._presencePolicy.ResolveAsync(
                currentUserId,
                activeMembers.Select(member => member.UserId),
                cancellationToken);
            var onlineMemberCounts = activeMembers
                .Where(member =>
                    memberPresence.GetValueOrDefault(
                        member.UserId,
                        UserPresenceSnapshot.Hidden).PresenceStatus ==
                    PresenceStatusCodes.Online)
                .GroupBy(member => member.ServerId)
                .ToDictionary(group => group.Key, group => group.Count());

            var friendUserIds = (await this._db.UserFriends
                    .AsNoTracking()
                    .Where(x => x.UserId == currentUserId)
                    .Select(x => x.FriendUserId)
                    .ToListAsync(cancellationToken))
                .ToHashSet();
            var friendCounts = activeMembers
                .Where(member => friendUserIds.Contains(member.UserId))
                .GroupBy(member => member.ServerId)
                .ToDictionary(group => group.Key, group => group.Count());

            var snapshots = await this._spaceAuthorization.GetSnapshotsAsync(
                currentUserId,
                serverIds,
                cancellationToken);
            var spaces = await this._db.Spaces
                .AsNoTracking()
                .Where(x =>
                    x.ServerId.HasValue &&
                    serverIds.Contains(x.ServerId.Value) &&
                    x.DeletedAt == null &&
                    (x.TypeId == SpaceIds.TypeTextRoom ||
                     x.TypeId == SpaceIds.TypeVoiceRoom))
                .Select(x => new
                {
                    ServerId = x.ServerId!.Value,
                    x.Id,
                    x.TypeId
                })
                .ToListAsync(cancellationToken);
            var granularSpaceCapabilities = new Dictionary<
                (Guid ServerId, Guid SpaceId),
                SpaceAccessCapabilities>();
            foreach (var space in spaces.Where(space =>
                         currentServerIds.Contains(space.ServerId)))
            {
                var capabilities = await this._spaceAuthorization
                    .GetGranularCapabilitiesAsync(
                        currentUserId,
                        space.ServerId,
                        space.Id,
                        cancellationToken);
                if (capabilities != null)
                {
                    granularSpaceCapabilities[(space.ServerId, space.Id)] =
                        capabilities;
                }
            }

            var visibleSpaceCounts = spaces
                .Where(space =>
                    granularSpaceCapabilities.TryGetValue(
                        (space.ServerId, space.Id),
                        out var capabilities) &&
                    capabilities.CanView)
                .GroupBy(space => space.ServerId)
                .ToDictionary(
                    group => group.Key,
                    group => new
                    {
                        Text = group.Count(space =>
                            space.TypeId == SpaceIds.TypeTextRoom),
                        Voice = group.Count(space =>
                            space.TypeId == SpaceIds.TypeVoiceRoom)
                    });

            var currentMembershipIds = currentMemberships
                .Select(x => x.Id)
                .ToHashSet();
            var currentRoleAssignments = await this._db.ServerMemberRoles
                .AsNoTracking()
                .Where(x =>
                    serverIds.Contains(x.ServerId) &&
                    currentMembershipIds.Contains(x.MemberId) &&
                    x.RevokedAt == null &&
                    x.Role.DeletedAt == null)
                .Select(x => new
                {
                    x.ServerId,
                    x.RoleId,
                    x.Role.Title,
                    x.Role.Level
                })
                .ToListAsync(cancellationToken);
            var currentRoleTitles = currentRoleAssignments
                .GroupBy(x => x.ServerId)
                .ToDictionary(
                    group => group.Key,
                    group => (IReadOnlyList<string>)group
                        .OrderByDescending(x => x.Level)
                        .ThenBy(x => x.Title)
                        .ThenBy(x => x.RoleId)
                        .Select(x => x.Title)
                        .ToList());

            var lastMessages = await this._lastMessages.GetAsync(
                currentUserId,
                serverIds,
                snapshots,
                cancellationToken);
            var visibleDefaultSpaceIds = new Dictionary<Guid, Guid?>();
            foreach (var server in servers)
            {
                if (!server.DefaultTextSpaceId.HasValue)
                {
                    visibleDefaultSpaceIds[server.Id] = null;
                    continue;
                }

                visibleDefaultSpaceIds[server.Id] =
                    granularSpaceCapabilities.TryGetValue(
                        (server.Id, server.DefaultTextSpaceId.Value),
                        out var capabilities) &&
                    capabilities.CanView
                    ? server.DefaultTextSpaceId
                    : null;
            }
            var response = servers.Select(server =>
            {
                var lastActivityAt = lastMessages.TryGetValue(server.Id, out var message)
                    ? message.CreatedAt
                    : server.UpdatedAt;
                var hasMembership = membershipByServerId.TryGetValue(
                    server.Id,
                    out var membership);
                var hasPendingRequest = currentJoinRequestByServerId.TryGetValue(
                    server.Id,
                    out var currentJoinRequest);
                var isBanned = bannedServerIds.Contains(server.Id);
                var spaceCounts = visibleSpaceCounts.GetValueOrDefault(server.Id);

                var serverResponse = ToServerResponse(server);
                serverResponse.DefaultTextSpaceId =
                    visibleDefaultSpaceIds.GetValueOrDefault(server.Id);

                return new ServerDiscoveryResponse
                {
                    Server = serverResponse,
                    IsMember = hasMembership,
                    MembershipId = hasMembership ? membership!.Id : null,
                    JoinedAt = hasMembership ? membership!.JoinedAt : null,
                    MemberCount = memberCounts.GetValueOrDefault(server.Id),
                    OnlineMemberCount = onlineMemberCounts.GetValueOrDefault(server.Id),
                    TextSpaceCount = spaceCounts?.Text ?? 0,
                    VoiceSpaceCount = spaceCounts?.Voice ?? 0,
                    FriendCount = friendCounts.GetValueOrDefault(server.Id),
                    CurrentUserRoleTitles =
                        currentRoleTitles.GetValueOrDefault(server.Id) ?? [],
                    LastActivityAt = lastActivityAt,
                    JoinAction = hasMembership || isBanned
                        ? ServerJoinActionCodes.None
                        : hasPendingRequest
                            ? ServerJoinActionCodes.Pending
                            : server.AccessMode == ServerAccessModeCodes.Public
                                ? ServerJoinActionCodes.Join
                                : server.AccessMode ==
                                    ServerAccessModeCodes.Restricted
                                    ? ServerJoinActionCodes.Request
                                    : ServerJoinActionCodes.None,
                    CurrentUserJoinRequest = hasPendingRequest
                        ? ServerJoinRequestService.ToResponse(
                            currentJoinRequest!)
                        : null
                };
            });

            response = sort switch
            {
                "members" => response
                    .OrderByDescending(x => x.MemberCount)
                    .ThenByDescending(x => x.LastActivityAt),
                "name" => response.OrderBy(x => x.Server.Title),
                _ => response
                    .OrderByDescending(x => x.LastActivityAt)
                    .ThenByDescending(x => x.OnlineMemberCount)
            };

            return response.ToList();
        }
    }
}
