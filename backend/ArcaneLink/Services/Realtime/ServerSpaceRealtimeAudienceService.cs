using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Realtime
{
    public sealed class ServerSpaceRealtimeAudienceService
    {
        private static readonly ServerSpaceRealtimeAudienceCache FallbackCache = new();
        private readonly AppDbContext _db;
        private readonly ISpaceAuthorizationService _authorization;
        private readonly ServerSpaceRealtimeAudienceCache _cache;

        public ServerSpaceRealtimeAudienceService(
            AppDbContext db,
            ISpaceAuthorizationService authorization)
            : this(db, authorization, FallbackCache)
        {
        }

        public ServerSpaceRealtimeAudienceService(
            AppDbContext db,
            ISpaceAuthorizationService authorization,
            ServerSpaceRealtimeAudienceCache cache)
        {
            _db = db;
            _authorization = authorization;
            _cache = cache;
        }

        public async Task<IReadOnlyList<Guid>> GetAuthorizedUserIdsAsync(
            Guid serverId,
            Guid spaceId,
            SpaceAction action,
            CancellationToken cancellationToken = default)
        {
            var serverState = await _db.Servers
                .AsNoTracking()
                .Where(server =>
                    server.Id == serverId &&
                    server.DeletedAt == null)
                .Select(server => new { server.SpaceAclRevision })
                .FirstOrDefaultAsync(cancellationToken);
            if (serverState == null)
            {
                return [];
            }

            var activeMemberUserIds = _db.ServerMembers
                .AsNoTracking()
                .Where(member =>
                    member.ServerId == serverId &&
                    member.StatusId == ServerMemberStatusIds.Active &&
                    member.Server.DeletedAt == null &&
                    member.User.DeletedAt == null &&
                    member.User.StatusId == UserStatusIds.Active)
                .Select(member => member.UserId);
            var activeOwnerUserIds = _db.Servers
                .AsNoTracking()
                .Where(server =>
                    server.Id == serverId &&
                    server.DeletedAt == null &&
                    server.OwnerUser.DeletedAt == null &&
                    server.OwnerUser.StatusId == UserStatusIds.Active)
                .Select(server => server.OwnerUserId);
            var candidates = await activeMemberUserIds
                .Union(activeOwnerUserIds)
                .ToListAsync(cancellationToken);
            if (_cache.TryGet(
                    serverId,
                    spaceId,
                    action,
                    serverState.SpaceAclRevision,
                    out var cached))
            {
                var activeCandidates = candidates.ToHashSet();
                return cached
                    .Where(activeCandidates.Contains)
                    .ToList();
            }

            var authorized = await _authorization.FilterAuthorizedUserIdsAsync(
                serverId,
                spaceId,
                candidates,
                action,
                cancellationToken);
            _cache.Set(
                serverId,
                spaceId,
                action,
                serverState.SpaceAclRevision,
                authorized);
            return authorized;
        }
    }
}
