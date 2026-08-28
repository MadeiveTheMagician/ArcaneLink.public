using ArcaneLink.DataBase._Data;
using ArcaneLink.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class GraphiteAndSnowSystemThemesMigrationTests
{
    [Fact]
    public void NeutralPaletteMigration_UpdatesAndRestoresOnlyGraphiteSeedColors()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(
                "Host=localhost;Database=arcanelink;Username=arcanelink;Password=not-used")
            .Options;
        using var db = new AppDbContext(options);
        var migration = new NeutralizeGraphiteSystemThemePalette();
        var sqlGenerator = db.GetService<IMigrationsSqlGenerator>();

        var upSql = string.Join(
            Environment.NewLine,
            sqlGenerator.Generate(migration.UpOperations, db.Model)
                .Select(command => command.CommandText));
        var downSql = string.Join(
            Environment.NewLine,
            sqlGenerator.Generate(migration.DownOperations, db.Model)
                .Select(command => command.CommandText));

        Assert.Contains(
            "41000000-0000-0000-0000-000000000008",
            upSql,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains("#121212", upSql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("#666666", upSql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("#313131", upSql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(
            "41000000-0000-0000-0000-000000000009",
            upSql,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains("#111214", downSql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("#5f6dcc", downSql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("#313338", downSql, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Down_ReassignsSelectedThemesBeforeDeletingSeedRows()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(
                "Host=localhost;Database=arcanelink;Username=arcanelink;Password=not-used")
            .Options;
        using var db = new AppDbContext(options);
        var migration = new AddGraphiteAndSnowSystemThemes();
        var sqlGenerator = db.GetService<IMigrationsSqlGenerator>();

        var downSql = string.Join(
            Environment.NewLine,
            sqlGenerator.Generate(migration.DownOperations, db.Model)
                .Select(command => command.CommandText));

        var reassignIndex = downSql.IndexOf(
            "UPDATE user_profile_settings",
            StringComparison.OrdinalIgnoreCase);
        var deleteIndex = downSql.IndexOf(
            "DELETE FROM system_themes",
            StringComparison.OrdinalIgnoreCase);

        Assert.True(reassignIndex >= 0, "Theme selections must be reassigned during rollback.");
        Assert.True(
            deleteIndex > reassignIndex,
            "Theme selections must be reassigned before seeded themes are deleted.");
        Assert.Contains(
            "41000000-0000-0000-0000-000000000001",
            downSql,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains(
            "41000000-0000-0000-0000-000000000008",
            downSql,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains(
            "41000000-0000-0000-0000-000000000009",
            downSql,
            StringComparison.OrdinalIgnoreCase);
    }
}
