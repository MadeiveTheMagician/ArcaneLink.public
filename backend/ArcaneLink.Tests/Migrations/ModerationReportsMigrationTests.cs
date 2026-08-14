using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class ModerationReportsMigrationTests
{
    private const string PreviousMigration =
        "20260720231717_AddUserPresencePrivacy";
    private const string Migration =
        "20260721190147_AddModerationReports";

    [Fact]
    public void UpgradeScript_AddsRetainedEvidencePermissionAndOwnerBackfill()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains("CREATE TABLE moderation_cases", script, StringComparison.Ordinal);
        Assert.Contains("CREATE TABLE moderation_submissions", script, StringComparison.Ordinal);
        Assert.Contains("CREATE TABLE moderation_evidence", script, StringComparison.Ordinal);
        Assert.Contains("CREATE TABLE moderation_evidence_assets", script, StringComparison.Ordinal);
        Assert.Contains("CREATE TABLE moderation_case_actions", script, StringComparison.Ordinal);
        Assert.Contains("UX_ModerationCases_Message", script, StringComparison.Ordinal);
        Assert.Contains("UX_ModerationSubmissions_Case_Reporter", script, StringComparison.Ordinal);
        Assert.Contains("ON DELETE RESTRICT", script, StringComparison.Ordinal);
        Assert.Contains("manage_reports", script, StringComparison.Ordinal);
        Assert.Contains("24000000-0000-0000-0000-000000000210", script, StringComparison.Ordinal);
        Assert.Contains("INSERT INTO server_role_permissions", script, StringComparison.Ordinal);
        Assert.Contains("role.code = 'owner'", script, StringComparison.Ordinal);
        Assert.Contains("ON CONFLICT (role_id, permission_id)", script, StringComparison.Ordinal);
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
