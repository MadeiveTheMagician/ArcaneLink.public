using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class SpaceReadStatesMigrationTests
{
    private const string PreviousMigration =
        "20260720221812_AddServerMemberBans";
    private const string Migration =
        "20260720224345_AddSpaceReadStates";

    [Fact]
    public void UpgradeScript_AddsReadStateIndexAndBackfillsBothMembershipKinds()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains("CREATE TABLE space_read_states", script, StringComparison.Ordinal);
        Assert.Contains("IX_SpaceMessages_Unread", script, StringComparison.Ordinal);
        Assert.Contains("space_id, created_at, id", script, StringComparison.Ordinal);
        Assert.Contains("FROM server_members AS sm", script, StringComparison.Ordinal);
        Assert.Contains("FROM private_space_members AS psm", script, StringComparison.Ordinal);
        Assert.Contains("INNER JOIN LATERAL", script, StringComparison.Ordinal);
        Assert.DoesNotContain("LEFT JOIN LATERAL", script, StringComparison.Ordinal);
        Assert.Contains(
            "ORDER BY message.created_at DESC, message.id DESC",
            script,
            StringComparison.Ordinal);
        Assert.Contains("latest_message.created_at", script, StringComparison.Ordinal);
        Assert.DoesNotContain("COALESCE", script, StringComparison.Ordinal);
        Assert.Contains(
            "ON CONFLICT (user_id, space_id) DO NOTHING",
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
