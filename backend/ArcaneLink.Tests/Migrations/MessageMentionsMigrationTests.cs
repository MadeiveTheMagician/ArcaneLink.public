using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class MessageMentionsMigrationTests
{
    private const string PreviousMigration =
        "20260722163800_WidenPrivateTrashCleanupIndex";
    private const string Migration =
        "20260722223227_AddMessageMentionsAndReplyPreview";

    [Fact]
    public void UpgradeScript_AddsMentionIntegrityAndCascadesMessageNotifications()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains("CREATE TABLE space_message_mentions", script, StringComparison.Ordinal);
        Assert.Contains("CK_SpaceMessageMentions_Kind_Target", script, StringComparison.Ordinal);
        Assert.Contains("CK_SpaceMessageMentions_Range", script, StringComparison.Ordinal);
        Assert.Contains("UX_SpaceMessageMentions_Message_Start", script, StringComparison.Ordinal);
        Assert.Contains("FK_space_message_mentions_space_messages_message_id", script, StringComparison.Ordinal);
        Assert.Contains("ON DELETE CASCADE", script, StringComparison.Ordinal);
        Assert.Contains("FK_user_notifications_space_messages_message_id", script, StringComparison.Ordinal);
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
