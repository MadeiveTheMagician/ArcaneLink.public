using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Spaces
{
    public class SpaceQueryService : ISpaceQueryService
    {
        private readonly AppDbContext _db;
        private readonly ISpaceAuthorizationService _authorization;
        private readonly UnreadCountService _unreadCounts;

        public SpaceQueryService(
            AppDbContext db,
            ISpaceAuthorizationService authorization,
            UnreadCountService unreadCounts)
        {
            _db = db;
            _authorization = authorization;
            _unreadCounts = unreadCounts;
        }

        public async Task<IReadOnlyList<SpaceTypeResponse>> GetSpaceTypesAsync(
            CancellationToken cancellationToken = default)
        {
            return await _db.SpaceTypes
                .AsNoTracking()
                .OrderBy(x => x.Code)
                .Select(x => new SpaceTypeResponse
                {
                    Id = x.Id,
                    Code = x.Code,
                    Title = x.Title,
                    Description = x.Description
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<IReadOnlyList<SpaceResponse>?> GetServerSpacesAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            var snapshot = await _authorization.GetSnapshotAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (snapshot == null)
            {
                return null;
            }

            var spaces = await LoadServerSpacesQuery(serverId)
                .AsNoTracking()
                .OrderBy(x => x.ParentSpaceId == null ? 0 : 1)
                .ThenBy(x => x.Position)
                .ThenBy(x => x.Title)
                .ToListAsync(cancellationToken);

            var capabilitiesBySpaceId = new Dictionary<
                Guid,
                SpaceAccessCapabilities>();
            foreach (var space in spaces)
            {
                var capabilities =
                    await _authorization.GetGranularCapabilitiesAsync(
                        currentUserId,
                        serverId,
                        space.Id,
                        cancellationToken);
                if (capabilities?.CanView == true)
                {
                    capabilitiesBySpaceId[space.Id] = capabilities;
                }
            }

            var spacesById = spaces.ToDictionary(space => space.Id);
            var hierarchyVisibility = new Dictionary<Guid, bool>();
            bool IsVisibleInHierarchy(Guid spaceId, ISet<Guid> visiting)
            {
                if (hierarchyVisibility.TryGetValue(spaceId, out var cached))
                {
                    return cached;
                }

                if (!visiting.Add(spaceId) ||
                    !spacesById.TryGetValue(spaceId, out var space) ||
                    !capabilitiesBySpaceId.ContainsKey(spaceId))
                {
                    hierarchyVisibility[spaceId] = false;
                    return false;
                }

                var visible = !space.ParentSpaceId.HasValue ||
                              IsVisibleInHierarchy(
                                  space.ParentSpaceId.Value,
                                  visiting);
                visiting.Remove(spaceId);
                hierarchyVisibility[spaceId] = visible;
                return visible;
            }

            var visibleSpaces = spaces
                .Where(space => IsVisibleInHierarchy(
                    space.Id,
                    new HashSet<Guid>()))
                .ToList();
            var unreadCounts = await _unreadCounts.GetServerSpaceUnreadCountsAsync(
                currentUserId,
                serverId,
                visibleSpaces
                    .Where(space =>
                        space.TypeId == SpaceIds.TypeTextRoom ||
                        space.TypeId == SpaceIds.TypeVoiceRoom)
                    .Select(space => space.Id),
                cancellationToken);

            return visibleSpaces
                .Select(space => SpaceMapper.ToSpaceResponse(
                    space,
                    capabilitiesBySpaceId[space.Id],
                    unreadCounts.GetValueOrDefault(space.Id)))
                .ToList();
        }

        public async Task<SpaceResponse?> GetSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            var space = await _db.Spaces
                .AsNoTracking()
                .Include(x => x.Type)
                .Include(x => x.VoiceChatSpace)
                .Include(x => x.PermissionOverrides)
                    .ThenInclude(x => x.Permission)
                .FirstOrDefaultAsync(
                    x => x.Id == spaceId &&
                         x.ServerId == serverId &&
                         x.ParentVoiceSpaceId == null &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (space == null)
            {
                return null;
            }

            var capabilities =
                await _authorization.GetGranularCapabilitiesAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken);
            if (capabilities?.CanView != true ||
                !await HasVisibleAncestorPathAsync(
                    currentUserId,
                    serverId,
                    space.ParentSpaceId,
                    cancellationToken))
            {
                return null;
            }

            var unreadCounts =
                space.TypeId == SpaceIds.TypeTextRoom ||
                space.TypeId == SpaceIds.TypeVoiceRoom
                ? await _unreadCounts.GetServerSpaceUnreadCountsAsync(
                    currentUserId,
                    serverId,
                    [space.Id],
                    cancellationToken)
                : [];
            return SpaceMapper.ToSpaceResponse(
                space,
                capabilities,
                unreadCounts.GetValueOrDefault(space.Id));
        }

        private async Task<bool> HasVisibleAncestorPathAsync(
            Guid currentUserId,
            Guid serverId,
            Guid? parentSpaceId,
            CancellationToken cancellationToken)
        {
            var visited = new HashSet<Guid>();
            var currentId = parentSpaceId;
            while (currentId.HasValue)
            {
                if (!visited.Add(currentId.Value))
                {
                    return false;
                }

                var parent = await _db.Spaces
                    .AsNoTracking()
                    .Where(space =>
                        space.Id == currentId.Value &&
                        space.ServerId == serverId &&
                        space.ParentVoiceSpaceId == null &&
                        space.DeletedAt == null)
                    .Select(space => new
                    {
                        space.Id,
                        space.ParentSpaceId
                    })
                    .SingleOrDefaultAsync(cancellationToken);
                if (parent == null)
                {
                    return false;
                }

                var capabilities =
                    await _authorization.GetGranularCapabilitiesAsync(
                        currentUserId,
                        serverId,
                        parent.Id,
                        cancellationToken);
                if (capabilities?.CanView != true)
                {
                    return false;
                }

                currentId = parent.ParentSpaceId;
            }

            return true;
        }

        private IQueryable<Space> LoadServerSpacesQuery(Guid serverId)
        {
            return _db.Spaces
                .Include(x => x.Type)
                .Include(x => x.VoiceChatSpace)
                .Include(x => x.PermissionOverrides)
                    .ThenInclude(x => x.Permission)
                .Where(x =>
                    x.ServerId == serverId &&
                    x.ParentVoiceSpaceId == null &&
                    x.DeletedAt == null);
        }
    }
}
