using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class PrivateSpaceKindsAndPersonalSettingsMigrationTests
{
    private const string PreviousMigration =
        "20260726155651_AddServerAccessModesAndJoinRequests";
    private const string Migration =
        "20260728105604_AddPrivateSpaceKindsAndPersonalSettings";

    [Fact]
    public void UpgradeScript_BackfillsKindsBeforeAddingDirectPairIntegrity()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        var backfillIndex = script.IndexOf(
            "UPDATE private_spaces",
            StringComparison.Ordinal);
        var notNullIndex = script.IndexOf(
            "ALTER TABLE private_spaces ALTER COLUMN kind SET NOT NULL",
            StringComparison.Ordinal);
        var uniqueIndex = script.IndexOf(
            "CREATE UNIQUE INDEX \"UX_PrivateSpaces_DirectPair\"",
            StringComparison.Ordinal);
        var constraintIndex = script.IndexOf(
            "ADD CONSTRAINT \"CK_PrivateSpaces_DirectPair\"",
            StringComparison.Ordinal);
        var ownerForeignKeyIndex = script.IndexOf(
            "ADD CONSTRAINT \"FK_private_spaces_users_owner_user_id\"",
            StringComparison.Ordinal);
        var backfillSql = backfillIndex < 0
            ? string.Empty
            : script.Substring(
                backfillIndex,
                Math.Min(1800, script.Length - backfillIndex));

        Assert.True(backfillIndex >= 0);
        Assert.True(notNullIndex > backfillIndex);
        Assert.True(uniqueIndex > backfillIndex);
        Assert.True(constraintIndex > backfillIndex);
        Assert.True(ownerForeignKeyIndex > backfillIndex);
        Assert.True(
            backfillSql.Contains(
                "owner_user_id = COALESCE",
                StringComparison.Ordinal),
            backfillSql);
        Assert.Contains("member.status_id =", backfillSql, StringComparison.Ordinal);
        Assert.Contains(
            "'26000000-0000-0000-0000-000000000001'",
            backfillSql,
            StringComparison.Ordinal);
        Assert.Contains(
            "WHEN member.user_id =",
            backfillSql,
            StringComparison.Ordinal);
        Assert.Contains("THEN 0", backfillSql, StringComparison.Ordinal);
        Assert.Contains("member.joined_at", backfillSql, StringComparison.Ordinal);
        Assert.Contains("member.created_at", backfillSql, StringComparison.Ordinal);
        Assert.Contains("member.id", backfillSql, StringComparison.Ordinal);
        Assert.Contains("LIMIT 1", backfillSql, StringComparison.Ordinal);
        Assert.Contains("HAVING COUNT(*) = 2", script, StringComparison.Ordinal);
        Assert.Contains("ROW_NUMBER() OVER", script, StringComparison.Ordinal);
        Assert.Contains("candidate.created_at", script, StringComparison.Ordinal);
        Assert.Contains("candidate.space_id", script, StringComparison.Ordinal);
        Assert.Contains("candidate.pair_rank = 1", script, StringComparison.Ordinal);
        Assert.Contains(
            "direct_user_low_id < direct_user_high_id",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_private_spaces_users_direct_user_low_id",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_private_spaces_users_direct_user_high_id",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_private_spaces_assets_avatar_asset_id",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_private_space_members_assets_peer_avatar_asset_id",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CK_PrivateSpaceMembers_Mute",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "IX_PrivateSpaceFolderItems_Folder_PinnedAt",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "CREATE TABLE private_message_recipients",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "INSERT INTO private_message_recipients",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "member.joined_at <= message.created_at",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "member.left_at >= message.created_at",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "IX_PrivateMessageRecipients_User_Message",
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
