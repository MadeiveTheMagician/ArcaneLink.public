using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class ServerMemberBansMigrationTests
{
    private const string PreviousMigration =
        "20260719084842_AddServerSpaceAclRevision";
    private const string Migration =
        "20260720221812_AddServerMemberBans";

    [Fact]
    public void UpgradeScript_AddsNullableBanMetadataAuditTypesAndIndexes()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains("ADD ban_reason character varying(500)", script, StringComparison.Ordinal);
        Assert.Contains("ADD banned_at timestamp with time zone", script, StringComparison.Ordinal);
        Assert.Contains("ADD banned_by_user_id uuid", script, StringComparison.Ordinal);
        Assert.Contains("member_banned", script, StringComparison.Ordinal);
        Assert.Contains("member_unbanned", script, StringComparison.Ordinal);
        Assert.Contains("IX_ServerMembers_Server_Status_BannedAt", script, StringComparison.Ordinal);
        Assert.Contains("FK_server_members_users_banned_by_user_id", script, StringComparison.Ordinal);
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
