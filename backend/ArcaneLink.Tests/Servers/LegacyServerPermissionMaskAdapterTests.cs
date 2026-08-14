using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Servers.Authorization;

namespace ArcaneLink.Tests.Servers;

public sealed class LegacyServerPermissionMaskAdapterTests
{
    [Fact]
    public void KnownLegacyRows_MapToTheLosslessCompatibilityMask()
    {
        var adapter = new LegacyServerPermissionMaskAdapter();

        var mapped = adapter.TryCreateMask(
            ServerGovernanceIds.ServerPermissionIds,
            out var mask);

        Assert.True(mapped);
        AssertPermission(mask, "ADMINISTRATOR");
        AssertPermission(mask, "MANAGE_ROLES");
        AssertPermission(mask, "ASSIGN_ROLES");
        AssertPermission(mask, "CREATE_INVITES");
        AssertPermission(mask, "VIEW_INVITE_LOG");
        AssertPermission(mask, "MANAGE_INVITES");
        AssertPermission(mask, "APPROVE_JOIN_REQUESTS");
        AssertPermission(mask, "KICK_MEMBERS");
        AssertPermission(mask, "BAN_MEMBERS");
        AssertPermission(mask, "MANAGE_BANS");
        AssertPermission(mask, "MUTE_VOICE_MEMBERS");
        AssertPermission(mask, "DEAFEN_VOICE_MEMBERS");
        AssertPermission(mask, "MOVE_VOICE_MEMBERS");
        AssertPermission(mask, "DISCONNECT_VOICE_MEMBERS");
        AssertPermission(mask, "VIEW_AUDIT_LOG");
        AssertPermission(mask, "MANAGE_REPORTS");
        Assert.False(mask.Contains(
            ServerPermissionRegistry.GetRequired("MANAGE_NICKNAMES").Bit));
        Assert.False(mask.Contains(
            ServerPermissionRegistry.GetRequired("TIMEOUT_MEMBERS").Bit));
    }

    [Fact]
    public void UnknownLegacyPermission_FailsClosedWithoutAPartialMask()
    {
        var adapter = new LegacyServerPermissionMaskAdapter();

        var mapped = adapter.TryCreateMask(
            [ServerGovernanceIds.PermissionViewAuditLog, Guid.NewGuid()],
            out var mask);

        Assert.False(mapped);
        Assert.True(mask.IsEmpty);
    }

    [Fact]
    public void KnownLegacyPermissions_MapToRepresentativeShadowRequirements()
    {
        var adapter = new LegacyServerPermissionMaskAdapter();
        var mappings = new[]
        {
            (ServerGovernanceIds.PermissionManageServer, "ADMINISTRATOR"),
            (ServerGovernanceIds.PermissionManageRoles, "MANAGE_ROLES"),
            (ServerGovernanceIds.PermissionManageInvites, "MANAGE_INVITES"),
            (ServerGovernanceIds.PermissionManageMembers, "KICK_MEMBERS"),
            (ServerGovernanceIds.PermissionViewAuditLog, "VIEW_AUDIT_LOG"),
            (ServerGovernanceIds.PermissionManageReports, "MANAGE_REPORTS")
        };

        foreach (var (permissionId, expectedCode) in mappings)
        {
            var mapped = adapter.TryGetRepresentativePermissionCode(
                permissionId,
                out var permissionCode);

            Assert.True(mapped);
            Assert.Equal(expectedCode, permissionCode);
        }
    }

    [Fact]
    public void UnknownLegacyPermission_HasNoShadowRequirement()
    {
        var adapter = new LegacyServerPermissionMaskAdapter();

        var mapped = adapter.TryGetRepresentativePermissionCode(
            Guid.NewGuid(),
            out var permissionCode);

        Assert.False(mapped);
        Assert.Equal(string.Empty, permissionCode);
    }

    private static void AssertPermission(
        PermissionMask256 mask,
        string permissionCode)
    {
        Assert.True(mask.Contains(
            ServerPermissionRegistry.GetRequired(permissionCode).Bit));
    }
}
