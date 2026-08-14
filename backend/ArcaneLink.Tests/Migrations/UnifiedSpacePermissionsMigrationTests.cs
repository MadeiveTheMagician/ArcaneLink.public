using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class UnifiedSpacePermissionsMigrationTests
{
    private const string PreviousMigration =
        "20260718160132_NormalizeDirectInviteLifecycle";
    private const string Migration =
        "20260718185131_AddUnifiedSpacePermissions";

    [Fact]
    public void UpgradeScript_IsPostgreSqlIdempotent_AndCreatesFilteredUniqueness()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains("ROW_NUMBER() OVER", script, StringComparison.Ordinal);
        Assert.Contains(
            "PARTITION BY \"space_id\", \"role_id\", \"permission_id\"",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "PARTITION BY \"space_id\", \"member_id\", \"permission_id\"",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CREATE UNIQUE INDEX \"IX_SpaceOverrides_Role\"",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CREATE UNIQUE INDEX \"IX_SpaceOverrides_Member\"",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "WHERE \"role_id\" IS NOT NULL",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "WHERE \"member_id\" IS NOT NULL",
            script,
            StringComparison.Ordinal);
        Assert.Contains("view_space", script, StringComparison.Ordinal);
        Assert.Contains("manage_space", script, StringComparison.Ordinal);
    }

    [Fact]
    public void DowngradeScript_RemovesDependentRowsBeforePermissionCatalog()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(Migration, PreviousMigration);
        var overrideDelete = script.IndexOf(
            "DELETE FROM \"space_permission_overrides\"",
            StringComparison.Ordinal);
        var rolePermissionDelete = script.IndexOf(
            "DELETE FROM \"server_role_permissions\"",
            StringComparison.Ordinal);
        var catalogDelete = script.IndexOf(
            "DELETE FROM permission_catalog",
            StringComparison.Ordinal);

        Assert.True(overrideDelete >= 0);
        Assert.True(rolePermissionDelete > overrideDelete);
        Assert.True(catalogDelete > rolePermissionDelete);
        Assert.Contains(
            "CREATE INDEX \"IX_SpaceOverrides_Role\"",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CREATE INDEX \"IX_SpaceOverrides_Member\"",
            script,
            StringComparison.Ordinal);
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
