using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Servers.Authorization;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Spaces;

internal static class SpaceProtectionRoleResolver
{
    public static async Task<Guid?> ResolveAsync(
        AppDbContext db,
        Guid userId,
        Guid serverId,
        CancellationToken cancellationToken)
    {
        var server = await db.Servers
            .AsNoTracking()
            .Where(candidate =>
                candidate.Id == serverId &&
                candidate.DeletedAt == null)
            .Select(candidate => new { candidate.OwnerUserId })
            .SingleOrDefaultAsync(cancellationToken);
        if (server == null)
        {
            return null;
        }

        // Ownership is an authority tier, not just another assigned role.
        // Resolve it before considering the owner's role assignments.
        if (server.OwnerUserId == userId)
        {
            return await db.ServerRoles
                .AsNoTracking()
                .Where(role =>
                    role.ServerId == serverId &&
                    role.Code == "owner" &&
                    role.DeletedAt == null)
                .OrderBy(role => role.Level)
                .Select(role => (Guid?)role.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var assignments = await db.ServerMemberRoles
            .AsNoTracking()
            .Include(assignment => assignment.Role)
                .ThenInclude(role => role.Permissions)
            .Where(assignment =>
                assignment.ServerId == serverId &&
                assignment.Member.UserId == userId &&
                assignment.Member.StatusId == ServerMemberStatusIds.Active &&
                assignment.Member.BannedAt == null &&
                assignment.RevokedAt == null &&
                assignment.Role.ServerId == serverId &&
                assignment.Role.Kind != ServerRoleKindCodes.Everyone &&
                assignment.Role.DeletedAt == null)
            .ToListAsync(cancellationToken);
        var legacyAdapter = new LegacyServerPermissionMaskAdapter();
        ServerRole? strongestRole = null;
        ServerRoleAuthority strongestAuthority = default;
        foreach (var role in assignments.Select(assignment => assignment.Role))
        {
            if (!TryResolveAuthority(
                    role,
                    legacyAdapter,
                    out var authority))
            {
                return null;
            }

            if (strongestRole == null ||
                (ServerRoleAuthorityComparer.TryCompare(
                     authority,
                     strongestAuthority,
                     out var comparison) &&
                 comparison > 0))
            {
                strongestRole = role;
                strongestAuthority = authority;
            }
        }

        if (strongestRole != null)
        {
            return strongestRole.Id;
        }

        // Every active member has the @everyone authority even though that
        // role is not represented by a ServerMemberRole assignment.
        return await db.ServerRoles
            .AsNoTracking()
            .Where(role =>
                role.ServerId == serverId &&
                role.Kind == ServerRoleKindCodes.Everyone &&
                role.DeletedAt == null)
            .OrderBy(role => role.Level)
            .Select(role => (Guid?)role.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static bool TryResolveAuthority(
        ServerRole role,
        LegacyServerPermissionMaskAdapter legacyAdapter,
        out ServerRoleAuthority authority)
    {
        authority = default;
        if (!TryMapRoleKind(role.Kind, out var roleKind) ||
            !ServerRolePermissionMaskResolver.TryResolve(
                role,
                legacyAdapter,
                out var permissionMask,
                out _))
        {
            return false;
        }

        return ServerAuthorizationEvaluator.TryResolveRoleAuthority(
            new ServerAuthorizationRole(
                role.Id,
                role.ServerId,
                roleKind,
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
}
