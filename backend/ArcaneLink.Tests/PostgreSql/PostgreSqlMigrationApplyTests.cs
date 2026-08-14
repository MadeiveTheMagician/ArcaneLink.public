using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Observability.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace ArcaneLink.Tests.PostgreSql;

[Collection(PostgreSqlCollectionDefinition.Name)]
public sealed class PostgreSqlMigrationApplyTests
{
    private const string BeforeUnifiedAclMigration =
        "20260718160132_NormalizeDirectInviteLifecycle";
    private const string UnifiedAclMigration =
        "20260718185131_AddUnifiedSpacePermissions";
    private const string BeforePrivateSpaceKindsMigration =
        "20260726155651_AddServerAccessModesAndJoinRequests";
    private const string LatestMigration =
        "20260810120030_BackfillServerEveryoneRoles";

    [PostgreSqlFact]
    public async Task CleanDatabase_MigratesToLatest_AndPassesHealthAndModelChecks()
    {
        await using var database = await PostgreSqlEphemeralDatabase.CreateAsync();
        await using var db = database.CreateContext();

        await db.Database.MigrateAsync();

        var knownMigrations = db.Database.GetMigrations().ToArray();
        var appliedMigrations = (await db.Database.GetAppliedMigrationsAsync()).ToArray();
        var pendingMigrations = (await db.Database.GetPendingMigrationsAsync()).ToArray();

        Assert.NotEmpty(knownMigrations);
        Assert.Equal(knownMigrations, appliedMigrations);
        Assert.Empty(pendingMigrations);
        Assert.Equal(LatestMigration, appliedMigrations[^1]);

        var health = await new DatabaseHealthCheck(db).CheckHealthAsync(
            new HealthCheckContext());
        Assert.Equal(HealthStatus.Healthy, health.Status);

        Assert.NotNull(db.Model.FindEntityType(typeof(Server)));
        Assert.True(db.Model.GetEntityTypes().Count() >= 30);
        Assert.True(await CountBaseTablesAsync(database.ConnectionString) >= 30);
        Assert.Equal(
            2,
            await CountDirectMessagePrivacyObjectsAsync(
                database.ConnectionString));
    }

    [PostgreSqlFact]
    public async Task UpgradeFromBeforeUnifiedAcl_CreatesPermissionsIndexesAndPerServerRevisions()
    {
        await using var database = await PostgreSqlEphemeralDatabase.CreateAsync();
        await using var db = database.CreateContext();
        var migrator = db.GetService<IMigrator>();

        await migrator.MigrateAsync(BeforeUnifiedAclMigration);

        var userId = Guid.NewGuid();
        var serverIds = new[] { Guid.NewGuid(), Guid.NewGuid() };
        await SeedUserAndServersAsync(database.ConnectionString, userId, serverIds);
        var duplicateOverrides = await SeedDuplicateOverridesAsync(
            database.ConnectionString,
            userId,
            serverIds[0]);

        await db.Database.MigrateAsync();

        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        var applied = (await db.Database.GetAppliedMigrationsAsync()).ToArray();
        Assert.Contains(UnifiedAclMigration, applied);
        Assert.Equal(LatestMigration, applied[^1]);

        var revisions = await db.Servers
            .AsNoTracking()
            .Where(server => serverIds.Contains(server.Id))
            .OrderBy(server => server.Id)
            .Select(server => server.SpaceAclRevision)
            .ToArrayAsync();
        Assert.Equal(2, revisions.Length);
        Assert.DoesNotContain(Guid.Empty, revisions);
        Assert.Equal(2, revisions.Distinct().Count());

        var accessModes = await db.Servers
            .AsNoTracking()
            .Where(server => serverIds.Contains(server.Id))
            .Select(server => new { server.Id, server.AccessMode })
            .ToDictionaryAsync(server => server.Id, server => server.AccessMode);
        Assert.Equal(ServerAccessModeCodes.Private, accessModes[serverIds[0]]);
        Assert.Equal(ServerAccessModeCodes.Public, accessModes[serverIds[1]]);

        var column = await ReadAclRevisionColumnAsync(database.ConnectionString);
        Assert.Equal("NO", column.IsNullable);
        Assert.Equal("uuid", column.DataType);
        Assert.Contains("gen_random_uuid()", column.DefaultExpression, StringComparison.Ordinal);

        var indexes = await ReadSpaceOverrideIndexesAsync(database.ConnectionString);
        AssertFilteredUniqueIndex(indexes, "IX_SpaceOverrides_Role", "role_id");
        AssertFilteredUniqueIndex(indexes, "IX_SpaceOverrides_Member", "member_id");

        await AssertDuplicateOverridesWereDeduplicatedAsync(
            database.ConnectionString,
            duplicateOverrides);
        await AssertDuplicateOverrideIsRejectedAsync(
            database.ConnectionString,
            duplicateOverrides);

        Assert.Equal(
            4,
            await CountUnifiedAclPermissionsAsync(database.ConnectionString));
        Assert.Equal(3, await CountBanColumnsAsync(database.ConnectionString));
        Assert.Equal(
            2,
            await CountDirectMessagePrivacyObjectsAsync(
                database.ConnectionString));
        Assert.Equal(2, await CountBanAuditTypesAsync(database.ConnectionString));
    }

