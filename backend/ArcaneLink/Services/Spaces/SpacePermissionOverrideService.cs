using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Servers.Authorization.Abstractions;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Spaces
{
    public class SpacePermissionOverrideService : ISpacePermissionOverrideService
    {
        private readonly AppDbContext _db;
        private readonly IServerGovernanceAccessService _access;
        private readonly ISpaceAuthorizationService _authorization;
        private readonly IServerAuthorizationRuntime _serverAuthorization;
        private readonly LegacySpacePermissionMaskAdapter _legacySpaceAdapter;
        private readonly LegacyServerPermissionMaskAdapter _legacyServerAdapter;
        private readonly SpaceValidationService _validation;
        private readonly SpaceRealtimeNotifier _notifier;

        public SpacePermissionOverrideService(
            AppDbContext db,
            IServerGovernanceAccessService access,
            ISpaceAuthorizationService authorization,
            IServerAuthorizationRuntime serverAuthorization,
            LegacySpacePermissionMaskAdapter legacySpaceAdapter,
            LegacyServerPermissionMaskAdapter legacyServerAdapter,
            SpaceValidationService validation,
            SpaceRealtimeNotifier notifier)
        {
            _db = db;
            _access = access;
            _authorization = authorization;
            _serverAuthorization = serverAuthorization;
            _legacySpaceAdapter = legacySpaceAdapter;
            _legacyServerAdapter = legacyServerAdapter;
            _validation = validation;
            _notifier = notifier;
        }

        public async Task<SpacePermissionOverrideResponse?> UpsertPermissionOverrideAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            UpsertSpacePermissionOverrideRequest request,
            CancellationToken cancellationToken = default)
        {
            if (!SpaceValidationService.IsValidOverrideTarget(request) ||
                request.Allow == request.Deny ||
                !await _validation.SpaceExistsAsync(serverId, spaceId, cancellationToken) ||
                !await _validation.IsValidOverrideRoleAsync(serverId, request.RoleId, cancellationToken) ||
                !await _validation.IsValidOverrideMemberAsync(serverId, request.MemberId, cancellationToken) ||
                !await _validation.PermissionExistsAsync(request.PermissionId, cancellationToken))
            {
                return null;
            }

            var entity = await _db.SpacePermissionOverrides
                .FirstOrDefaultAsync(
                    x => x.SpaceId == spaceId &&
                         x.RoleId == request.RoleId &&
                         x.MemberId == request.MemberId &&
                         x.PermissionId == request.PermissionId,
                    cancellationToken);
            if (!await _authorization.IsAllowedAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    new SpaceAuthorizationRequirement(
                        "MANAGE_SPACE_ACCESS",
                        Protection: entity == null
                            ? null
                            : new SpaceAuthorizationProtection(
                                entity.ProtectionRoleId,
                                entity.CreatedByUserId)),
                    cancellationToken))
            {
                return null;
            }

            var actorContext = await _serverAuthorization.GetContextAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (actorContext == null ||
                !ServerAuthorizationEvaluator.TryResolvePrincipal(
                    actorContext.Principal,
                    out var actorAuthority,
                    out _) ||
                !await CanAffectTargetAsync(
                    actorContext.Principal,
                    actorAuthority,
                    serverId,
                    request.RoleId,
                    request.MemberId,
                    cancellationToken) ||
                (request.Allow &&
                 !await CanGrantLegacyPermissionAsync(
                     currentUserId,
                     serverId,
                     spaceId,
                     request.PermissionId,
                     cancellationToken)))
            {
                return null;
            }

            var now = DateTime.UtcNow;
            var actorProtectionRoleId =
                await SpaceProtectionRoleResolver.ResolveAsync(
                    _db,
                    currentUserId,
                    serverId,
                    cancellationToken);
            if (!actorContext.Principal.IsOwner &&
                !actorProtectionRoleId.HasValue)
            {
                // A missing protection role is interpreted as legacy
                // owner-protected data at read time. Never let a non-owner
                // manufacture such a row.
                return null;
            }

            if (entity == null)
            {
                entity = new SpacePermissionOverride
                {
                    Id = Guid.NewGuid(),
                    ServerId = serverId,
                    SpaceId = spaceId,
                    RoleId = request.RoleId,
                    MemberId = request.MemberId,
                    PermissionId = request.PermissionId,
                    Allow = request.Allow,
                    Deny = request.Deny,
                    CreatedByUserId = currentUserId,
                    ProtectionRoleId = actorProtectionRoleId,
                    CreatedAt = now
                };
                _db.SpacePermissionOverrides.Add(entity);
            }
            else
            {
                entity.Allow = request.Allow;
                entity.Deny = request.Deny;
                entity.ProtectionRoleId ??= actorProtectionRoleId;
                entity.CreatedByUserId ??= currentUserId;
                entity.Version = Guid.NewGuid();
            }

            _access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditSpaceOverrideUpserted,
                currentUserId,
                relatedSpaceId: spaceId);
            await _db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            _authorization.InvalidateServer(serverId);
            await _notifier.NotifySpacesChangedAsync(serverId, spaceId, cancellationToken);

            return await LoadOverrideResponseAsync(entity.Id, cancellationToken);
        }

        public async Task<bool> DeletePermissionOverrideAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid overrideId,
            CancellationToken cancellationToken = default)
        {
            var permissionOverride = await _db.SpacePermissionOverrides
                .Include(x => x.Space)
                .FirstOrDefaultAsync(
                    x => x.Id == overrideId &&
                         x.SpaceId == spaceId &&
                         x.Space.ServerId == serverId &&
                         x.Space.DeletedAt == null,
                    cancellationToken);

            if (permissionOverride == null)
            {
                return false;
            }

            if (!await _authorization.IsAllowedAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    new SpaceAuthorizationRequirement(
                        "MANAGE_SPACE_ACCESS",
                        Protection: new SpaceAuthorizationProtection(
                            permissionOverride.ProtectionRoleId,
                            permissionOverride.CreatedByUserId)),
                    cancellationToken))
            {
                return false;
            }

            var actorContext = await _serverAuthorization.GetContextAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (actorContext == null ||
                !ServerAuthorizationEvaluator.TryResolvePrincipal(
                    actorContext.Principal,
                    out var actorAuthority,
                    out _) ||
                !await CanAffectTargetAsync(
                    actorContext.Principal,
                    actorAuthority,
                    serverId,
                    permissionOverride.RoleId,
                    permissionOverride.MemberId,
                    cancellationToken))
            {
                return false;
            }

            _db.SpacePermissionOverrides.Remove(permissionOverride);
            _access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditSpaceOverrideDeleted,
                currentUserId,
                relatedSpaceId: spaceId);
            await _db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            _authorization.InvalidateServer(serverId);
            await _notifier.NotifySpacesChangedAsync(serverId, spaceId, cancellationToken);

            return true;
        }

        private async Task<bool> CanGrantLegacyPermissionAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid legacyPermissionId,
            CancellationToken cancellationToken)
        {
            if (!_legacySpaceAdapter.TryCreateMask(
                    legacyPermissionId,
                    out var requestedMask) ||
                requestedMask.Contains(
                    ServerPermissionRegistry.Administrator.Bit))
            {
                return false;
            }

            foreach (var permissionCode in
                     ServerPermissionRegistry.GetCodes(requestedMask))
            {
                if (!await _authorization.IsAllowedAsync(
                        currentUserId,
                        serverId,
                        spaceId,
                        new SpaceAuthorizationRequirement(permissionCode),
                        cancellationToken))
                {
                    return false;
                }
            }

            return true;
        }

        private async Task<bool> CanAffectTargetAsync(
            ServerAuthorizationPrincipal actor,
            ServerRoleAuthority actorAuthority,
            Guid serverId,
            Guid? roleId,
            Guid? memberId,
            CancellationToken cancellationToken)
        {
            if (roleId.HasValue)
            {
                var role = await _db.ServerRoles
                    .AsNoTracking()
                    .Include(candidate => candidate.Permissions)
                    .SingleOrDefaultAsync(
                        candidate =>
                            candidate.Id == roleId.Value &&
                            candidate.ServerId == serverId &&
                            candidate.DeletedAt == null,
                        cancellationToken);
                return role != null &&
                       TryResolveRoleAuthority(role, out var roleAuthority) &&
                       ServerRoleAuthorityComparer.CanAffectSubject(
                           actorAuthority,
                           roleAuthority);
            }

            if (!memberId.HasValue || actor.MemberId == memberId.Value)
            {
                return false;
            }

            var targetUserId = await _db.ServerMembers
                .AsNoTracking()
                .Where(member =>
                    member.Id == memberId.Value &&
                    member.ServerId == serverId &&
                    member.StatusId == ServerMemberStatusIds.Active &&
                    member.BannedAt == null)
                .Select(member => (Guid?)member.UserId)
                .SingleOrDefaultAsync(cancellationToken);
            if (!targetUserId.HasValue)
            {
                return false;
            }

            var targetContext = await _serverAuthorization.GetContextAsync(
                targetUserId.Value,
                serverId,
                cancellationToken);
            return targetContext != null &&
                   ServerAuthorizationEvaluator.TryResolvePrincipal(
                       targetContext.Principal,
                       out var memberAuthority,
                       out _) &&
                   ServerRoleAuthorityComparer.CanAffectSubject(
                       actorAuthority,
                       memberAuthority);
        }

        private bool TryResolveRoleAuthority(
            ServerRole role,
            out ServerRoleAuthority authority)
        {
            authority = default;
            if (!TryMapRoleKind(role.Kind, out var kind) ||
                !ServerRolePermissionMaskResolver.TryResolve(
                    role,
                    _legacyServerAdapter,
                    out var permissionMask,
                    out _))
            {
                return false;
            }

            return ServerAuthorizationEvaluator.TryResolveRoleAuthority(
                new ServerAuthorizationRole(
                    role.Id,
                    role.ServerId,
                    kind,
                    role.Level,
                    permissionMask),
                out authority);
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

        private async Task<SpacePermissionOverrideResponse?> LoadOverrideResponseAsync(
            Guid overrideId,
            CancellationToken cancellationToken)
        {
            var permissionOverride = await _db.SpacePermissionOverrides
                .AsNoTracking()
                .Include(x => x.Permission)
                .FirstOrDefaultAsync(x => x.Id == overrideId, cancellationToken);

            return permissionOverride == null
                ? null
                : SpaceMapper.ToOverrideResponse(permissionOverride);
        }
    }
}
