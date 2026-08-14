using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Servers.Authorization.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Servers
{
    public class ServerGovernanceAccessService : IServerGovernanceAccessService
    {
        private readonly AppDbContext _db;
        private readonly IServerAuthorizationRuntime? _authorizationRuntime;
        private readonly LegacyServerPermissionMaskAdapter _legacyAdapter;
        private readonly ServerAuthorizationShadowOptions _shadowOptions;
        private readonly ILogger<ServerGovernanceAccessService>? _logger;

        public ServerGovernanceAccessService(
            AppDbContext db,
            IServerAuthorizationRuntime? authorizationRuntime = null,
            LegacyServerPermissionMaskAdapter? legacyAdapter = null,
            IOptions<ServerAuthorizationShadowOptions>? shadowOptions = null,
            ILogger<ServerGovernanceAccessService>? logger = null)
        {
            _db = db;
            _authorizationRuntime = authorizationRuntime;
            _legacyAdapter = legacyAdapter ?? new LegacyServerPermissionMaskAdapter();
            _shadowOptions = shadowOptions?.Value ?? new ServerAuthorizationShadowOptions();
            _logger = logger;
        }

        public async Task<bool> CanManageServerAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return await HasGranularPermissionAsync(
                userId,
                serverId,
                ServerPermissionRegistry.AdministratorCode,
                cancellationToken);
        }

        public async Task<bool> CanCreateInvitesAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var server = await _db.Servers
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (server == null)
            {
                return false;
            }

            if (!await IsActiveMemberAsync(userId, serverId, cancellationToken))
            {
                return false;
            }

            return await HasGranularPermissionAsync(
                userId,
                serverId,
                "CREATE_INVITES",
                cancellationToken);
        }

        public async Task<bool> HasEffectiveServerPermissionAsync(
            Guid userId,
            Guid serverId,
            Guid permissionId,
            CancellationToken cancellationToken)
        {
            if (!ServerGovernanceIds.ServerPermissionIds.Contains(permissionId))
            {
                return false;
            }

            var legacyAllowed = await _db.ServerMembers
                .AsNoTracking()
                .AnyAsync(
                    member =>
                        member.ServerId == serverId &&
                        member.UserId == userId &&
                        member.StatusId == ServerMemberStatusIds.Active &&
                        member.BannedAt == null &&
                        member.Server.DeletedAt == null &&
                        member.User.DeletedAt == null &&
                        member.User.StatusId == UserStatusIds.Active &&
                        (member.Server.OwnerUserId == userId ||
                         member.Roles.Any(assignment =>
                             assignment.RevokedAt == null &&
                             assignment.Role.DeletedAt == null &&
                             assignment.Role.Permissions.Any(rolePermission =>
                                 rolePermission.IsGranted &&
                                 (rolePermission.PermissionId == permissionId ||
                                  rolePermission.PermissionId ==
                                  ServerGovernanceIds.PermissionManageServer)))),
                    cancellationToken);
            var shadowDecision = await EvaluateAuthorizationShadowAsync(
                userId,
                serverId,
                permissionId,
                legacyAllowed,
                cancellationToken);
            return shadowDecision?.IsEnforced == true
                ? shadowDecision.Allowed
                : legacyAllowed;
        }

        public async Task<bool> HasGranularPermissionAsync(
            Guid userId,
            Guid serverId,
            string permissionCode,
            CancellationToken cancellationToken,
            bool ownerOnly = false,
            IReadOnlyList<string>? dependencyCodes = null)
        {
            if (!ServerPermissionRegistry.TryGet(permissionCode, out _) ||
                _authorizationRuntime == null)
            {
                return false;
            }

            try
            {
                return await _authorizationRuntime.IsAllowedAsync(
                    userId,
                    serverId,
                    new ServerAuthorizationRequirement(
                        permissionCode,
                        ownerOnly,
                        dependencyCodes),
                    cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                _logger?.LogError(
                    exception,
                    "Granular server authorization failed closed for server {ServerId}, member user {UserId}, permission {PermissionCode}",
                    serverId,
                    userId,
                    permissionCode);
                return false;
            }
        }

        private async Task<AuthorizationShadowDecision?> EvaluateAuthorizationShadowAsync(
            Guid userId,
            Guid serverId,
            Guid legacyPermissionId,
            bool legacyAllowed,
            CancellationToken cancellationToken)
        {
            if (!_legacyAdapter.TryGetRepresentativePermissionCode(
                    legacyPermissionId,
                    out var permissionCode))
            {
                return null;
            }

            var isEnforced = _shadowOptions.IsEnforced(permissionCode);
            if (!_shadowOptions.Enabled && !isEnforced)
            {
                return null;
            }

            if (_authorizationRuntime == null)
            {
                _logger?.LogError(
                    "Server authorization v1 runtime is unavailable for {PermissionCode}; enforced={IsEnforced}",
                    permissionCode,
                    isEnforced);
                return isEnforced
                    ? new AuthorizationShadowDecision(true, false)
                    : null;
            }

            try
            {
                var shadowAllowed = await _authorizationRuntime.IsAllowedAsync(
                    userId,
                    serverId,
                    new ServerAuthorizationRequirement(permissionCode),
                    cancellationToken);
                if (shadowAllowed != legacyAllowed)
                {
                    _logger?.LogWarning(
                        "Server authorization shadow mismatch for server {ServerId}, member user {UserId}, legacy permission {LegacyPermissionId}, v1 permission {PermissionCode}: legacy={LegacyAllowed}, v1={ShadowAllowed}",
                        serverId,
                        userId,
                        legacyPermissionId,
                        permissionCode,
                        legacyAllowed,
                        shadowAllowed);
                }

                return new AuthorizationShadowDecision(
                    isEnforced,
                    shadowAllowed);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                _logger?.LogWarning(
                    exception,
                    "Server authorization shadow evaluation failed for server {ServerId} and legacy permission {LegacyPermissionId}",
                    serverId,
                    legacyPermissionId);
                return isEnforced
                    ? new AuthorizationShadowDecision(true, false)
                    : null;
            }
        }

        private sealed record AuthorizationShadowDecision(
            bool IsEnforced,
            bool Allowed);

        public async Task<bool> HasServerPermissionAsync(
            Guid userId,
            Guid serverId,
            Guid permissionId,
            CancellationToken cancellationToken)
        {
            return await _db.ServerMemberRoles
                .AsNoTracking()
                .AnyAsync(
                    x => x.ServerId == serverId &&
                         x.Member.UserId == userId &&
                         x.Member.StatusId == ServerMemberStatusIds.Active &&
                         x.Member.BannedAt == null &&
                         x.Member.Server.DeletedAt == null &&
                         x.Member.User.DeletedAt == null &&
                         x.Member.User.StatusId == UserStatusIds.Active &&
                         x.RevokedAt == null &&
                         x.Role.DeletedAt == null &&
                         x.Role.Permissions.Any(permission =>
                             permission.PermissionId == permissionId &&
                             permission.IsGranted),
                    cancellationToken);
        }

        public async Task<ServerRole?> EnsureOwnerRoleAsync(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var server = await _db.Servers
                .FirstOrDefaultAsync(
                    x => x.Id == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (server == null)
            {
                return null;
            }

            var ownerRole = await _db.ServerRoles
                .Include(x => x.Permissions)
                .FirstOrDefaultAsync(
                    x => x.ServerId == serverId &&
                         x.Code == "owner" &&
                         x.DeletedAt == null,
                    cancellationToken);

            var now = DateTime.UtcNow;
            var authorizationChanged = false;
            var roleChanged = false;

            if (ownerRole == null)
            {
                ownerRole = new ServerRole
                {
                    Id = Guid.NewGuid(),
                    ServerId = serverId,
                    Code = "owner",
                    Title = "Owner",
                    Description = "Server owner",
                    CreatedByUserId = server.CreatedByUserId,
                    Level = 1,
                    IsSystem = true,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                _db.ServerRoles.Add(ownerRole);
                authorizationChanged = true;
                roleChanged = true;
            }

            var permissionIds = new[]
            {
                ServerGovernanceIds.PermissionManageServer,
                ServerGovernanceIds.PermissionManageRoles,
                ServerGovernanceIds.PermissionManageInvites,
                ServerGovernanceIds.PermissionManageMembers,
                ServerGovernanceIds.PermissionViewAuditLog,
                ServerGovernanceIds.PermissionManageReports
            };

            foreach (var permissionId in permissionIds)
            {
                var existingPermission = ownerRole.Permissions.FirstOrDefault(
                    item => item.PermissionId == permissionId);
                if (existingPermission == null)
                {
                    ownerRole.Permissions.Add(new ServerRolePermission
                    {
                        RoleId = ownerRole.Id,
                        PermissionId = permissionId,
                        IsGranted = true,
                        CreatedAt = now
                    });
                    authorizationChanged = true;
                    roleChanged = true;
                }
                else if (!existingPermission.IsGranted)
                {
                    existingPermission.IsGranted = true;
                    authorizationChanged = true;
                    roleChanged = true;
                }
            }

            var expectedPermissionMask =
                ServerRolePermissionMaskResolver.EncodeLegacyCompatibility(
                    permissionIds,
                    _legacyAdapter);
            if (ownerRole.PermissionSchemaVersion !=
                    ServerPermissionRegistry.SchemaVersion ||
                ownerRole.PermissionMask == null ||
                !ownerRole.PermissionMask.SequenceEqual(expectedPermissionMask))
            {
                ownerRole.PermissionMask = expectedPermissionMask;
                ownerRole.PermissionSchemaVersion =
                    ServerPermissionRegistry.SchemaVersion;
                authorizationChanged = true;
                roleChanged = true;
            }

            if (roleChanged)
            {
                ownerRole.Version = Guid.NewGuid();
                ownerRole.UpdatedAt = now;
            }

            var ownerMember = await _db.ServerMembers
                .FirstOrDefaultAsync(
                    x => x.ServerId == serverId &&
                         x.UserId == server.OwnerUserId &&
                         x.StatusId == ServerMemberStatusIds.Active &&
                         x.BannedAt == null,
                    cancellationToken);

            if (ownerMember != null)
            {
                var ownerAssignment = await _db.ServerMemberRoles
                    .FirstOrDefaultAsync(
                        x => x.ServerId == serverId &&
                             x.MemberId == ownerMember.Id &&
                             x.RoleId == ownerRole.Id,
                        cancellationToken);

                if (ownerAssignment == null)
                {
                    _db.ServerMemberRoles.Add(new ServerMemberRole
                    {
                        Id = Guid.NewGuid(),
                        ServerId = serverId,
                        MemberId = ownerMember.Id,
                        RoleId = ownerRole.Id,
                        AssignedByUserId = server.OwnerUserId,
                        AssignedAt = now
                    });
                    ownerMember.RolesVersion = Guid.NewGuid();
                    authorizationChanged = true;
                }
                else if (ownerAssignment.RevokedAt != null)
                {
                    ownerAssignment.AssignedByUserId = server.OwnerUserId;
                    ownerAssignment.AssignedAt = now;
                    ownerAssignment.RevokedAt = null;
                    ownerAssignment.RevokedByUserId = null;
                    ownerMember.RolesVersion = Guid.NewGuid();
                    authorizationChanged = true;
                }
            }

            if (authorizationChanged)
            {
                await _db.StageServerAclRevisionBumpAsync(
                    serverId,
                    cancellationToken);
            }

            return ownerRole;
        }

        public async Task<bool> IsActiveMemberAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return await _db.ServerMembers.AnyAsync(
                x => x.ServerId == serverId &&
                     x.UserId == userId &&
                     x.StatusId == ServerMemberStatusIds.Active &&
                     x.BannedAt == null &&
                     x.Server.DeletedAt == null &&
                     x.User.DeletedAt == null &&
                     x.User.StatusId == UserStatusIds.Active,
                cancellationToken);
        }

        public void AddAudit(
            Guid serverId,
            Guid eventTypeId,
            Guid? actorUserId = null,
            Guid? targetUserId = null,
            Guid? relatedRoleId = null,
            Guid? relatedInviteId = null,
            Guid? relatedSpaceId = null,
            string? payload = null)
        {
            _db.ServerAuditLogs.Add(new ServerAuditLog
            {
                Id = Guid.NewGuid(),
                ServerId = serverId,
                EventTypeId = eventTypeId,
                ActorUserId = actorUserId,
                TargetUserId = targetUserId,
                RelatedRoleId = relatedRoleId,
                RelatedInviteId = relatedInviteId,
                RelatedSpaceId = relatedSpaceId,
                Payload = payload,
                CreatedAt = DateTime.UtcNow
            });
        }
    }
}