    [PostgreSqlFact]
    public async Task IdempotentUpgradeScript_CanExecuteTwiceAgainstPreviousMigration()
    {
        await using var database = await PostgreSqlEphemeralDatabase.CreateAsync();
        await using var db = database.CreateContext();
        var migrator = db.GetService<IMigrator>();

        await migrator.MigrateAsync(BeforeUnifiedAclMigration);
        var script = migrator.GenerateScript(
            BeforeUnifiedAclMigration,
            LatestMigration,
            MigrationsSqlGenerationOptions.Idempotent);

        await ExecuteScriptAsync(database.ConnectionString, script);
        await ExecuteScriptAsync(database.ConnectionString, script);

        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.Equal(
            LatestMigration,
            (await db.Database.GetAppliedMigrationsAsync()).Last());
        Assert.Equal(
            4,
            await CountUnifiedAclPermissionsAsync(database.ConnectionString));
        Assert.Equal(3, await CountBanColumnsAsync(database.ConnectionString));
    }

    [PostgreSqlFact]
    public async Task UpgradeHistoricalGroups_SelectsAnActiveOwnerAndUsesSafeFallback()
    {
        await using var database = await PostgreSqlEphemeralDatabase.CreateAsync();
        await using var db = database.CreateContext();
        var migrator = db.GetService<IMigrator>();

        await migrator.MigrateAsync(BeforePrivateSpaceKindsMigration);
        var seed = await SeedHistoricalPrivateSpaceOwnersAsync(
            database.ConnectionString);

        await db.Database.MigrateAsync();

        var owners = await ReadPrivateSpaceOwnersAsync(
            database.ConnectionString,
            [
                seed.DepartedCreatorSpaceId,
                seed.NoActiveMembersSpaceId,
                seed.ActiveCreatorSpaceId
            ]);
        Assert.Equal(
            (seed.EarliestActiveUserId, PrivateSpaceKindCodes.Group),
            owners[seed.DepartedCreatorSpaceId]);
        Assert.Equal(
            (seed.CreatorUserId, PrivateSpaceKindCodes.Group),
            owners[seed.NoActiveMembersSpaceId]);
        Assert.Equal(
            (seed.CreatorUserId, PrivateSpaceKindCodes.Group),
            owners[seed.ActiveCreatorSpaceId]);
    }

    private static async Task SeedUserAndServersAsync(
        string connectionString,
        Guid userId,
        IReadOnlyList<Guid> serverIds)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();

        await using (var userCommand = connection.CreateCommand())
        {
            userCommand.CommandText =
                """
                INSERT INTO users
                    (id, status_id, login, login_norm, email, email_norm,
                     password_hash, created_at, updated_at)
                VALUES
                    (@id, '10000000-0000-0000-0000-000000000000',
                     @login, @login, @email, @email, @password_hash, @now, @now);
                """;
            userCommand.Parameters.AddWithValue("id", userId);
            userCommand.Parameters.AddWithValue("login", $"pg_{userId:N}");
            userCommand.Parameters.AddWithValue("email", $"pg_{userId:N}@example.test");
            userCommand.Parameters.AddWithValue("password_hash", "postgres-test-only");
            userCommand.Parameters.AddWithValue("now", DateTime.UtcNow);
            await userCommand.ExecuteNonQueryAsync();
        }

