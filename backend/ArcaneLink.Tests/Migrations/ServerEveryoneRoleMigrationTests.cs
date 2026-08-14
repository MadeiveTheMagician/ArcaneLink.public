using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class ServerEveryoneRoleMigrationTests
{
    private const string PreviousMigration =
        "20260810105822_AddServerRolePermissionMasks";
    private const string Migration =
        "20260810120030_BackfillServerEveryoneRoles";

    [Fact]
    public void UpgradeScript_BackfillsOneValidatedDefaultRolePerActiveServer()
    {
        using var db = CreatePostgreSqlContext();
        var script = db.GetService<IMigrator>().GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains("more than one active everyone role", script);
        Assert.Contains("reserved everyone role code or title", script);
        Assert.Contains("INSERT INTO \"server_roles\"", script);
        Assert.Contains("'everyone'", script);
        Assert.Contains("'@everyone'", script);
        Assert.Contains("decode('ffe721'", script);
        Assert.Contains("2147483647", script);
        Assert.Contains("NOT EXISTS", script);
    }

    [Fact]
    public void DowngradeScript_RemovesOnlyMigrationOwnedEveryoneRoles()
    {
        using var db = CreatePostgreSqlContext();
        var script = db.GetService<IMigrator>().GenerateScript(
            Migration,
            PreviousMigration);

        Assert.Contains("DELETE FROM \"server_roles\"", script);
        Assert.Contains("\"kind\" = 'everyone'", script);
        Assert.Contains("\"code\" = 'everyone'", script);
        Assert.Contains("\"created_by_user_id\" IS NULL", script);
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
