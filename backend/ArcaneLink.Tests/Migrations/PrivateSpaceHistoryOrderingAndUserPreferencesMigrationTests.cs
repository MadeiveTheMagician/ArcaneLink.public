using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class PrivateSpaceHistoryOrderingAndUserPreferencesMigrationTests
{
    private const string PreviousMigration =
        "20260728105604_AddPrivateSpaceKindsAndPersonalSettings";
    private const string Migration =
        "20260729121553_AddPrivateSpaceHistoryOrderingAndUserPreferences";

    [Fact]
    public void UpgradeScript_BackfillsActivityBeforeMakingColumnsRequired()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        var memberBackfillIndex = script.IndexOf(
            "UPDATE private_space_members",
            StringComparison.Ordinal);
        var memberRequiredIndex = script.IndexOf(
            "ALTER TABLE private_space_members ALTER COLUMN list_activity_at SET NOT NULL",
            StringComparison.Ordinal);
        var folderBackfillIndex = script.IndexOf(
            "UPDATE private_space_folder_items",
            StringComparison.Ordinal);
        var folderRequiredIndex = script.IndexOf(
            "ALTER TABLE private_space_folder_items ALTER COLUMN activity_at SET NOT NULL",
            StringComparison.Ordinal);

        Assert.True(memberBackfillIndex >= 0, script);
        Assert.True(memberRequiredIndex > memberBackfillIndex, script);
        Assert.True(folderBackfillIndex >= 0, script);
        Assert.True(folderRequiredIndex > folderBackfillIndex, script);
        Assert.Contains(
            "COALESCE(updated_at, joined_at, created_at, NOW())",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "COALESCE(created_at, NOW())",
            script,
            StringComparison.Ordinal);
        Assert.Contains("history_cleared_at", script, StringComparison.Ordinal);
        Assert.Contains("hidden_from_list_at", script, StringComparison.Ordinal);
        Assert.Contains("is_order_locked", script, StringComparison.Ordinal);
        Assert.Contains("show_private_read_all_button", script, StringComparison.Ordinal);
        Assert.Contains("private_message_display_format", script, StringComparison.Ordinal);
        Assert.Contains("server_message_display_format", script, StringComparison.Ordinal);
        Assert.Contains(
            "CK_UserProfileSettings_PrivateMessageDisplayFormat",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CK_UserProfileSettings_ServerMessageDisplayFormat",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "IX_PrivateSpaceMembers_User_Status_Visibility_Activity",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "IX_PrivateSpaceFolderItems_Folder_Activity",
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
