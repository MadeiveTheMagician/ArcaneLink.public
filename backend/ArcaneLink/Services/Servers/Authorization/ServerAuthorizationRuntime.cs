using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Servers.Authorization.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers.Authorization
{
    public sealed class ServerAuthorizationRuntime
        : IServerAuthorizationRuntime
    {
        private const int ContextLoadAttempts = 2;
        private static readonly Guid SyntheticEveryoneRoleId =
            Guid.Parse("25000000-0000-0000-0000-000000000001");

        private readonly AppDbContext _db;
        private readonly ServerAuthorizationContextCache _cache;
        private readonly LegacyServerPermissionMaskAdapter _legacyAdapter;

        public ServerAuthorizationRuntime(
            AppDbContext db,
            ServerAuthorizationContextCache cache,
            LegacyServerPermissionMaskAdapter legacyAdapter)
        {
            this._db = db;
            this._cache = cache;
            this._legacyAdapter = legacyAdapter;
        }

        public async Task<ServerAuthorizationContext?> GetContextAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            if (userId == Guid.Empty || serverId == Guid.Empty)
            {
                return null;
            }

            for (var attempt = 0; attempt < ContextLoadAttempts; attempt++)
            {
                var header = await this.LoadHeaderAsync(
                    userId,
                    serverId,
                    cancellationToken);
                if (header is null)
                {
                    return null;
                }

                if (header.AuthorizationVersion == Guid.Empty)
                {
                    return null;
                }

                if (this._cache.TryGet(
                        serverId,
                        header.MemberId,
                        header.AuthorizationVersion,
                        out var cached))
                {
                    return cached;
                }

                var principal = await this.LoadPrincipalAsync(
                    serverId,
                    header,
                    cancellationToken);
                if (principal is null ||
                    !ServerAuthorizationEvaluator.TryResolvePrincipal(
                        principal,
                        out _,
                        out _))
                {
                    return null;
                }

                var confirmedVersion = await this.LoadAuthorizationVersionAsync(
                    serverId,
                    cancellationToken);
                if (confirmedVersion != header.AuthorizationVersion)
                {
                    continue;
                }

                var context = new ServerAuthorizationContext(
                    header.AuthorizationVersion,
                    principal);
                this._cache.Set(context);
                return context;
            }

            return null;
        }

        public async Task<bool> IsAllowedAsync(
            Guid userId,
            Guid serverId,
            ServerAuthorizationRequirement requirement,
            CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(requirement);

            var context = await this.GetContextAsync(
                userId,
                serverId,
                cancellationToken);
            if (context is null)
            {
                return false;
            }

            return ServerAuthorizationEvaluator.IsAllowed(
                context.Principal,
                new ServerAuthorizationRequest(
                    serverId,
                    requirement.PermissionCode,
                    requirement.OwnerOnly,
                    requirement.DependencyCodes ?? [],
                    PermissionResource: null,
                    Target: null));
        }

        private async Task<ContextHeader?> LoadHeaderAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return await this._db.ServerMembers
                .AsNoTracking()
                .Where(member =>
                    member.ServerId == serverId &&
                    member.UserId == userId &&
                    member.StatusId == ServerMemberStatusIds.Active &&
                    member.BannedAt == null &&
                    member.Server.DeletedAt == null &&
                    member.User.DeletedAt == null &&
                    member.User.StatusId == UserStatusIds.Active)
                .Select(member => new ContextHeader(
                    member.Id,
                    member.UserId,
                    member.Server.OwnerUserId,
                    member.Server.AuthorizationVersion))
                .SingleOrDefaultAsync(cancellationToken);
        }

        private async Task<ServerAuthorizationPrincipal?> LoadPrincipalAsync(
            Guid serverId,
            ContextHeader header,
            CancellationToken cancellationToken)
        {
            var everyoneRoles = await this._db.ServerRoles
                .AsNoTracking()
                .Include(role => role.Permissions)
                .Where(role =>
                    role.ServerId == serverId &&
                    role.Kind == ServerRoleKindCodes.Everyone &&
                    role.DeletedAt == null)
                .Take(2)
                .ToListAsync(cancellationToken);
            if (everyoneRoles.Count > 1)
            {
                return null;
            }

            ServerAuthorizationRole everyoneRole;
            if (everyoneRoles.Count == 0)
            {
                everyoneRole = new ServerAuthorizationRole(
                    SyntheticEveryoneRoleId,
                    serverId,
                    ServerAuthorizationRoleKind.Everyone,
                    int.MaxValue,
                    ServerPermissionRegistry.DefaultEveryonePermissionsMask);
            }
            else if (!this.TryAdaptRole(everyoneRoles[0], out everyoneRole))
            {
                return null;
            }

            var assignments = await this._db.ServerMemberRoles
                .AsNoTracking()
                .Include(assignment => assignment.Role)
                    .ThenInclude(role => role.Permissions)
                .Where(assignment =>
                    assignment.ServerId == serverId &&
                    assignment.MemberId == header.MemberId &&
                    assignment.RevokedAt == null &&
                    assignment.Role.ServerId == serverId &&
                    assignment.Role.DeletedAt == null)
                .ToListAsync(cancellationToken);
            var assignedRoles = new List<ServerAuthorizationRole>(assignments.Count);
            foreach (var assignment in assignments)
            {
                if (!this.TryAdaptRole(assignment.Role, out var role))
                {
                    return null;
                }

                assignedRoles.Add(role);
            }

            return new ServerAuthorizationPrincipal(
                serverId,
                header.MemberId,
                IsActiveMember: true,
                IsOwner: header.OwnerUserId == header.UserId,
                everyoneRole,
                Array.AsReadOnly(assignedRoles.ToArray()));
        }

        private bool TryAdaptRole(
            ServerRole role,
            out ServerAuthorizationRole authorizationRole)
        {
            authorizationRole = null!;
            if (!TryMapRoleKind(role.Kind, out var kind) ||
                !ServerRolePermissionMaskResolver.TryResolve(
                    role,
                    this._legacyAdapter,
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

        private async Task<Guid?> LoadAuthorizationVersionAsync(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return await this._db.Servers
                .AsNoTracking()
                .Where(server =>
                    server.Id == serverId &&
                    server.DeletedAt == null)
                .Select(server => (Guid?)server.AuthorizationVersion)
                .SingleOrDefaultAsync(cancellationToken);
        }

        private sealed record ContextHeader(
            Guid MemberId,
            Guid UserId,
            Guid OwnerUserId,
            Guid AuthorizationVersion);
    }
}
