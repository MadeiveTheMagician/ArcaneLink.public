using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Spaces
{
    public class SpaceReorderService : ISpaceReorderService
    {
        private readonly AppDbContext _db;
        private readonly IServerGovernanceAccessService _access;
        private readonly ISpaceAuthorizationService _authorization;
        private readonly SpaceRealtimeNotifier _notifier;

        public SpaceReorderService(
            AppDbContext db,
            IServerGovernanceAccessService access,
            ISpaceAuthorizationService authorization,
            SpaceRealtimeNotifier notifier)
        {
            this._db = db;
            this._access = access;
            this._authorization = authorization;
            this._notifier = notifier;
        }

        public async Task<bool> ReorderSpacesAsync(
            Guid currentUserId,
            Guid serverId,
            ReorderSpacesRequest request,
            CancellationToken cancellationToken = default)
        {
            if (request.Spaces.Count == 0)
            {
                return false;
            }

            var requestedIds = request.Spaces.Select(x => x.SpaceId).Distinct().ToList();
            if (requestedIds.Count != request.Spaces.Count)
            {
                return false;
            }

            var spaces = await this._db.Spaces
                .Where(x => x.ServerId == serverId &&
                            x.ParentVoiceSpaceId == null &&
                            x.DeletedAt == null &&
                            requestedIds.Contains(x.Id))
                .ToListAsync(cancellationToken);

            if (spaces.Count != requestedIds.Count)
            {
                return false;
            }

            var allSpaces = await this._db.Spaces
                .AsNoTracking()
                .Where(x =>
                    x.ServerId == serverId &&
                    x.ParentVoiceSpaceId == null &&
                    x.DeletedAt == null)
                .ToListAsync(cancellationToken);
            var now = DateTime.UtcNow;

            var affectedSourceIds = new HashSet<Guid>();
            foreach (var item in request.Spaces)
            {
                var root = allSpaces.First(space => space.Id == item.SpaceId);
                var affectedSpaces = root.TypeId == SpaceIds.TypeCategory
                    ? SpaceTreeUtility.CollectSpaceTree(allSpaces, root.Id)
                    : new[] { root };
                affectedSourceIds.UnionWith(
                    affectedSpaces.Select(space => space.Id));
            }

            foreach (var affectedSourceId in affectedSourceIds)
            {
                if (!await this._authorization.IsAllowedAsync(
                        currentUserId,
                        serverId,
                        affectedSourceId,
                        new SpaceAuthorizationRequirement(
                            "REORDER_SPACES_AND_CATEGORIES"),
                        cancellationToken))
                {
                    return false;
                }
            }

            var requestedDestinationIds = request.Spaces
                .Where(item => item.ParentSpaceId.HasValue)
                .Select(item => item.ParentSpaceId!.Value)
                .Distinct()
                .ToList();
            var destinationIds = new HashSet<Guid>();
            foreach (var requestedDestinationId in requestedDestinationIds)
            {
                Guid? currentId = requestedDestinationId;
                var visited = new HashSet<Guid>();
                while (currentId.HasValue)
                {
                    if (!visited.Add(currentId.Value))
                    {
                        return false;
                    }

                    var current = allSpaces.FirstOrDefault(space =>
                        space.Id == currentId.Value);
                    if (current == null)
                    {
                        return false;
                    }

                    destinationIds.Add(current.Id);
                    currentId = current.ParentSpaceId;
                }
            }

            foreach (var destinationId in destinationIds)
            {
                if (!await this._authorization.IsAllowedAsync(
                        currentUserId,
                        serverId,
                        destinationId,
                        new SpaceAuthorizationRequirement(
                            "REORDER_SPACES_AND_CATEGORIES"),
                        cancellationToken))
                {
                    return false;
                }
            }

            if (request.Spaces.Any(item => !item.ParentSpaceId.HasValue) &&
                !await this._access.HasGranularPermissionAsync(
                    currentUserId,
                    serverId,
                    "REORDER_SPACES_AND_CATEGORIES",
                    cancellationToken))
            {
                return false;
            }

            foreach (var item in request.Spaces)
            {
                var candidate = allSpaces.First(x => x.Id == item.SpaceId);
                candidate.ParentSpaceId = item.ParentSpaceId;
                candidate.Position = item.Position;
            }

            foreach (var item in request.Spaces)
            {
                var candidate = allSpaces.First(x => x.Id == item.SpaceId);
                if (item.ParentSpaceId == item.SpaceId ||
                    !SpaceTreeUtility.IsValidHierarchy(
                        candidate,
                        item.ParentSpaceId,
                        allSpaces))
                {
                    return false;
                }

                var space = spaces.First(x => x.Id == item.SpaceId);
                space.ParentSpaceId = item.ParentSpaceId;
                space.Position = item.Position;
                space.UpdatedAt = now;
                space.Version = Guid.NewGuid();
            }

            this._access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditSpacesReordered,
                currentUserId);
            await this._db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await this._db.SaveChangesAsync(cancellationToken);
            this._authorization.InvalidateServer(serverId);
            await this._notifier.NotifySpacesChangedAsync(serverId, null, cancellationToken);

            return true;
        }
    }
}
