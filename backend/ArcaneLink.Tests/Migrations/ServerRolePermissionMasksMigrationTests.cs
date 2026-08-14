using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Models.ServersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class ServerRolePermissionMasksMigrationTests
{
    private const string PreviousMigration =
        "20260809204948_AddServerAuthorizationMetadata";
    private const string Migration =
        "20260810105822_AddServerRolePermissionMasks";

    [Fact]
    public void UpgradeScript_AddsValidatedMasksAndBackfillsEveryLegacyBundle()
    {
        using var db = CreatePostgreSqlContext();
        var script = db.GetService<IMigrator>().GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains("permission_mask", script, StringComparison.Ordinal);
        Assert.Contains("permission_schema_version", script, StringComparison.Ordinal);
        Assert.Contains(
            "CK_ServerRoles_PermissionMaskLength",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CK_ServerRoles_PermissionSchemaVersion",
            script,
            StringComparison.Ordinal);
        Assert.Contains("WITH legacy_permissions AS", script, StringComparison.Ordinal);
        Assert.Contains("set_byte", script, StringComparison.Ordinal);
        Assert.Contains("THEN 158", script, StringComparison.Ordinal);
        Assert.Contains("THEN 7", script, StringComparison.Ordinal);
        Assert.Contains("THEN 48", script, StringComparison.Ordinal);
        Assert.Contains("THEN 128", script, StringComparison.Ordinal);
        Assert.Contains("THEN 112", script, StringComparison.Ordinal);
        Assert.Contains("THEN 2", script, StringComparison.Ordinal);
        Assert.Contains("THEN 4", script, StringComparison.Ordinal);

        foreach (var suffix in new[] { "201", "202", "203", "204", "205", "210" })
        {
            Assert.Contains(
                $"24000000-0000-0000-0000-000000000{suffix}",
                script,
                StringComparison.Ordinal);
        }

        Assert.DoesNotContain(
            "DROP TABLE \"server_role_permissions\"",
            script,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            "DELETE FROM \"server_role_permissions\"",
            script,
            StringComparison.Ordinal);
    }

    [Fact]
    public void DowngradeScript_RemovesOnlyTheNewRoleMaskContract()
    {
        using var db = CreatePostgreSqlContext();
        var script = db.GetService<IMigrator>().GenerateScript(
            Migration,
            PreviousMigration);

        Assert.Contains(
            "DROP CONSTRAINT \"CK_ServerRoles_PermissionMaskLength\"",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "DROP CONSTRAINT \"CK_ServerRoles_PermissionSchemaVersion\"",
            script,
            StringComparison.Ordinal);
        Assert.Contains("DROP COLUMN permission_mask", script, StringComparison.Ordinal);
        Assert.Contains(
            "DROP COLUMN permission_schema_version",
            script,
            StringComparison.Ordinal);
        Assert.DoesNotContain("server_role_permissions", script, StringComparison.Ordinal);
    }

    [Fact]
    public void Model_RequiresA32ByteSchemaV1RoleMask()
    {
        using var db = CreatePostgreSqlContext();
        var role = db.GetService<IDesignTimeModel>()
            .Model
            .FindEntityType(typeof(ServerRole))!;
        var mask = role.FindProperty(nameof(ServerRole.PermissionMask))!;
        var schema = role.FindProperty(nameof(ServerRole.PermissionSchemaVersion))!;

        Assert.Equal(typeof(byte[]), mask.ClrType);
        Assert.False(mask.IsNullable);
        Assert.Equal("bytea", mask.GetColumnType());
        Assert.Equal(new byte[32], Assert.IsType<byte[]>(mask.GetDefaultValue()));
        Assert.Equal(typeof(int), schema.ClrType);
        Assert.False(schema.IsNullable);
        Assert.Equal(1, schema.GetDefaultValue());
        Assert.Contains(
            role.GetCheckConstraints(),
            constraint => constraint.Name == "CK_ServerRoles_PermissionMaskLength");
        Assert.Contains(
            role.GetCheckConstraints(),
            constraint =>
                constraint.Name == "CK_ServerRoles_PermissionSchemaVersion");
    }

    private static AppDbContext CreatePostgreSqlContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(
                "Host=127.0.0.1;Port=5432;Database=arcanelink_script_only;" +
                "Username=arcanelink;Password=not-used")
            .Options;
        return new AppDbContext(options);
    }
}
