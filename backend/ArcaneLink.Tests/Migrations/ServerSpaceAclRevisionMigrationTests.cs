using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class ServerSpaceAclRevisionMigrationTests
{
    private const string PreviousMigration =
        "20260718185131_AddUnifiedSpacePermissions";
    private const string Migration =
        "20260719084842_AddServerSpaceAclRevision";

    [Fact]
    public void UpgradeScript_AddsRequiredPerRowPostgreSqlRevision()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains(
            "ADD space_acl_revision uuid NOT NULL DEFAULT (gen_random_uuid())",
            script,
            StringComparison.Ordinal);
        Assert.Contains(Migration, script, StringComparison.Ordinal);
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