        for (var index = 0; index < serverIds.Count; index++)
        {
            var serverId = serverIds[index];
            await using var serverCommand = connection.CreateCommand();
            serverCommand.CommandText =
                """
                INSERT INTO servers
                    (id, created_by_user_id, owner_user_id, slug, title,
                     is_public, is_system, created_at, updated_at)
                VALUES
                    (@id, @user_id, @user_id, @slug, @title,
                     @is_public, FALSE, @now, @now);
                """;
            serverCommand.Parameters.AddWithValue("id", serverId);
            serverCommand.Parameters.AddWithValue("user_id", userId);
            serverCommand.Parameters.AddWithValue("slug", $"pg-{serverId:N}");
            serverCommand.Parameters.AddWithValue("title", "PostgreSQL migration test");
            serverCommand.Parameters.AddWithValue(
                "is_public",
                index == serverIds.Count - 1);
            serverCommand.Parameters.AddWithValue("now", DateTime.UtcNow);
            await serverCommand.ExecuteNonQueryAsync();
        }
    }

    private static async Task<HistoricalPrivateSpaceOwnerSeed>
        SeedHistoricalPrivateSpaceOwnersAsync(string connectionString)
    {
        var creatorUserId = Guid.NewGuid();
        var earliestActiveUserId = Guid.NewGuid();
        var laterActiveUserId = Guid.NewGuid();
        var departedCreatorSpaceId = Guid.NewGuid();
        var noActiveMembersSpaceId = Guid.NewGuid();
        var activeCreatorSpaceId = Guid.NewGuid();
        var now = DateTime.UtcNow.AddDays(-2);

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            INSERT INTO users
                (id, status_id, login, login_norm, email, email_norm,
                 password_hash, created_at, updated_at)
            VALUES
                (@creator_user_id,
                 '10000000-0000-0000-0000-000000000000',
                 @creator_login, @creator_login, @creator_email, @creator_email,
                 'postgres-test-only', @now, @now),
                (@earliest_active_user_id,
                 '10000000-0000-0000-0000-000000000000',
                 @earliest_login, @earliest_login, @earliest_email, @earliest_email,
                 'postgres-test-only', @now, @now),
                (@later_active_user_id,
                 '10000000-0000-0000-0000-000000000000',
                 @later_login, @later_login, @later_email, @later_email,
                 'postgres-test-only', @now, @now);

            INSERT INTO spaces
                (id, type_id, created_by_user_id, title, position, is_system,
                 created_at, updated_at)
            VALUES
                (@departed_creator_space_id,
                 '25000000-0000-0000-0000-000000000002',
                 @creator_user_id, 'Departed creator group', 0, FALSE, @now, @now),
                (@no_active_members_space_id,
                 '25000000-0000-0000-0000-000000000002',
                 @creator_user_id, 'No active members group', 0, FALSE, @now, @now),
                (@active_creator_space_id,
                 '25000000-0000-0000-0000-000000000002',
                 @creator_user_id, 'Active creator group', 0, FALSE, @now, @now);

            INSERT INTO private_spaces
                (space_id, created_by_user_id, title, created_at, updated_at)
            VALUES
                (@departed_creator_space_id, @creator_user_id,
                 'Departed creator group', @now, @now),
                (@no_active_members_space_id, @creator_user_id,
                 'No active members group', @now, @now),
                (@active_creator_space_id, @creator_user_id,
                 'Active creator group', @now, @now);

            INSERT INTO private_space_members
                (id, space_id, user_id, status_id, list_position, joined_at,
                 left_at, created_at, updated_at)
            VALUES
                (@departed_creator_member_id, @departed_creator_space_id,
                 @creator_user_id,
                 '26000000-0000-0000-0000-000000000002', 0, @now,
                 @later_at, @now, @later_at),
                (@departed_earliest_member_id, @departed_creator_space_id,
                 @earliest_active_user_id,
                 '26000000-0000-0000-0000-000000000001', 0, @earliest_at,
                 NULL, @earliest_at, @earliest_at),
                (@departed_later_member_id, @departed_creator_space_id,
                 @later_active_user_id,
                 '26000000-0000-0000-0000-000000000001', 0, @later_at,
                 NULL, @later_at, @later_at),
                (@no_active_creator_member_id, @no_active_members_space_id,
                 @creator_user_id,
                 '26000000-0000-0000-0000-000000000003', 0, @now,
                 @earliest_at, @now, @earliest_at),
                (@active_earliest_member_id, @active_creator_space_id,
                 @earliest_active_user_id,
                 '26000000-0000-0000-0000-000000000001', 0, @now,
                 NULL, @now, @now),
                (@active_creator_member_id, @active_creator_space_id,
                 @creator_user_id,
                 '26000000-0000-0000-0000-000000000001', 0, @later_at,
                 NULL, @later_at, @later_at),
                (@active_later_member_id, @active_creator_space_id,
                 @later_active_user_id,
                 '26000000-0000-0000-0000-000000000001', 0, @latest_at,
                 NULL, @latest_at, @latest_at);
            """;
        command.Parameters.AddWithValue("creator_user_id", creatorUserId);
        command.Parameters.AddWithValue(
            "earliest_active_user_id",
            earliestActiveUserId);
        command.Parameters.AddWithValue("later_active_user_id", laterActiveUserId);
        command.Parameters.AddWithValue(
            "departed_creator_space_id",
            departedCreatorSpaceId);
        command.Parameters.AddWithValue(
            "no_active_members_space_id",
            noActiveMembersSpaceId);
        command.Parameters.AddWithValue(
            "active_creator_space_id",
            activeCreatorSpaceId);
        command.Parameters.AddWithValue(
            "creator_login",
            $"owner_creator_{creatorUserId:N}");
        command.Parameters.AddWithValue(
            "creator_email",
            $"owner_creator_{creatorUserId:N}@example.test");
        command.Parameters.AddWithValue(
            "earliest_login",
            $"owner_earliest_{earliestActiveUserId:N}");
        command.Parameters.AddWithValue(
            "earliest_email",
            $"owner_earliest_{earliestActiveUserId:N}@example.test");
        command.Parameters.AddWithValue(
            "later_login",
            $"owner_later_{laterActiveUserId:N}");
        command.Parameters.AddWithValue(
            "later_email",
            $"owner_later_{laterActiveUserId:N}@example.test");
        command.Parameters.AddWithValue("now", now);
        command.Parameters.AddWithValue("earliest_at", now.AddHours(1));
        command.Parameters.AddWithValue("later_at", now.AddHours(2));
        command.Parameters.AddWithValue("latest_at", now.AddHours(3));
        foreach (var parameterName in new[]
                 {
                     "departed_creator_member_id",
                     "departed_earliest_member_id",
                     "departed_later_member_id",
                     "no_active_creator_member_id",
                     "active_earliest_member_id",
                     "active_creator_member_id",
                     "active_later_member_id"
                 })
        {
            command.Parameters.AddWithValue(parameterName, Guid.NewGuid());
        }
        await command.ExecuteNonQueryAsync();

        return new HistoricalPrivateSpaceOwnerSeed(
            departedCreatorSpaceId,
            noActiveMembersSpaceId,
            activeCreatorSpaceId,
            creatorUserId,
            earliestActiveUserId);
    }

    private static async Task<
        IReadOnlyDictionary<Guid, (Guid OwnerUserId, string Kind)>>
        ReadPrivateSpaceOwnersAsync(
            string connectionString,
            Guid[] spaceIds)
    {
        var result =
            new Dictionary<Guid, (Guid OwnerUserId, string Kind)>();
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT space_id, owner_user_id, kind
            FROM private_spaces
            WHERE space_id = ANY (@space_ids);
            """;
        command.Parameters.AddWithValue("space_ids", spaceIds);
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            result.Add(
                reader.GetGuid(0),
                (reader.GetGuid(1), reader.GetString(2)));
        }

        return result;
    }

    private static async Task<DuplicateOverrideSeed> SeedDuplicateOverridesAsync(
        string connectionString,
        Guid userId,
        Guid serverId)
    {
        var memberId = Guid.NewGuid();
        var roleId = Guid.NewGuid();
        var spaceId = Guid.NewGuid();
        var permissionId = Guid.Parse("24000000-0000-0000-0000-000000000205");
        var newestRoleOverrideId = Guid.NewGuid();
        var newestMemberOverrideId = Guid.NewGuid();
        var olderAt = DateTime.UtcNow.AddMinutes(-1);
        var newerAt = DateTime.UtcNow;

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            INSERT INTO server_members
                (id, server_id, user_id, status_id, joined_at, created_at, updated_at)
            VALUES
                (@member_id, @server_id, @user_id,
                 '40000000-0000-0000-0000-000000000000',
                 @older_at, @older_at, @older_at);

            INSERT INTO server_roles
                (id, server_id, code, title, level, is_system, created_at, updated_at)
            VALUES
                (@role_id, @server_id, @role_code, 'Migration role',
                 100, FALSE, @older_at, @older_at);

            INSERT INTO spaces
                (id, server_id, type_id, created_by_user_id, title,
                 position, is_system, created_at, updated_at)
            VALUES
                (@space_id, @server_id,
                 '25000000-0000-0000-0000-000000000002',
                 @user_id, 'Migration space',
                 0, FALSE, @older_at, @older_at);

            INSERT INTO space_permission_overrides
                (id, space_id, role_id, member_id, permission_id,
                 allow, deny, created_at)
            VALUES
                (@old_role_override_id, @space_id, @role_id, NULL, @permission_id,
                 TRUE, FALSE, @older_at),
                (@new_role_override_id, @space_id, @role_id, NULL, @permission_id,
                 FALSE, TRUE, @newer_at),
                (@old_member_override_id, @space_id, NULL, @member_id, @permission_id,
                 TRUE, FALSE, @older_at),
                (@new_member_override_id, @space_id, NULL, @member_id, @permission_id,
                 FALSE, TRUE, @newer_at);
            """;
        command.Parameters.AddWithValue("member_id", memberId);
        command.Parameters.AddWithValue("server_id", serverId);
        command.Parameters.AddWithValue("user_id", userId);
        command.Parameters.AddWithValue("role_id", roleId);
        command.Parameters.AddWithValue("role_code", roleId.ToString("N"));
        command.Parameters.AddWithValue("space_id", spaceId);
        command.Parameters.AddWithValue("permission_id", permissionId);
        command.Parameters.AddWithValue("old_role_override_id", Guid.NewGuid());
        command.Parameters.AddWithValue("new_role_override_id", newestRoleOverrideId);
        command.Parameters.AddWithValue("old_member_override_id", Guid.NewGuid());
        command.Parameters.AddWithValue("new_member_override_id", newestMemberOverrideId);
        command.Parameters.AddWithValue("older_at", olderAt);
        command.Parameters.AddWithValue("newer_at", newerAt);
        await command.ExecuteNonQueryAsync();

        return new DuplicateOverrideSeed(
            spaceId,
            roleId,
            memberId,
            permissionId,
            newestRoleOverrideId,
            newestMemberOverrideId);
    }

    private static async Task AssertDuplicateOverridesWereDeduplicatedAsync(
        string connectionString,
        DuplicateOverrideSeed seed)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT id, role_id, member_id, allow, deny
            FROM space_permission_overrides
            WHERE space_id = @space_id
              AND permission_id = @permission_id
            ORDER BY role_id NULLS LAST, member_id NULLS LAST;
            """;
        command.Parameters.AddWithValue("space_id", seed.SpaceId);
        command.Parameters.AddWithValue("permission_id", seed.PermissionId);

        var retainedIds = new List<Guid>();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            retainedIds.Add(reader.GetGuid(0));
            Assert.False(reader.GetBoolean(3));
            Assert.True(reader.GetBoolean(4));
        }

        Assert.Equal(2, retainedIds.Count);
        Assert.Contains(seed.NewestRoleOverrideId, retainedIds);
        Assert.Contains(seed.NewestMemberOverrideId, retainedIds);
    }

    private static async Task AssertDuplicateOverrideIsRejectedAsync(
        string connectionString,
        DuplicateOverrideSeed seed)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            INSERT INTO space_permission_overrides
                (id, space_id, role_id, member_id, permission_id,
                 allow, deny, created_at)
            VALUES
                (@id, @space_id, @role_id, NULL, @permission_id,
                 TRUE, FALSE, @created_at);
            """;
        command.Parameters.AddWithValue("id", Guid.NewGuid());
        command.Parameters.AddWithValue("space_id", seed.SpaceId);
        command.Parameters.AddWithValue("role_id", seed.RoleId);
        command.Parameters.AddWithValue("permission_id", seed.PermissionId);
        command.Parameters.AddWithValue("created_at", DateTime.UtcNow);

        var exception = await Assert.ThrowsAsync<PostgresException>(
            () => command.ExecuteNonQueryAsync());
        Assert.Equal(PostgresErrorCodes.UniqueViolation, exception.SqlState);
    }

    private static async Task<int> CountBaseTablesAsync(string connectionString)
    {
        const string sql =
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_type = 'BASE TABLE';
            """;
        return Convert.ToInt32(await ExecuteScalarAsync(connectionString, sql));
    }

    private static async Task<int> CountUnifiedAclPermissionsAsync(string connectionString)
    {
        const string sql =
            """
            SELECT COUNT(*)
            FROM permission_catalog
            WHERE code IN ('view_space', 'send_messages', 'connect_voice', 'manage_space');
            """;
        return Convert.ToInt32(await ExecuteScalarAsync(connectionString, sql));
    }

    private static async Task<int> CountBanColumnsAsync(string connectionString)
    {
        const string sql =
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'server_members'
              AND column_name IN ('banned_at', 'banned_by_user_id', 'ban_reason');
            """;
        return Convert.ToInt32(await ExecuteScalarAsync(connectionString, sql));
    }

    private static async Task<int> CountDirectMessagePrivacyObjectsAsync(
        string connectionString)
    {
        const string sql =
            """
            SELECT
                (
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'user_profile_settings'
                      AND column_name = 'direct_message_permission'
                ) +
                (
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'user_direct_message_blocks'
                );
            """;
        return Convert.ToInt32(await ExecuteScalarAsync(connectionString, sql));
    }

    private static async Task<int> CountBanAuditTypesAsync(string connectionString)
    {
        const string sql =
            """
            SELECT COUNT(*)
            FROM server_audit_event_types
            WHERE code IN ('member_banned', 'member_unbanned');
            """;
        return Convert.ToInt32(await ExecuteScalarAsync(connectionString, sql));
    }

    private static async Task<(string IsNullable, string DataType, string DefaultExpression)>
        ReadAclRevisionColumnAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT is_nullable, data_type, column_default
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'servers'
              AND column_name = 'space_acl_revision';
            """;
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        return (reader.GetString(0), reader.GetString(1), reader.GetString(2));
    }

    private static async Task<IReadOnlyDictionary<string, string>>
        ReadSpaceOverrideIndexesAsync(string connectionString)
    {
        var indexes = new Dictionary<string, string>(StringComparer.Ordinal);
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = current_schema()
              AND tablename = 'space_permission_overrides'
              AND indexname IN ('IX_SpaceOverrides_Role', 'IX_SpaceOverrides_Member');
            """;
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            indexes.Add(reader.GetString(0), reader.GetString(1));
        }

        return indexes;
    }

    private static void AssertFilteredUniqueIndex(
        IReadOnlyDictionary<string, string> indexes,
        string indexName,
        string targetColumn)
    {
        Assert.True(indexes.TryGetValue(indexName, out var definition));
        Assert.Contains("CREATE UNIQUE INDEX", definition, StringComparison.Ordinal);
        Assert.Contains($"{targetColumn} IS NOT NULL", definition, StringComparison.Ordinal);
    }

    private static async Task ExecuteScriptAsync(
        string connectionString,
        string script)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = script;
        command.CommandTimeout = 120;
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<object?> ExecuteScalarAsync(
        string connectionString,
        string sql)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return await command.ExecuteScalarAsync();
    }

    private sealed record DuplicateOverrideSeed(
        Guid SpaceId,
        Guid RoleId,
        Guid MemberId,
        Guid PermissionId,
        Guid NewestRoleOverrideId,
        Guid NewestMemberOverrideId);

    private sealed record HistoricalPrivateSpaceOwnerSeed(
        Guid DepartedCreatorSpaceId,
        Guid NoActiveMembersSpaceId,
        Guid ActiveCreatorSpaceId,
        Guid CreatorUserId,
        Guid EarliestActiveUserId);
}
