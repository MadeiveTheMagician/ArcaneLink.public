using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class UserPresencePrivacyMigrationTests
{
    private const string PreviousMigration =
        "20260720224345_AddSpaceReadStates";
    private const string Migration =
        "20260720231717_AddUserPresencePrivacy";

    [Fact]
    public void UpgradeScript_BackfillsSafeDefaultsAndAddsDomainChecks()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains("ADD presence_visibility character varying(16) NOT NULL DEFAULT 'everyone'", script, StringComparison.Ordinal);
        Assert.Contains("ADD show_last_seen boolean NOT NULL DEFAULT TRUE", script, StringComparison.Ordinal);
        Assert.Contains("ADD presence_mode character varying(16) NOT NULL DEFAULT 'automatic'", script, StringComparison.Ordinal);
        Assert.Contains("CK_UserProfileSettings_PresenceVisibility", script, StringComparison.Ordinal);
        Assert.Contains("presence_visibility IN ('everyone', 'friends', 'nobody')", script, StringComparison.Ordinal);
        Assert.Contains("CK_UserProfileSettings_PresenceMode", script, StringComparison.Ordinal);
        Assert.Contains("presence_mode IN ('automatic', 'invisible')", script, StringComparison.Ordinal);
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
