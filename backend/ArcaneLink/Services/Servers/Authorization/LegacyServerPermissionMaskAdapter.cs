using ArcaneLink.DataBase.Constants;

namespace ArcaneLink.Services.Servers.Authorization;

public sealed class LegacyServerPermissionMaskAdapter
{
    private static readonly IReadOnlyDictionary<Guid, string>
        RepresentativeCodesByLegacyPermission = new Dictionary<Guid, string>
        {
            [ServerGovernanceIds.PermissionManageServer] =
                ServerPermissionRegistry.AdministratorCode,
            [ServerGovernanceIds.PermissionManageRoles] = "MANAGE_ROLES",
            [ServerGovernanceIds.PermissionManageInvites] = "MANAGE_INVITES",
            [ServerGovernanceIds.PermissionManageMembers] = "KICK_MEMBERS",
            [ServerGovernanceIds.PermissionViewAuditLog] = "VIEW_AUDIT_LOG",
            [ServerGovernanceIds.PermissionManageReports] = "MANAGE_REPORTS"
        };

    private static readonly IReadOnlyDictionary<Guid, PermissionMask256>
        CompatibilityMasks = new Dictionary<Guid, PermissionMask256>
        {
            [ServerGovernanceIds.PermissionManageServer] = Mask(
                "ADMINISTRATOR"),
            [ServerGovernanceIds.PermissionManageRoles] = Mask(
                "MANAGE_ROLES",
                "ASSIGN_ROLES"),
            [ServerGovernanceIds.PermissionManageInvites] = Mask(
                "CREATE_INVITES",
                "VIEW_INVITE_LOG",
                "MANAGE_INVITES"),
            [ServerGovernanceIds.PermissionManageMembers] = Mask(
                "APPROVE_JOIN_REQUESTS",
                "KICK_MEMBERS",
                "BAN_MEMBERS",
                "MANAGE_BANS",
                "MUTE_VOICE_MEMBERS",
                "DEAFEN_VOICE_MEMBERS",
                "MOVE_VOICE_MEMBERS",
                "DISCONNECT_VOICE_MEMBERS"),
            [ServerGovernanceIds.PermissionViewAuditLog] = Mask(
                "VIEW_AUDIT_LOG"),
            [ServerGovernanceIds.PermissionManageReports] = Mask(
                "MANAGE_REPORTS")
        };

    public bool TryCreateMask(
        IEnumerable<Guid> grantedPermissionIds,
        out PermissionMask256 mask)
    {
        ArgumentNullException.ThrowIfNull(grantedPermissionIds);

        var candidate = PermissionMask256.Empty;
        foreach (var permissionId in grantedPermissionIds)
        {
            if (!CompatibilityMasks.TryGetValue(
                    permissionId,
                    out var permissionMask))
            {
                mask = PermissionMask256.Empty;
                return false;
            }

            candidate |= permissionMask;
        }

        mask = candidate;
        return true;
    }

    public bool TryGetRepresentativePermissionCode(
        Guid legacyPermissionId,
        out string permissionCode)
    {
        if (RepresentativeCodesByLegacyPermission.TryGetValue(
                legacyPermissionId,
                out var representativeCode))
        {
            permissionCode = representativeCode;
            return true;
        }

        permissionCode = string.Empty;
        return false;
    }

    public IReadOnlyList<Guid> GetFullyRepresentedLegacyPermissionIds(
        PermissionMask256 mask)
    {
        ServerPermissionRegistry.ValidateForWrite(
            mask,
            ServerPermissionRegistry.SchemaVersion);

        return CompatibilityMasks
            .Where(pair => pair.Value.Except(mask).IsEmpty)
            .Select(pair => pair.Key)
            .ToList();
    }

    public static bool IsRepresentativePermissionCode(
        string? permissionCode)
    {
        return !string.IsNullOrWhiteSpace(permissionCode) &&
               RepresentativeCodesByLegacyPermission.Values.Contains(
                   permissionCode,
                   StringComparer.OrdinalIgnoreCase);
    }

    private static PermissionMask256 Mask(params string[] permissionCodes)
    {
        return ServerPermissionRegistry.CreateMask(permissionCodes);
    }
}
