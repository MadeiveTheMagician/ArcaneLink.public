using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Servers.Authorization.Abstractions;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Spaces
{
    public class SpaceAuthorizationService : ISpaceAuthorizationService
    {
        private readonly AppDbContext _db;
        private readonly IServerAuthorizationRuntime? _serverAuthorization;
        private readonly LegacySpacePermissionMaskAdapter _legacySpaceAdapter;
        private readonly LegacyServerPermissionMaskAdapter _legacyServerAdapter;
        private readonly Dictionary<(Guid ServerId, Guid Revision), SpaceGraph> _graphs = [];

        public SpaceAuthorizationService(
            AppDbContext db,
            IServerAuthorizationRuntime? serverAuthorization = null,
            LegacySpacePermissionMaskAdapter? legacySpaceAdapter = null,
            LegacyServerPermissionMaskAdapter? legacyServerAdapter = null)
        {
            _db = db;
            _serverAuthorization = serverAuthorization;
            _legacySpaceAdapter = legacySpaceAdapter ??
                new LegacySpacePermissionMaskAdapter();
            _legacyServerAdapter = legacyServerAdapter ??
                new LegacyServerPermissionMaskAdapter();
        }

        public async Task<SpaceAuthorizationSnapshot?> GetSnapshotAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            var graph = await GetGraphAsync(serverId, cancellationToken);
            if (graph == null)
            {
                return null;
            }

            var principal = await LoadPrincipalAsync(
                graph,
                userId,
                cancellationToken);
            return principal == null
                ? null
                : SpaceAccessEvaluator.Evaluate(principal, graph.Spaces);
        }

        public async Task<SpaceAccessCapabilities?> GetCapabilitiesAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            var authorizationSpaceId = await ResolveAuthorizationSpaceIdAsync(
                serverId,
                spaceId,
                cancellationToken);
            if (!authorizationSpaceId.HasValue)
            {
                return null;
            }

            var snapshot = await GetSnapshotAsync(userId, serverId, cancellationToken);
            return snapshot?.GetCapabilities(authorizationSpaceId.Value);
        }

        public async Task<bool> IsAllowedAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            SpaceAuthorizationRequirement requirement,
            CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(requirement);

            if (_serverAuthorization == null ||
                !_legacySpaceAdapter.TryGetLegacyGate(
                    requirement.PermissionCode,
                    out var legacyGate))
            {
                return false;
            }

            var authorizationSpaceId = await ResolveAuthorizationSpaceIdAsync(
                serverId,
                spaceId,
                cancellationToken);
            if (!authorizationSpaceId.HasValue)
            {
                return false;
            }

            // Keep the established private-space and hierarchy semantics as a
            // mandatory compatibility gate while granular ACL masks are still
            // represented by the four legacy space permissions.
            var snapshot = await GetSnapshotAsync(
                userId,
                serverId,
                cancellationToken);
            if (snapshot?.Can(authorizationSpaceId.Value, legacyGate) != true)
            {
                return false;
            }

            var graph = await GetGraphAsync(serverId, cancellationToken);
            if (graph == null ||
                !TryCreatePermissionResource(
                    graph,
                    authorizationSpaceId.Value,
                    out var permissionResource,
                    out var space))
            {
                return false;
            }

            var context = await _serverAuthorization.GetContextAsync(
                userId,
                serverId,
                cancellationToken);
            if (context == null)
            {
                return false;
            }

            ServerAuthorizationTarget? target = null;
            if (RequiresResourceHierarchy(requirement.PermissionCode))
            {
                var protection = requirement.Protection ??
                    new SpaceAuthorizationProtection(
                        space.ProtectionRoleId,
                        space.CreatedByUserId);
                if (!TryCreateProtectionTarget(
                        graph,
                        protection,
                        legacyNullIsOwnerProtected:
                            requirement.Protection != null,
                        out target))
                {
                    return false;
                }
            }

            return ServerAuthorizationEvaluator.IsAllowed(
                context.Principal,
                new ServerAuthorizationRequest(
                    serverId,
                    requirement.PermissionCode,
                    requirement.OwnerOnly,
                    requirement.DependencyCodes ?? [],
                    permissionResource,
                    target));
        }

        public async Task<SpaceAccessCapabilities?> GetGranularCapabilitiesAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            if (_serverAuthorization == null)
            {
                return null;
            }

            var authorizationSpaceId = await ResolveAuthorizationSpaceIdAsync(
                serverId,
                spaceId,
                cancellationToken);
            if (!authorizationSpaceId.HasValue)
            {
                return null;
            }

            var snapshot = await GetSnapshotAsync(
                userId,
                serverId,
                cancellationToken);
            var graph = await GetGraphAsync(serverId, cancellationToken);
            if (snapshot == null ||
                graph == null ||
                !TryCreatePermissionResource(
                    graph,
                    authorizationSpaceId.Value,
                    out var permissionResource,
                    out var space))
            {
                return null;
            }

            var context = await _serverAuthorization.GetContextAsync(
                userId,
                serverId,
                cancellationToken);
            if (context == null)
            {
                return null;
            }

            var hasValidProtectionTarget = TryCreateProtectionTarget(
                graph,
                new SpaceAuthorizationProtection(
                    space.ProtectionRoleId,
                    space.CreatedByUserId),
                legacyNullIsOwnerProtected: false,
                out var protectionTarget);

            bool IsAllowed(
                string permissionCode,
                IReadOnlyList<string>? dependencyCodes = null)
            {
                var requiresResourceHierarchy =
                    RequiresResourceHierarchy(permissionCode);
                return (!requiresResourceHierarchy ||
                        hasValidProtectionTarget) &&
                       _legacySpaceAdapter.TryGetLegacyGate(
                           permissionCode,
                           out var legacyGate) &&
                       snapshot.Can(authorizationSpaceId.Value, legacyGate) &&
                       ServerAuthorizationEvaluator.IsAllowed(
                           context.Principal,
                           new ServerAuthorizationRequest(
                               serverId,
                               permissionCode,
                               OwnerOnly: false,
                               dependencyCodes ?? [],
                               permissionResource,
                               requiresResourceHierarchy
                                   ? protectionTarget
                                   : null));
            }

            // Categories are navigation containers rather than a third readable
            // content type. They are visible when either text or voice visibility
            // is effective at that category scope; descendants are filtered
            // separately and cannot become visible through a hidden category.
            var viewPermissionCode = space.TypeId == SpaceIds.TypeVoiceRoom
                ? "VIEW_VOICE_SPACES"
                : "VIEW_TEXT_SPACES";
            var canView = space.TypeId == SpaceIds.TypeCategory
                ? IsAllowed("VIEW_TEXT_SPACES") ||
                  IsAllowed("VIEW_VOICE_SPACES")
                : IsAllowed(viewPermissionCode);
            if (!canView)
            {
                return new SpaceAccessCapabilities(
                    false,
                    false,
                    false,
                    false,
                    false);
            }

            var canSend = space.TypeId switch
            {
                var typeId when typeId == SpaceIds.TypeTextRoom =>
                    IsAllowed(
                        "SEND_MESSAGES",
                        ["VIEW_TEXT_SPACES"]),
                var typeId when typeId == SpaceIds.TypeVoiceRoom =>
                    IsAllowed(
                        "SEND_MESSAGES_IN_VOICE_CHAT",
                        ["VIEW_VOICE_SPACES"]),
                _ => false
            };
            var canConnect =
                space.TypeId == SpaceIds.TypeVoiceRoom &&
                IsAllowed(
                    "CONNECT_VOICE",
                    ["VIEW_VOICE_SPACES"]);

            var canManageSpaceAccess = IsAllowed("MANAGE_SPACE_ACCESS");
            var managementCodes = new List<string>
            {
                "MANAGE_SPACE_SETTINGS",
                "REORDER_SPACES_AND_CATEGORIES"
            };
            if (space.TypeId == SpaceIds.TypeCategory)
            {
                managementCodes.AddRange(
                [
                    "DELETE_CATEGORIES",
                    "CREATE_PUBLIC_CATEGORIES",
                    "CREATE_PUBLIC_TEXT_SPACES",
                    "CREATE_PUBLIC_VOICE_SPACES",
                    "CREATE_PRIVATE_CATEGORIES",
                    "CREATE_PRIVATE_TEXT_SPACES",
                    "CREATE_PRIVATE_VOICE_SPACES"
                ]);
            }
            else
            {
                managementCodes.Add(
                    space.TypeId == SpaceIds.TypeVoiceRoom
                        ? "DELETE_VOICE_SPACES"
                        : "DELETE_TEXT_SPACES");
            }

            return new SpaceAccessCapabilities(
                CanView: true,
                CanSendMessages: canSend,
                CanConnectVoice: canConnect,
                CanManage: canManageSpaceAccess ||
                           managementCodes.Any(code => IsAllowed(code)),
                CanManageSpaceAccess: canManageSpaceAccess);
        }

        public async Task<IReadOnlyList<Guid>?> GetAllowedSpaceIdsAsync(
            Guid userId,
            Guid serverId,
            SpaceAction action,
            CancellationToken cancellationToken = default)
        {
            var snapshot = await GetSnapshotAsync(userId, serverId, cancellationToken);
            if (snapshot == null)
            {
                return null;
            }

            var allowedSpaceIds = snapshot.GetAllowedSpaceIds(action).ToList();
            var companionSpaceIds = await _db.Spaces
                .AsNoTracking()
                .Where(space =>
                    space.ServerId == serverId &&
                    space.ParentVoiceSpaceId.HasValue &&
                    allowedSpaceIds.Contains(space.ParentVoiceSpaceId.Value) &&
                    space.DeletedAt == null)
                .Select(space => space.Id)
                .ToListAsync(cancellationToken);
            return allowedSpaceIds
                .Concat(companionSpaceIds)
                .Distinct()
                .ToList();
        }

        public async Task<IReadOnlyList<Guid>> FilterAuthorizedUserIdsAsync(
            Guid serverId,
            Guid spaceId,
            IEnumerable<Guid> userIds,
            SpaceAction action,
            CancellationToken cancellationToken = default)
        {
            var candidates = userIds.Distinct().ToList();
            if (candidates.Count == 0)
            {
                return [];
            }

            var authorizationSpaceId = await ResolveAuthorizationSpaceIdAsync(
                serverId,
                spaceId,
                cancellationToken);
            var graph = await GetGraphAsync(serverId, cancellationToken);
            if (graph == null ||
                !authorizationSpaceId.HasValue ||
                graph.Spaces.All(x => x.Id != authorizationSpaceId.Value))
            {
                return [];
            }
            var nodesById = graph.Spaces
                .GroupBy(node => node.Id)
                .ToDictionary(group => group.Key, group => group.First());

            var candidateMembers = await _db.ServerMembers
                .AsNoTracking()
                .Where(x =>
                    x.ServerId == serverId &&
                    x.StatusId == ServerMemberStatusIds.Active &&
                    x.BannedAt == null &&
                    x.User.DeletedAt == null &&
                    x.User.StatusId == UserStatusIds.Active &&
                    candidates.Contains(x.UserId))
                .Select(x => new { x.Id, x.UserId })
                .ToListAsync(cancellationToken);
            var memberIds = candidateMembers.Select(x => x.Id).ToList();
            var assignments = await _db.ServerMemberRoles
                .AsNoTracking()
                .Where(x =>
                    x.ServerId == serverId &&
                    memberIds.Contains(x.MemberId) &&
                    x.RevokedAt == null &&
                    x.Role.DeletedAt == null)
                .Select(x => new
                {
                    x.MemberId,
                    x.RoleId,
                    HasManageServer = x.Role.Permissions.Any(permission =>
                        permission.PermissionId == ServerGovernanceIds.PermissionManageServer &&
                        permission.IsGranted)
                })
                .ToListAsync(cancellationToken);
            var memberByUserId = candidateMembers.ToDictionary(x => x.UserId);
            var assignmentsByMemberId = assignments
                .GroupBy(x => x.MemberId)
                .ToDictionary(group => group.Key, group => group.ToList());
            var allowed = new List<Guid>();

            foreach (var userId in candidates)
            {
                SpaceAccessPrincipal? principal;
                if (!memberByUserId.TryGetValue(userId, out var member))
                {
                    principal = null;
                }
                else if (userId == graph.OwnerUserId)
                {
                    principal = new SpaceAccessPrincipal(
                        userId,
                        member.Id,
                        IsActiveMember: true,
                        IsOwner: true,
                        HasManageServer: true,
                        RoleIds: new HashSet<Guid>());
                }
                else
                {
                    var memberAssignments = assignmentsByMemberId.GetValueOrDefault(member.Id) ?? [];
                    principal = new SpaceAccessPrincipal(
                        userId,
                        member.Id,
                        IsActiveMember: true,
                        IsOwner: false,
                        HasManageServer: memberAssignments.Any(x => x.HasManageServer),
                        RoleIds: memberAssignments.Select(x => x.RoleId).ToHashSet());
                }
                if (principal != null &&
                    Can(
                        SpaceAccessEvaluator.EvaluateTarget(
                            principal,
                            nodesById,
                            authorizationSpaceId.Value),
                        action))
                {
                    allowed.Add(userId);
                }
            }

            return allowed;
        }

        private async Task<Guid?> ResolveAuthorizationSpaceIdAsync(
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            return await _db.Spaces
                .AsNoTracking()
                .Where(space =>
                    space.Id == spaceId &&
                    space.ServerId == serverId &&
                    space.DeletedAt == null)
                .Select(space => (Guid?)(space.ParentVoiceSpaceId ?? space.Id))
                .SingleOrDefaultAsync(cancellationToken);
        }

        public void InvalidateServer(Guid serverId)
        {
            foreach (var key in _graphs.Keys
                .Where(key => key.ServerId == serverId)
                .ToList())
            {
                _graphs.Remove(key);
            }
        }

        private async Task<SpaceGraph?> GetGraphAsync(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var server = await _db.Servers
                .AsNoTracking()
                .Where(x => x.Id == serverId && x.DeletedAt == null)
                .Select(x => new
                {
                    x.Id,
                    x.OwnerUserId,
                    x.SpaceAclRevision
                })
                .FirstOrDefaultAsync(cancellationToken);
            if (server == null)
            {
                return null;
            }
            var key = (server.Id, server.SpaceAclRevision);
            if (_graphs.TryGetValue(key, out var cached))
            {
                return cached;
            }
            RemoveStaleLocalEntries(server.Id, server.SpaceAclRevision);

            var spaceEntities = await _db.Spaces
                .AsNoTracking()
                .Include(x => x.PermissionOverrides)
                .Where(x =>
                    x.ServerId == serverId &&
                    x.ParentVoiceSpaceId == null &&
                    x.DeletedAt == null)
                .ToListAsync(cancellationToken);
            var protectionRoleIds = spaceEntities
                .Select(space => space.ProtectionRoleId)
                .Concat(spaceEntities.SelectMany(space =>
                    space.PermissionOverrides.Select(permissionOverride =>
                        permissionOverride.ProtectionRoleId)))
                .Where(roleId => roleId.HasValue)
                .Select(roleId => roleId!.Value)
                .Distinct()
                .ToList();
            var protectionRoleAuthorities = new Dictionary<
                Guid,
                ServerRoleAuthority>();
            if (protectionRoleIds.Count > 0)
            {
                var protectionRoles = await _db.ServerRoles
                    .AsNoTracking()
                    .Include(role => role.Permissions)
                    .Where(role =>
                        role.ServerId == serverId &&
                        protectionRoleIds.Contains(role.Id) &&
                        role.DeletedAt == null)
                    .ToListAsync(cancellationToken);
                foreach (var role in protectionRoles)
                {
                    if (TryAdaptRole(role, out var authorizationRole) &&
                        ServerAuthorizationEvaluator.TryResolveRoleAuthority(
                            authorizationRole,
                            out var authority))
                    {
                        protectionRoleAuthorities[role.Id] = authority;
                    }
                }
            }
            var spaces = spaceEntities
                .Select(x => new SpaceAccessNode(
                    x.Id,
                    x.ParentSpaceId,
                    x.TypeId,
                    x.RequiredServerRoleId,
                    x.PermissionOverrides
                        .Select(permissionOverride => new SpaceAccessOverride(
                            permissionOverride.RoleId,
                            permissionOverride.MemberId,
                            permissionOverride.PermissionId,
                            permissionOverride.Allow,
                            permissionOverride.Deny,
                            permissionOverride.CreatedByUserId,
                            permissionOverride.ProtectionRoleId))
                        .ToList()))
                .ToList();
            var granularSpaces = spaceEntities
                .Select(x => new GranularSpaceNode(
                    x.Id,
                    x.ParentSpaceId,
                    x.TypeId,
                    x.CreatedByUserId,
                    x.ProtectionRoleId,
                    x.PermissionOverrides
                        .Select(permissionOverride => new SpaceAccessOverride(
                            permissionOverride.RoleId,
                            permissionOverride.MemberId,
                            permissionOverride.PermissionId,
                            permissionOverride.Allow,
                            permissionOverride.Deny,
                            permissionOverride.CreatedByUserId,
                            permissionOverride.ProtectionRoleId))
                        .ToList()))
                .ToList();

            var graph = new SpaceGraph(
                server.Id,
                server.OwnerUserId,
                server.SpaceAclRevision,
                spaces,
                granularSpaces,
                protectionRoleAuthorities);
            _graphs[key] = graph;
            return graph;
        }

        private void RemoveStaleLocalEntries(Guid serverId, Guid currentRevision)
        {
            foreach (var key in _graphs.Keys
                .Where(key =>
                    key.ServerId == serverId &&
                    key.Revision != currentRevision)
                .ToList())
            {
                _graphs.Remove(key);
            }
        }

        private async Task<SpaceAccessPrincipal?> LoadPrincipalAsync(
            SpaceGraph graph,
            Guid userId,
            CancellationToken cancellationToken)
        {
            var memberId = await _db.ServerMembers
                .AsNoTracking()
                .Where(x =>
                    x.ServerId == graph.ServerId &&
                    x.UserId == userId &&
                    x.StatusId == ServerMemberStatusIds.Active &&
                    x.BannedAt == null &&
                    x.User.DeletedAt == null &&
                    x.User.StatusId == UserStatusIds.Active)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (!memberId.HasValue)
            {
                return null;
            }

            if (userId == graph.OwnerUserId)
            {
                return new SpaceAccessPrincipal(
                    userId,
                    memberId.Value,
                    IsActiveMember: true,
                    IsOwner: true,
                    HasManageServer: true,
                    RoleIds: new HashSet<Guid>());
            }

            var assignments = await _db.ServerMemberRoles
                .AsNoTracking()
                .Where(x =>
                    x.ServerId == graph.ServerId &&
                    x.MemberId == memberId.Value &&
                    x.RevokedAt == null &&
                    x.Role.DeletedAt == null)
                .Select(x => new
                {
                    x.RoleId,
                    HasManageServer = x.Role.Permissions.Any(permission =>
                        permission.PermissionId == ServerGovernanceIds.PermissionManageServer &&
                        permission.IsGranted)
                })
                .ToListAsync(cancellationToken);

            return new SpaceAccessPrincipal(
                userId,
                memberId.Value,
                IsActiveMember: true,
                IsOwner: false,
                HasManageServer: assignments.Any(x => x.HasManageServer),
                RoleIds: assignments.Select(x => x.RoleId).ToHashSet());
        }

        private bool TryCreatePermissionResource(
            SpaceGraph graph,
            Guid spaceId,
            out ServerPermissionResource resource,
            out GranularSpaceNode space)
        {
            resource = null!;
            space = null!;
            var spacesById = graph.GranularSpaces
                .GroupBy(node => node.Id)
                .ToDictionary(group => group.Key, group => group.First());
            if (!spacesById.TryGetValue(spaceId, out var resolvedSpace))
            {
                return false;
            }
            space = resolvedSpace;

            var ancestors = new List<GranularSpaceNode>();
            var visited = new HashSet<Guid> { space.Id };
            var parentId = space.ParentSpaceId;
            while (parentId.HasValue)
            {
                if (!visited.Add(parentId.Value) ||
                    !spacesById.TryGetValue(parentId.Value, out var parent) ||
                    parent.TypeId != SpaceIds.TypeCategory)
                {
                    return false;
                }

                ancestors.Add(parent);
                parentId = parent.ParentSpaceId;
            }

            ancestors.Reverse();
            var categoryPath = new List<ServerPermissionScope>(ancestors.Count);
            foreach (var ancestor in ancestors)
            {
                if (!TryCreateScope(graph, ancestor, out var scope))
                {
                    return false;
                }

                categoryPath.Add(scope);
            }

            if (!TryCreateScope(graph, space, out var spaceScope))
            {
                return false;
            }

            resource = new ServerPermissionResource(
                graph.ServerId,
                Array.AsReadOnly(categoryPath.ToArray()),
                spaceScope);
            return true;
        }

        private bool TryCreateScope(
            SpaceGraph graph,
            GranularSpaceNode space,
            out ServerPermissionScope scope)
        {
            var overrides = new List<ServerPermissionOverride>(
                space.Overrides.Count);
            foreach (var legacyOverride in space.Overrides)
            {
                if (legacyOverride.Allow == legacyOverride.Deny ||
                    legacyOverride.RoleId.HasValue ==
                    legacyOverride.MemberId.HasValue ||
                    !_legacySpaceAdapter.TryCreateMask(
                        legacyOverride.PermissionId,
                        out var permissionMask))
                {
                    scope = null!;
                    return false;
                }

                var targetKind = legacyOverride.RoleId.HasValue
                    ? ServerPermissionOverrideTargetKind.Role
                    : ServerPermissionOverrideTargetKind.Member;
                var targetId = legacyOverride.RoleId ??
                               legacyOverride.MemberId!.Value;
                if (!TryResolveOverrideProtectionAuthority(
                        graph,
                        legacyOverride,
                        out var protectionAuthority))
                {
                    scope = null!;
                    return false;
                }

                overrides.Add(new ServerPermissionOverride(
                    graph.ServerId,
                    graph.ServerId,
                    targetKind,
                    targetId,
                    legacyOverride.Allow
                        ? permissionMask
                        : PermissionMask256.Empty,
                    legacyOverride.Deny
                        ? permissionMask
                        : PermissionMask256.Empty,
                    protectionAuthority));
            }

            scope = new ServerPermissionScope(
                graph.ServerId,
                space.Id,
                Array.AsReadOnly(overrides.ToArray()));
            return true;
        }

        private static bool TryCreateProtectionTarget(
            SpaceGraph graph,
            SpaceAuthorizationProtection protection,
            bool legacyNullIsOwnerProtected,
            out ServerAuthorizationTarget? target)
        {
            target = null;
            if (!protection.RoleId.HasValue)
            {
                if (legacyNullIsOwnerProtected)
                {
                    target = new ServerAuthorizationAuthorityTarget(
                        ServerRoleAuthority.Owner(graph.ServerId));
                }

                return true;
            }

            ServerRoleAuthority authority;
            if (protection.CreatedByUserId == graph.OwnerUserId)
            {
                authority = ServerRoleAuthority.Owner(graph.ServerId);
            }
            else if (!graph.ProtectionRoleAuthorities.TryGetValue(
                         protection.RoleId.Value,
                         out authority))
            {
                return false;
            }

            target = new ServerAuthorizationAuthorityTarget(authority);
            return true;
        }

        private static bool TryResolveOverrideProtectionAuthority(
            SpaceGraph graph,
            SpaceAccessOverride permissionOverride,
            out ServerRoleAuthority authority)
        {
            if (!permissionOverride.ProtectionRoleId.HasValue)
            {
                // Legacy rows have no trustworthy creation authority. Treating
                // them as owner-protected preserves their old mutual ordering
                // while preventing a new lower-authority counter-override.
                authority = ServerRoleAuthority.Owner(graph.ServerId);
                return true;
            }

            if (permissionOverride.CreatedByUserId == graph.OwnerUserId)
            {
                authority = ServerRoleAuthority.Owner(graph.ServerId);
                return true;
            }

            return graph.ProtectionRoleAuthorities.TryGetValue(
                permissionOverride.ProtectionRoleId.Value,
                out authority);
        }

        private bool TryAdaptRole(
            ServerRole role,
            out ServerAuthorizationRole authorizationRole)
        {
            authorizationRole = null!;
            if (!TryMapRoleKind(role.Kind, out var kind) ||
                !ServerRolePermissionMaskResolver.TryResolve(
                    role,
                    _legacyServerAdapter,
                    out var permissionMask,
                    out _))
            {
                return false;
            }

            authorizationRole = new ServerAuthorizationRole(
                role.Id,
                role.ServerId,
                kind,
                role.Level,
                permissionMask);
            return true;
        }

        private static bool TryMapRoleKind(
            string roleKind,
            out ServerAuthorizationRoleKind kind)
        {
            switch (roleKind)
            {
                case ServerRoleKindCodes.Standard:
                    kind = ServerAuthorizationRoleKind.Standard;
                    return true;
                case ServerRoleKindCodes.Everyone:
                    kind = ServerAuthorizationRoleKind.Everyone;
                    return true;
                case ServerRoleKindCodes.Integration:
                    kind = ServerAuthorizationRoleKind.Integration;
                    return true;
                default:
                    kind = default;
                    return false;
            }
        }

        private static bool RequiresResourceHierarchy(string permissionCode)
        {
            return permissionCode is
                "MANAGE_PINS" or
                "MANAGE_MESSAGES" or
                "MUTE_VOICE_MEMBERS" or
                "DEAFEN_VOICE_MEMBERS" or
                "MOVE_VOICE_MEMBERS" or
                "DISCONNECT_VOICE_MEMBERS" or
                "MANAGE_SPACE_SETTINGS" or
                "MANAGE_SPACE_ACCESS" or
                "REORDER_SPACES_AND_CATEGORIES" or
                "CREATE_PUBLIC_CATEGORIES" or
                "CREATE_PUBLIC_TEXT_SPACES" or
                "CREATE_PUBLIC_VOICE_SPACES" or
                "CREATE_PRIVATE_CATEGORIES" or
                "CREATE_PRIVATE_TEXT_SPACES" or
                "CREATE_PRIVATE_VOICE_SPACES" or
                "DELETE_CATEGORIES" or
                "DELETE_TEXT_SPACES" or
                "DELETE_VOICE_SPACES";
        }

        private sealed record SpaceGraph(
            Guid ServerId,
            Guid OwnerUserId,
            Guid Revision,
            IReadOnlyList<SpaceAccessNode> Spaces,
            IReadOnlyList<GranularSpaceNode> GranularSpaces,
            IReadOnlyDictionary<Guid, ServerRoleAuthority>
                ProtectionRoleAuthorities);

        private sealed record GranularSpaceNode(
            Guid Id,
            Guid? ParentSpaceId,
            Guid TypeId,
            Guid CreatedByUserId,
            Guid? ProtectionRoleId,
            IReadOnlyList<SpaceAccessOverride> Overrides);

        private static bool Can(
            SpaceAccessCapabilities capabilities,
            SpaceAction action)
        {
            return action switch
            {
                SpaceAction.View => capabilities.CanView,
                SpaceAction.Send => capabilities.CanSendMessages,
                SpaceAction.Connect => capabilities.CanConnectVoice,
                SpaceAction.Manage => capabilities.CanManage,
                _ => false
            };
        }
    }
}
