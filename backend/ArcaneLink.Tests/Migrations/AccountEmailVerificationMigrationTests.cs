using ArcaneLink.DataBase._Data;
using ArcaneLink.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class AccountEmailVerificationMigrationTests
{
    [Fact]
    public void Migration_BackfillsExistingAccounts_AndMakesDownForeignKeySafe()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(
                "Host=localhost;Database=arcanelink;Username=arcanelink;Password=not-used")
            .Options;
        using var db = new AppDbContext(options);
        var migration = new AddAccountEmailVerificationAndRecovery();
        var sqlGenerator = db.GetService<IMigrationsSqlGenerator>();

        var upSql = string.Join(
            Environment.NewLine,
            sqlGenerator.Generate(
                migration.UpOperations,
                db.Model)
                .Select(x => x.CommandText));
        var downSql = string.Join(
            Environment.NewLine,
            sqlGenerator.Generate(
                migration.DownOperations,
                db.Model)
                .Select(x => x.CommandText));

        Assert.Contains(
            "UPDATE users SET email_confirmed_at = COALESCE(updated_at, created_at)",
            upSql,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains(
            "UPDATE users SET status_id = '10000000-0000-0000-0000-000000000000'",
            downSql,
            StringComparison.OrdinalIgnoreCase);
        Assert.True(
            downSql.IndexOf("UPDATE users SET status_id", StringComparison.OrdinalIgnoreCase) <
            downSql.IndexOf("DELETE FROM user_statuses", StringComparison.OrdinalIgnoreCase),
            "Pending accounts must be reactivated before the pending status row is deleted.");
        Assert.Contains(
            "UX_UserAccountActionTokens_User_Purpose_Active",
            upSql,
            StringComparison.Ordinal);
        Assert.Contains("WHERE consumed_at IS NULL", upSql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("CREATE TABLE email_outbox_messages", upSql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("protected_payload", upSql, StringComparison.OrdinalIgnoreCase);
    }
}
