using ArcaneLink.DataBase.Models.ServersModels;

namespace ArcaneLink.Services.Servers.Authorization;

public enum ServerRolePermissionMaskSource
{
    Persisted,
    LegacyFallback
}

public static class ServerRolePermissionMaskCodec
{
    public static byte[] Encode(
        PermissionMask256 mask,
        int schemaVersion = ServerPermissionRegistry.SchemaVersion)
    {
        return ServerPermissionRegistry
            .ValidateForWrite(mask, schemaVersion)
            .ToByteArray();
    }

    public static bool TryDecode(
        byte[]? storedMask,
        int schemaVersion,
        out PermissionMask256 mask)
    {
        mask = PermissionMask256.Empty;
        if (storedMask is not { Length: PermissionMask256.ByteLength })
        {
            return false;
        }

        try
        {
            mask = ServerPermissionRegistry.ValidateForWrite(
                PermissionMask256.FromByteArray(storedMask),
                schemaVersion);
            return true;
        }
        catch (ArgumentException)
        {
            mask = PermissionMask256.Empty;
            return false;
        }
        catch (InvalidOperationException)
        {
            mask = PermissionMask256.Empty;
            return false;
        }
    }
}

public static class ServerRolePermissionMaskResolver
{
    public static byte[] EncodeLegacyCompatibility(
        IEnumerable<Guid> grantedPermissionIds,
        LegacyServerPermissionMaskAdapter legacyAdapter)
    {
        ArgumentNullException.ThrowIfNull(grantedPermissionIds);
        ArgumentNullException.ThrowIfNull(legacyAdapter);

        if (!legacyAdapter.TryCreateMask(
                grantedPermissionIds,
                out var compatibilityMask))
        {
            throw new InvalidOperationException(
                "The role contains a permission that cannot be represented by the legacy compatibility map.");
        }

        return ServerRolePermissionMaskCodec.Encode(compatibilityMask);
    }

    public static bool TryResolve(
        ServerRole role,
        LegacyServerPermissionMaskAdapter legacyAdapter,
        out PermissionMask256 mask,
        out ServerRolePermissionMaskSource source)
    {
        ArgumentNullException.ThrowIfNull(role);
        ArgumentNullException.ThrowIfNull(legacyAdapter);

        source = ServerRolePermissionMaskSource.Persisted;
        if (!ServerRolePermissionMaskCodec.TryDecode(
                role.PermissionMask,
                role.PermissionSchemaVersion,
                out var persistedMask))
        {
            mask = PermissionMask256.Empty;
            return false;
        }

        var grantedLegacyPermissionIds = role.Permissions
            .Where(permission => permission.IsGranted)
            .Select(permission => permission.PermissionId)
            .ToArray();
        if (!persistedMask.IsEmpty || grantedLegacyPermissionIds.Length == 0)
        {
            mask = persistedMask;
            return true;
        }

        if (!legacyAdapter.TryCreateMask(
                grantedLegacyPermissionIds,
                out mask))
        {
            mask = PermissionMask256.Empty;
            return false;
        }

        source = ServerRolePermissionMaskSource.LegacyFallback;
        return true;
    }
}
