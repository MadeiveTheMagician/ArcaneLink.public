using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Servers.Authorization;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerRolePermissionMaskCodecTests
{
    [Fact]
    public void Codec_RoundTripsAValidatedRegistryMask()
    {
        var expected = ServerPermissionRegistry.CreateMask(
            ["SEND_MESSAGES", "MANAGE_ROLES", "VIEW_AUDIT_LOG"]);

        var encoded = ServerRolePermissionMaskCodec.Encode(expected);
        var decoded = ServerRolePermissionMaskCodec.TryDecode(
            encoded,
            ServerPermissionRegistry.SchemaVersion,
            out var actual);

        Assert.True(decoded);
        Assert.Equal(PermissionMask256.ByteLength, encoded.Length);
        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Codec_RejectsMalformedUnknownAndWrongSchemaMasks()
    {
        Assert.False(ServerRolePermissionMaskCodec.TryDecode(
            new byte[PermissionMask256.ByteLength - 1],
            ServerPermissionRegistry.SchemaVersion,
            out _));
        Assert.False(ServerRolePermissionMaskCodec.TryDecode(
            PermissionMask256.Empty.With(51).ToByteArray(),
            ServerPermissionRegistry.SchemaVersion,
            out _));
        Assert.False(ServerRolePermissionMaskCodec.TryDecode(
            PermissionMask256.Empty.ToByteArray(),
            ServerPermissionRegistry.SchemaVersion + 1,
            out _));
    }

    [Fact]
    public void Resolver_PrefersAValidatedPersistedMask()
    {
        var role = CreateRole(
            ServerPermissionRegistry.CreateMask(["SEND_MESSAGES"]),
            ServerGovernanceIds.PermissionViewAuditLog);

        var resolved = ServerRolePermissionMaskResolver.TryResolve(
            role,
            new LegacyServerPermissionMaskAdapter(),
            out var mask,
            out var source);

        Assert.True(resolved);
        Assert.Equal(ServerRolePermissionMaskSource.Persisted, source);
        Assert.True(mask.Contains(
            ServerPermissionRegistry.GetRequired("SEND_MESSAGES").Bit));
        Assert.False(mask.Contains(
            ServerPermissionRegistry.GetRequired("VIEW_AUDIT_LOG").Bit));
    }

    [Fact]
    public void Resolver_UsesLegacyCompatibilityForAnEmptyPersistedMask()
    {
        var role = CreateRole(
            PermissionMask256.Empty,
            ServerGovernanceIds.PermissionManageRoles);

        var resolved = ServerRolePermissionMaskResolver.TryResolve(
            role,
            new LegacyServerPermissionMaskAdapter(),
            out var mask,
            out var source);

        Assert.True(resolved);
        Assert.Equal(ServerRolePermissionMaskSource.LegacyFallback, source);
        Assert.True(mask.Contains(
            ServerPermissionRegistry.GetRequired("MANAGE_ROLES").Bit));
        Assert.True(mask.Contains(
            ServerPermissionRegistry.GetRequired("ASSIGN_ROLES").Bit));
    }

    [Fact]
    public void Resolver_FailsClosedForInvalidPersistedOrUnknownLegacyData()
    {
        var invalidPersisted = CreateRole(
            PermissionMask256.Empty,
            ServerGovernanceIds.PermissionViewAuditLog);
        invalidPersisted.PermissionMask =
            PermissionMask256.Empty.With(51).ToByteArray();

        Assert.False(ServerRolePermissionMaskResolver.TryResolve(
            invalidPersisted,
            new LegacyServerPermissionMaskAdapter(),
            out var invalidMask,
            out _));
        Assert.True(invalidMask.IsEmpty);

        var unknownLegacy = CreateRole(PermissionMask256.Empty, Guid.NewGuid());
        Assert.False(ServerRolePermissionMaskResolver.TryResolve(
            unknownLegacy,
            new LegacyServerPermissionMaskAdapter(),
            out var unknownMask,
            out _));
        Assert.True(unknownMask.IsEmpty);
    }

    private static ServerRole CreateRole(
        PermissionMask256 mask,
        params Guid[] legacyPermissionIds)
    {
        var roleId = Guid.NewGuid();
        var role = new ServerRole
        {
            Id = roleId,
            ServerId = Guid.NewGuid(),
            Title = "Permission mask test role",
            Level = 100,
            PermissionMask = mask.ToByteArray(),
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        foreach (var permissionId in legacyPermissionIds)
        {
            role.Permissions.Add(new ServerRolePermission
            {
                RoleId = roleId,
                PermissionId = permissionId,
                IsGranted = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        return role;
    }
}
