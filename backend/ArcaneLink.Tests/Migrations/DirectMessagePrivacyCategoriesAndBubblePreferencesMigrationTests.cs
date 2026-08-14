using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class DirectMessagePrivacyCategoriesAndBubblePreferencesMigrationTests
{
    private const string PreviousMigration =
        "20260729121553_AddPrivateSpaceHistoryOrderingAndUserPreferences";
    private const string Migration =
        "20260729145028_AddDirectMessagePrivacyCategoriesAndBubblePreferences";

    [Fact]
    public void UpgradeScript_PreservesLegacyPrivacyAndAddsBubblePreferences()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains(
            "character varying(64)",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "direct_message_permission LIKE 'custom:%'",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "server_message_bubble_alignment",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "private_message_bubble_alignment",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "server_message_bubble_width",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "private_message_bubble_width",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "DEFAULT 'own-right'",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "DEFAULT 'standard'",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CK_UserProfileSettings_ServerMessageBubbleAlignment",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CK_UserProfileSettings_PrivateMessageBubbleAlignment",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CK_UserProfileSettings_ServerMessageBubbleWidth",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CK_UserProfileSettings_PrivateMessageBubbleWidth",
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
