using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Spaces
{
    public class SpaceCommandService : ISpaceCommandService
    {
        private readonly AppDbContext _db;
        private readonly IServerGovernanceAccessService _access;
        private readonly ISpaceAuthorizationService _authorization;
        private readonly ISpaceQueryService _queries;
        private readonly SpaceValidationService _validation;
        private readonly SpaceRealtimeNotifier _notifier;

        public SpaceCommandService(
            AppDbContext db,
            IServerGovernanceAccessService access,
            ISpaceAuthorizationService authorization,
            ISpaceQueryService queries,
            SpaceValidationService validation,
            SpaceRealtimeNotifier notifier)
        {
            _db = db;
            _access = access;
            _authorization = authorization;
            _queries = queries;
            _validation = validation;
            _notifier = notifier;
        }

        public async Task<SpaceResponse?> CreateSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            CreateSpaceRequest request,
            CancellationToken cancellationToken = default)
        {
            var type = await _db.SpaceTypes.FirstOrDefaultAsync(
                x => x.Code == SpaceTextNormalizer.NormalizeCode(request.TypeCode),
                cancellationToken);
            if (type == null)
            {
                return null;
            }

            var isPrivatePlacement = await IsPrivatePlacementAsync(
                serverId,
                request.ParentSpaceId,
                request.RequiredServerRoleId,
                cancellationToken);
            var permissionCode = GetCreatePermissionCode(
                type.Id,
                isPrivatePlacement);
            if (permissionCode == null)
            {
                return null;
            }

            var canCreate = request.ParentSpaceId.HasValue
                ? await _authorization.IsAllowedAsync(
                    currentUserId,
                    serverId,
                    request.ParentSpaceId.Value,
                    new SpaceAuthorizationRequirement(permissionCode),
                    cancellationToken)
                : await _access.HasGranularPermissionAsync(
                    currentUserId,
                    serverId,
                    permissionCode,
                    cancellationToken);
            if (!canCreate)
            {
                return null;
            }

            if (!await _validation.IsValidHierarchyAsync(serverId, type.Id, request.ParentSpaceId, cancellationToken) ||
                !await _validation.IsValidRequiredRoleAsync(serverId, request.RequiredServerRoleId, cancellationToken))
            {
                return null;
            }

            var now = DateTime.UtcNow;
            var protectionRoleId = await SpaceProtectionRoleResolver.ResolveAsync(
                _db,
                currentUserId,
                serverId,
                cancellationToken);
            var space = new Space
            {
                Id = Guid.NewGuid(),
                ServerId = serverId,
                TypeId = type.Id,
                ParentSpaceId = request.ParentSpaceId,
                CreatedByUserId = currentUserId,
                Title = SpaceTextNormalizer.NormalizeTitle(request.Title),
                Description = SpaceTextNormalizer.NormalizeOptional(request.Description),
                RequiredServerRoleId = request.RequiredServerRoleId,
                CreatedWithRoleId = protectionRoleId,
                ProtectionRoleId = protectionRoleId,
                Position = request.Position,
                IsSystem = false,
                CreatedAt = now,
                UpdatedAt = now
            };

            _db.Spaces.Add(space);
            if (space.TypeId == SpaceIds.TypeVoiceRoom)
            {
                _db.Spaces.Add(new Space
                {
                    Id = Guid.NewGuid(),
                    ServerId = serverId,
                    TypeId = SpaceIds.TypeTextRoom,
                    ParentVoiceSpaceId = space.Id,
                    CreatedByUserId = currentUserId,
                    Title = space.Title,
                    Description = space.Description,
                    CreatedWithRoleId = protectionRoleId,
                    ProtectionRoleId = protectionRoleId,
                    Position = 0,
                    IsSystem = true,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
            _access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditSpaceCreated,
                currentUserId,
                relatedSpaceId: space.Id);
            await _db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            _authorization.InvalidateServer(serverId);
            await _notifier.NotifySpacesChangedAsync(serverId, space.Id, cancellationToken);

            return await _queries.GetSpaceAsync(
                currentUserId,
                serverId,
                space.Id,
                cancellationToken);
        }

        public async Task<SpaceResponse?> UpdateSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            UpdateSpaceRequest request,
            CancellationToken cancellationToken = default)
        {
            var space = await _db.Spaces
                .Include(x => x.VoiceChatSpace)
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

            var changesSettings =
                request.Title != null ||
                request.Description != null ||
                request.ClearDescription;
            var changesAccess =
                request.RequiredServerRoleId.HasValue ||
                request.ClearRequiredServerRole;
            var changesOrder =
                request.ParentSpaceId.HasValue ||
                request.ClearParentSpace ||
                request.Position.HasValue;
            if (!changesSettings && !changesAccess && !changesOrder)
            {
                return null;
            }

            if ((changesSettings &&
                 !await _authorization.IsAllowedAsync(
                     currentUserId,
                     serverId,
                     spaceId,
                     new SpaceAuthorizationRequirement(
                         "MANAGE_SPACE_SETTINGS"),
                     cancellationToken)) ||
                (changesAccess &&
                 !await _authorization.IsAllowedAsync(
                     currentUserId,
                     serverId,
                     spaceId,
                     new SpaceAuthorizationRequirement(
                         "MANAGE_SPACE_ACCESS"),
                     cancellationToken)) ||
                (changesOrder &&
                 !await _authorization.IsAllowedAsync(
                     currentUserId,
                     serverId,
                     spaceId,
                     new SpaceAuthorizationRequirement(
                         "REORDER_SPACES_AND_CATEGORIES"),
                     cancellationToken)))
            {
                return null;
            }

            if (changesOrder && request.ParentSpaceId.HasValue &&
                !await _authorization.IsAllowedAsync(
                    currentUserId,
                    serverId,
                    request.ParentSpaceId.Value,
                    new SpaceAuthorizationRequirement(
                        "REORDER_SPACES_AND_CATEGORIES"),
                    cancellationToken))
            {
                return null;
            }

            if (changesOrder && request.ClearParentSpace &&
                !await _access.HasGranularPermissionAsync(
                    currentUserId,
                    serverId,
                    "REORDER_SPACES_AND_CATEGORIES",
                    cancellationToken))
            {
                return null;
            }

            if ((request.ParentSpaceId.HasValue && request.ParentSpaceId.Value == spaceId) ||
                !await _validation.IsValidHierarchyAsync(
                    serverId,
                    space.TypeId,
                    request.ParentSpaceId,
                    cancellationToken,
                    spaceId) ||
                !await _validation.IsValidRequiredRoleAsync(serverId, request.RequiredServerRoleId, cancellationToken))
            {
                return null;
            }

            space.ProtectionRoleId ??=
                await SpaceProtectionRoleResolver.ResolveAsync(
                    _db,
                    currentUserId,
                    serverId,
                    cancellationToken);

            if (request.Title != null)
            {
                space.Title = SpaceTextNormalizer.NormalizeTitle(request.Title);
            }

            if (request.Description != null || request.ClearDescription)
            {
                space.Description = SpaceTextNormalizer.NormalizeOptional(request.Description);
            }

            if (request.ParentSpaceId.HasValue || request.ClearParentSpace)
            {
                space.ParentSpaceId = request.ParentSpaceId;
            }

            if (request.RequiredServerRoleId.HasValue || request.ClearRequiredServerRole)
            {
                space.RequiredServerRoleId = request.RequiredServerRoleId;
            }

            if (request.Position.HasValue)
            {
                space.Position = request.Position.Value;
            }

            space.Version = Guid.NewGuid();

            var updatedAt = DateTime.UtcNow;
            space.UpdatedAt = updatedAt;
            if (space.TypeId == SpaceIds.TypeVoiceRoom &&
                space.VoiceChatSpace is { DeletedAt: null } voiceChatSpace)
            {
                voiceChatSpace.Title = space.Title;
                voiceChatSpace.Description = space.Description;
                voiceChatSpace.UpdatedAt = updatedAt;
                voiceChatSpace.Version = Guid.NewGuid();
            }
            _access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditSpaceUpdated,
                currentUserId,
                relatedSpaceId: space.Id);
            await _db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            _authorization.InvalidateServer(serverId);
            await _notifier.NotifySpacesChangedAsync(serverId, space.Id, cancellationToken);

            return await _queries.GetSpaceAsync(
                currentUserId,
                serverId,
                space.Id,
                cancellationToken);
        }

        public async Task<bool> DeleteSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            DeleteSpaceRequest request,
            CancellationToken cancellationToken = default)
        {
            var spaces = await _db.Spaces
                .Where(x => x.ServerId == serverId && x.DeletedAt == null)
                .ToListAsync(cancellationToken);
            var root = spaces.FirstOrDefault(x =>
                x.Id == spaceId &&
                x.ParentVoiceSpaceId == null);

            if (root == null)
            {
                return false;
            }

            var deletedAt = DateTime.UtcNow;
            var shouldPromoteChildren =
                root.TypeId == SpaceIds.TypeCategory &&
                IsPromoteChildrenAction(request.CategoryChildrenAction);
            IReadOnlyList<Space> visibleDeletedSpaces = shouldPromoteChildren
                ? new[] { root }
                : SpaceTreeUtility.CollectSpaceTree(spaces, root.Id);
            foreach (var deletedSpace in visibleDeletedSpaces)
            {
                var permissionCode = GetDeletePermissionCode(
                    deletedSpace.TypeId);
                if (permissionCode == null ||
                    !await _authorization.IsAllowedAsync(
                        currentUserId,
                        serverId,
                        deletedSpace.Id,
                        new SpaceAuthorizationRequirement(permissionCode),
                        cancellationToken))
                {
                    return false;
                }
            }

            if (shouldPromoteChildren)
            {
                var promotedChildren = spaces
                    .Where(space =>
                        space.ParentVoiceSpaceId == null &&
                        space.ParentSpaceId == root.Id)
                    .ToList();
                foreach (var child in promotedChildren)
                {
                    if (!await _authorization.IsAllowedAsync(
                            currentUserId,
                            serverId,
                            child.Id,
                            new SpaceAuthorizationRequirement(
                                "REORDER_SPACES_AND_CATEGORIES"),
                            cancellationToken))
                    {
                        return false;
                    }
                }

                var canUseDestination = root.ParentSpaceId.HasValue
                    ? await _authorization.IsAllowedAsync(
                        currentUserId,
                        serverId,
                        root.ParentSpaceId.Value,
                        new SpaceAuthorizationRequirement(
                            "REORDER_SPACES_AND_CATEGORIES"),
                        cancellationToken)
                    : await _access.HasGranularPermissionAsync(
                        currentUserId,
                        serverId,
                        "REORDER_SPACES_AND_CATEGORIES",
                        cancellationToken);
                if (!canUseDestination)
                {
                    return false;
                }
            }

            if (shouldPromoteChildren)
            {
                PromoteCategoryChildren(spaces, root, deletedAt);
            }

            var deletedVoiceSpaceIds = visibleDeletedSpaces
                .Where(space => space.TypeId == SpaceIds.TypeVoiceRoom)
                .Select(space => space.Id)
                .ToHashSet();
            var deletedSpaces = visibleDeletedSpaces
                .Concat(spaces.Where(space =>
                    space.ParentVoiceSpaceId.HasValue &&
                    deletedVoiceSpaceIds.Contains(
                        space.ParentVoiceSpaceId.Value)))
                .DistinctBy(space => space.Id)
                .ToList();
            foreach (var space in deletedSpaces)
            {
                space.DeletedAt = deletedAt;
                space.UpdatedAt = deletedAt;
                space.Version = Guid.NewGuid();
            }

            var deletedSpaceIds = deletedSpaces.Select(x => x.Id).ToHashSet();
            var serversWithDeletedDefault = await _db.Servers
                .Where(x => x.Id == serverId &&
                            x.DefaultTextSpaceId != null &&
                            deletedSpaceIds.Contains(x.DefaultTextSpaceId.Value))
                .ToListAsync(cancellationToken);

            foreach (var server in serversWithDeletedDefault)
            {
                server.DefaultTextSpaceId = null;
                server.UpdatedAt = deletedAt;
            }

            _access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditSpaceDeleted,
                currentUserId,
                relatedSpaceId: root.Id);
            await _db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            _authorization.InvalidateServer(serverId);
            await _notifier.NotifySpacesChangedAsync(serverId, root.Id, cancellationToken);

            return true;
        }

        private async Task<bool> IsPrivatePlacementAsync(
            Guid serverId,
            Guid? parentSpaceId,
            Guid? requiredRoleId,
            CancellationToken cancellationToken)
        {
            if (requiredRoleId.HasValue)
            {
                return true;
            }

            if (!parentSpaceId.HasValue)
            {
                return false;
            }

            var nodes = await _db.Spaces
                .AsNoTracking()
                .Where(space =>
                    space.ServerId == serverId &&
                    space.ParentVoiceSpaceId == null &&
                    space.DeletedAt == null)
                .Select(space => new SpacePlacementNode(
                    space.Id,
                    space.ParentSpaceId,
                    space.RequiredServerRoleId))
                .ToListAsync(cancellationToken);
            var nodesById = nodes.ToDictionary(node => node.Id);
            var visited = new HashSet<Guid>();
            var currentId = parentSpaceId;
            while (currentId.HasValue)
            {
                if (!visited.Add(currentId.Value) ||
                    !nodesById.TryGetValue(currentId.Value, out var node))
                {
                    // Invalid ancestry is rejected by hierarchy validation. Treat
                    // it as private here so authorization never widens access.
                    return true;
                }

                if (node.RequiredRoleId.HasValue)
                {
                    return true;
                }

                currentId = node.ParentSpaceId;
            }

            return false;
        }

        private static string? GetCreatePermissionCode(
            Guid typeId,
            bool isPrivate)
        {
            if (typeId == SpaceIds.TypeCategory)
            {
                return isPrivate
                    ? "CREATE_PRIVATE_CATEGORIES"
                    : "CREATE_PUBLIC_CATEGORIES";
            }

            if (typeId == SpaceIds.TypeTextRoom)
            {
                return isPrivate
                    ? "CREATE_PRIVATE_TEXT_SPACES"
                    : "CREATE_PUBLIC_TEXT_SPACES";
            }

            if (typeId == SpaceIds.TypeVoiceRoom)
            {
                return isPrivate
                    ? "CREATE_PRIVATE_VOICE_SPACES"
                    : "CREATE_PUBLIC_VOICE_SPACES";
            }

            return null;
        }

        private static string? GetDeletePermissionCode(Guid typeId)
        {
            if (typeId == SpaceIds.TypeCategory)
            {
                return "DELETE_CATEGORIES";
            }

            if (typeId == SpaceIds.TypeTextRoom)
            {
                return "DELETE_TEXT_SPACES";
            }

            return typeId == SpaceIds.TypeVoiceRoom
                ? "DELETE_VOICE_SPACES"
                : null;
        }

        private static bool IsPromoteChildrenAction(string? action)
        {
            return string.Equals(
                action?.Trim(),
                "promote",
                StringComparison.OrdinalIgnoreCase);
        }

        private static void PromoteCategoryChildren(
            IReadOnlyList<Space> spaces,
            Space category,
            DateTime updatedAt)
        {
            var siblings = spaces
                .Where(x => x.Id != category.Id &&
                            x.ParentSpaceId == category.ParentSpaceId)
                .ToList();
            var nextPosition = siblings.Count == 0
                ? category.Position
                : siblings.Max(x => x.Position) + 1;

            foreach (var child in spaces
                .Where(x => x.ParentSpaceId == category.Id)
                .OrderBy(x => x.Position)
                .ThenBy(x => x.Title))
            {
                child.ParentSpaceId = category.ParentSpaceId;
                child.Position = nextPosition++;
                child.UpdatedAt = updatedAt;
                child.Version = Guid.NewGuid();
            }
        }

        private sealed record SpacePlacementNode(
            Guid Id,
            Guid? ParentSpaceId,
            Guid? RequiredRoleId);
    }
}
