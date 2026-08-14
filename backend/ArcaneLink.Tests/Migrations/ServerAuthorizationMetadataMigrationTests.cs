using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ArcaneLink.Tests.Migrations;

public sealed class ServerAuthorizationMetadataMigrationTests
{
    private const string PreviousMigration =
        "20260805160558_AddVoiceChatCompanionsAndPresenceVisibilityCategories";
    private const string Migration =
        "20260809204948_AddServerAuthorizationMetadata";

    [Fact]
    public void UpgradeScript_BackfillsRevisionsAndAddsScopedIntegrityWithoutReplacingLegacyRbac()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        Assert.Contains(
            "SET \"authorization_version\" = \"space_acl_revision\"",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "SET \"server_id\" = space.\"server_id\"",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "ALTER COLUMN server_id SET NOT NULL",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "Cannot scope space permission overrides whose space is missing or private.",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_ServerMemberRoles_Server_MemberScope",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_ServerMemberRoles_Server_RoleScope",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_ServerMembers_Server_DisplayColorRoleScope",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_Spaces_Server_RequiredRoleScope",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_Spaces_Server_CreatedWithRoleScope",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_Spaces_Server_ProtectionRoleScope",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_SpaceOverrides_Server_SpaceScope",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_SpaceOverrides_Server_RoleScope",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_SpaceOverrides_Server_MemberScope",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "FK_SpaceOverrides_Server_ProtectionRoleScope",
            script,
            StringComparison.Ordinal);
        Assert.Contains("UX_Spaces_Server_Id", script, StringComparison.Ordinal);
        Assert.Contains("CK_Spaces_ServerRoleScope", script, StringComparison.Ordinal);
        Assert.DoesNotContain(
            "DROP TABLE \"server_role_permissions\"",
            script,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            "DROP TABLE \"space_permission_overrides\"",
            script,
            StringComparison.Ordinal);
        Assert.DoesNotContain("permission_mask", script, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("allow_mask", script, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("deny_mask", script, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void DowngradeScript_DropsScopedConstraintsBeforeMetadataColumns()
    {
        using var db = CreatePostgreSqlContext();
        var migrator = db.GetService<IMigrator>();

        var script = migrator.GenerateScript(Migration, PreviousMigration);
        var scopedConstraintDrop = script.IndexOf(
            "DROP CONSTRAINT IF EXISTS \"FK_SpaceOverrides_Server_SpaceScope\"",
            StringComparison.Ordinal);
        var serverIdDrop = script.IndexOf(
            "DROP COLUMN server_id",
            StringComparison.Ordinal);

        Assert.True(scopedConstraintDrop >= 0);
        Assert.True(serverIdDrop > scopedConstraintDrop);
        Assert.Contains(
            "DROP CONSTRAINT IF EXISTS \"FK_ServerMemberRoles_Server_MemberScope\"",
            script,
            StringComparison.Ordinal);
        Assert.Contains(
            "DROP COLUMN authorization_version",
            script,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Model_ExposesRevisionMetadataAndRoleEditConcurrency()
    {
        using var db = CreatePostgreSqlContext();
        var model = db.Model;

        AssertRevisionProperty<Server>(model, nameof(Server.AuthorizationVersion));
        AssertRevisionProperty<ServerRole>(
            model,
            nameof(ServerRole.Version),
            isConcurrencyToken: true);
        AssertRevisionProperty<ServerMember>(model, nameof(ServerMember.RolesVersion));
        AssertRevisionProperty<Space>(model, nameof(Space.Version));
        AssertRevisionProperty<SpacePermissionOverride>(
            model,
            nameof(SpacePermissionOverride.Version));

        var role = model.FindEntityType(typeof(ServerRole))!;
        Assert.Equal(16, role.FindProperty(nameof(ServerRole.Kind))!.GetMaxLength());
        Assert.Equal(9, role.FindProperty(nameof(ServerRole.Color))!.GetMaxLength());
        Assert.False(role.FindProperty(nameof(ServerRole.Mentionable))!.IsNullable);

        var member = model.FindEntityType(typeof(ServerMember))!;
        Assert.Equal(
            "auto",
            member.FindProperty(nameof(ServerMember.DisplayColorMode))!.GetDefaultValue());

        var permissionOverride = model.FindEntityType(typeof(SpacePermissionOverride))!;
        Assert.False(permissionOverride.FindProperty(nameof(SpacePermissionOverride.ServerId))!.IsNullable);
    }

    private static void AssertRevisionProperty<TEntity>(
        IModel model,
        string propertyName,
        bool isConcurrencyToken = false)
    {
        var property = model.FindEntityType(typeof(TEntity))!.FindProperty(propertyName)!;

        Assert.Equal(typeof(Guid), property.ClrType);
        Assert.False(property.IsNullable);
        Assert.Equal(isConcurrencyToken, property.IsConcurrencyToken);
        Assert.Equal("gen_random_uuid()", property.GetDefaultValueSql());
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
