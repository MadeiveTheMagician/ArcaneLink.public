using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerPermissionV1ContractIntegrationTests
{
    private const int PermissionSchemaVersion = 1;
    private const string CatalogPath = "/api/permissions/server/v1";

    private static readonly string[] CrossGroupPermissionCodes =
    [
        "VIEW_TEXT_SPACES",
        "SEND_MESSAGES",
        "CONNECT_VOICE",
        "KICK_MEMBERS",
        "MANAGE_ROLES",
        "CREATE_PUBLIC_TEXT_SPACES",
        "MANAGE_SERVER_SETTINGS"
    ];

    [Fact]
    public async Task CatalogV1_ReturnsTheCompleteStablePermissionSchema()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var response = await client.GetAsync(CatalogPath);

        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var catalog = (await response.Content
            .ReadFromJsonAsync<PermissionCatalogV1Response>())!;

        Assert.Equal(PermissionSchemaVersion, catalog.PermissionSchemaVersion);
        Assert.Equal(51, catalog.Permissions.Count);
        Assert.Equal(
            Enumerable.Range(0, 51),
            catalog.Permissions.Select(permission => permission.Bit).Order());
        Assert.Equal(
            catalog.Permissions.Count,
            catalog.Permissions.Select(permission => permission.Bit).Distinct().Count());
        Assert.Equal(
            catalog.Permissions.Count,
            catalog.Permissions
                .Select(permission => permission.Code)
                .Distinct(StringComparer.Ordinal)
                .Count());
        Assert.All(
            catalog.Permissions,
            permission => Assert.Equal(
                permission.Code.ToUpperInvariant(),
                permission.Code));
        Assert.Equal(
            ["access", "members", "messaging", "roles", "server", "spaces", "voice"],
            catalog.Permissions
                .Select(permission => permission.Group)
                .Distinct(StringComparer.Ordinal)
                .Order(StringComparer.Ordinal));

        var administrator = Assert.Single(
            catalog.Permissions,
            permission => permission.Code == "ADMINISTRATOR");
        Assert.Equal(31, administrator.Bit);
        Assert.Equal("roles", administrator.Group);
    }

    [Fact]
    public async Task RoleV1_CreateAndUnifiedUpdate_RoundTripCanonicalPermissionsAcrossGroups()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var created = await CreateRoleAsync(
            client,
            "Cross-group role",
            CrossGroupPermissionCodes);

        Assert.Equal(PermissionSchemaVersion, created.PermissionSchemaVersion);
        AssertEqualCanonicalCodes(
            CrossGroupPermissionCodes,
            created.PermissionCodes);
        Assert.Equal(
            new RolePermissionState(
                PermissionSchemaVersion,
                EncodeMask(CrossGroupPermissionCodes)),
            await ReadRolePermissionStateAsync(factory, created.Id));

        var updatedPermissionCodes = new[]
        {
            "READ_MESSAGE_HISTORY",
            "ATTACH_FILES",
            "SHARE_SCREEN",
            "TIMEOUT_MEMBERS",
            "ASSIGN_ROLES",
            "DELETE_VOICE_SPACES",
            "VIEW_AUDIT_LOG"
        };
        using var updateResponse = await client.PatchAsJsonAsync(
            RolePath(created.Id),
            new UpdateRoleV1Request
            {
                Title = "Updated cross-group role",
                Description = "Updated by the unified endpoint",
                Color = "#AABBCC",
                Mentionable = true,
                PermissionSchemaVersion = PermissionSchemaVersion,
                PermissionCodes = updatedPermissionCodes,
                ExpectedVersion = created.Version
            });

        await ApiClientExtensions.EnsureSuccessWithBodyAsync(updateResponse);
        var updated = (await updateResponse.Content
            .ReadFromJsonAsync<RoleV1Response>())!;
        Assert.Equal(PermissionSchemaVersion, updated.PermissionSchemaVersion);
        AssertEqualCanonicalCodes(
            updatedPermissionCodes,
            updated.PermissionCodes);
        Assert.Equal(
            new RolePermissionState(
                PermissionSchemaVersion,
                EncodeMask(updatedPermissionCodes)),
            await ReadRolePermissionStateAsync(factory, created.Id));
    }

    [Fact]
    public async Task RoleV1_UnknownCodeAndWrongSchema_AreRejectedAtomically()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var snapshotBeforeInvalidCreates = await ReadServerWriteSnapshotAsync(
            factory);

        await AssertInvalidCreateAsync(
            client,
            new CreateRoleV1Request
            {
                Title = "Unknown permission must not exist",
                PermissionSchemaVersion = PermissionSchemaVersion,
                PermissionCodes = ["SEND_MESSAGES", "UNKNOWN_PERMISSION"]
            });
        Assert.Equal(
            snapshotBeforeInvalidCreates,
            await ReadServerWriteSnapshotAsync(factory));

        await AssertInvalidCreateAsync(
            client,
            new CreateRoleV1Request
            {
                Title = "Wrong schema must not exist",
                PermissionSchemaVersion = PermissionSchemaVersion + 1,
                PermissionCodes = ["SEND_MESSAGES"]
            });
        Assert.Equal(
            snapshotBeforeInvalidCreates,
            await ReadServerWriteSnapshotAsync(factory));

        var role = await CreateRoleAsync(
            client,
            "Atomic update role",
            ["SEND_MESSAGES", "CONNECT_VOICE"]);
        var snapshotBeforeInvalidUpdates = await ReadRoleSnapshotAsync(
            factory,
            role.Id);

        await AssertInvalidUpdateAsync(
            client,
            role.Id,
            new UpdateRoleV1Request
            {
                Title = "Unknown update must not be stored",
                Description = "invalid",
                Color = "#112233",
                Mentionable = true,
                PermissionSchemaVersion = PermissionSchemaVersion,
                PermissionCodes = ["SEND_MESSAGES", "UNKNOWN_PERMISSION"],
                ExpectedVersion = role.Version
            });
        Assert.Equal(
            snapshotBeforeInvalidUpdates,
            await ReadRoleSnapshotAsync(factory, role.Id));

        await AssertInvalidUpdateAsync(
            client,
            role.Id,
            new UpdateRoleV1Request
            {
                Title = "Wrong schema update must not be stored",
                Description = "invalid",
                Color = "#445566",
                Mentionable = true,
                PermissionSchemaVersion = PermissionSchemaVersion + 1,
                PermissionCodes = ["SEND_MESSAGES"],
                ExpectedVersion = role.Version
            });
        Assert.Equal(
            snapshotBeforeInvalidUpdates,
            await ReadRoleSnapshotAsync(factory, role.Id));
    }

    [Fact]
    public async Task RoleV1_AdministratorPermission_IsOwnerOnly()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));

        var administratorRole = await CreateRoleAsync(
            ownerClient,
            "Owner administrator role",
            ["ADMINISTRATOR"]);
        AssertEqualCanonicalCodes(
            ["ADMINISTRATOR"],
            administratorRole.PermissionCodes);

        var managerRole = await CreateRoleAsync(
            ownerClient,
            "Role manager",
            ["MANAGE_ROLES"]);
        using (var assignResponse = await ownerClient.PostAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{ArcaneLinkApiFactory.MemberMemberId}/roles",
                   new { roleId = managerRole.Id }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(assignResponse);
        }

        using var managerClient = factory.CreateClient();
        managerClient.AuthorizeWith(await managerClient.LoginAsync("member"));

        _ = await CreateRoleAsync(
            managerClient,
            "Manager safe empty role",
            []);
        var roleCountBeforeForbiddenCreate = await CountRolesAsync(factory);

        using var forbiddenResponse = await managerClient.PostAsJsonAsync(
            RolesPath,
            new CreateRoleV1Request
            {
                Title = "Manager must not create administrator",
                PermissionSchemaVersion = PermissionSchemaVersion,
                PermissionCodes = ["ADMINISTRATOR"]
            });

        Assert.Equal(HttpStatusCode.NotFound, forbiddenResponse.StatusCode);
        Assert.Equal(
            roleCountBeforeForbiddenCreate,
            await CountRolesAsync(factory));
    }

    private static async Task<RoleV1Response> CreateRoleAsync(
        HttpClient client,
        string title,
        IReadOnlyList<string> permissionCodes)
    {
        using var response = await client.PostAsJsonAsync(
            RolesPath,
            new CreateRoleV1Request
            {
                Title = title,
                PermissionSchemaVersion = PermissionSchemaVersion,
                PermissionCodes = permissionCodes
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<RoleV1Response>())!;
    }

    private static async Task AssertInvalidCreateAsync(
        HttpClient client,
        CreateRoleV1Request request)
    {
        using var response = await client.PostAsJsonAsync(RolesPath, request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal("invalid_role_create", error?.Code);
    }

    private static async Task AssertInvalidUpdateAsync(
        HttpClient client,
        Guid roleId,
        UpdateRoleV1Request request)
    {
        using var response = await client.PatchAsJsonAsync(
            RolePath(roleId),
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal("invalid_role_update", error?.Code);
    }

    private static void AssertEqualCanonicalCodes(
        IEnumerable<string> expected,
        IEnumerable<string> actual)
    {
        var actualCodes = actual.ToArray();
        Assert.All(
            actualCodes,
            code => Assert.Equal(code.ToUpperInvariant(), code));
        Assert.Equal(
            expected.Order(StringComparer.Ordinal),
            actualCodes.Order(StringComparer.Ordinal));
    }

    private static async Task<int> CountRolesAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.ServerRoles.AsNoTracking().CountAsync();
    }

    private static async Task<ServerWriteSnapshot> ReadServerWriteSnapshotAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var authorizationVersion = await db.Servers
            .AsNoTracking()
            .Where(server => server.Id == ArcaneLinkApiFactory.ServerId)
            .Select(server => server.AuthorizationVersion)
            .SingleAsync();
        var roleCount = await db.ServerRoles.AsNoTracking().CountAsync();
        var roleCreateAuditCount = await db.ServerAuditLogs
            .AsNoTracking()
            .CountAsync(item =>
                item.ServerId == ArcaneLinkApiFactory.ServerId &&
                item.EventTypeId == ServerGovernanceIds.AuditRoleCreated);

        return new ServerWriteSnapshot(
            authorizationVersion,
            roleCount,
            roleCreateAuditCount);
    }

    private static async Task<RolePermissionState> ReadRolePermissionStateAsync(
        ArcaneLinkApiFactory factory,
        Guid roleId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var role = await db.ServerRoles
            .AsNoTracking()
            .SingleAsync(item => item.Id == roleId);

        return new RolePermissionState(
            role.PermissionSchemaVersion,
            Convert.ToBase64String(role.PermissionMask));
    }

    private static async Task<RoleSnapshot> ReadRoleSnapshotAsync(
        ArcaneLinkApiFactory factory,
        Guid roleId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var role = await db.ServerRoles
            .AsNoTracking()
            .SingleAsync(item => item.Id == roleId);
        var serverAuthorizationVersion = await db.Servers
            .AsNoTracking()
            .Where(server => server.Id == ArcaneLinkApiFactory.ServerId)
            .Select(server => server.AuthorizationVersion)
            .SingleAsync();
        var updateAuditCount = await db.ServerAuditLogs
            .AsNoTracking()
            .CountAsync(item =>
                item.ServerId == ArcaneLinkApiFactory.ServerId &&
                item.RelatedRoleId == roleId &&
                item.EventTypeId == ServerGovernanceIds.AuditRoleUpdated);

        return new RoleSnapshot(
            role.Version,
            role.UpdatedAt,
            role.Title,
            role.Description,
            role.Color,
            role.Mentionable,
            role.PermissionSchemaVersion,
            Convert.ToBase64String(role.PermissionMask),
            serverAuthorizationVersion,
            updateAuditCount);
    }

    private static string EncodeMask(IEnumerable<string> permissionCodes)
    {
        return Convert.ToBase64String(
            ServerPermissionRegistry.CreateMask(permissionCodes).ToByteArray());
    }

    private static string RolesPath =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles";

    private static string RolePath(Guid roleId) =>
        $"{RolesPath}/{roleId}";

    private sealed class PermissionCatalogV1Response
    {
        public int PermissionSchemaVersion { get; init; }
        public IReadOnlyList<PermissionDefinitionV1Response> Permissions { get; init; } = [];
    }

    private sealed class PermissionDefinitionV1Response
    {
        public int Bit { get; init; }
        public string Code { get; init; } = string.Empty;
        public string Group { get; init; } = string.Empty;
    }

    private sealed class CreateRoleV1Request
    {
        public required string Title { get; init; }
        public string? Description { get; init; }
        public string? Color { get; init; }
        public bool Mentionable { get; init; }
        public int PermissionSchemaVersion { get; init; }
        public IReadOnlyList<string> PermissionCodes { get; init; } = [];
    }

    private sealed class UpdateRoleV1Request
    {
        public required string Title { get; init; }
        public string? Description { get; init; }
        public string? Color { get; init; }
        public bool Mentionable { get; init; }
        public int PermissionSchemaVersion { get; init; }
        public IReadOnlyList<string> PermissionCodes { get; init; } = [];
        public Guid ExpectedVersion { get; init; }
    }

    private sealed class RoleV1Response
    {
        public Guid Id { get; init; }
        public Guid Version { get; init; }
        public int PermissionSchemaVersion { get; init; }
        public IReadOnlyList<string> PermissionCodes { get; init; } = [];
    }

    private sealed class ErrorResponse
    {
        public string? Code { get; init; }
    }

    private sealed record RolePermissionState(
        int PermissionSchemaVersion,
        string PermissionMask);

    private sealed record ServerWriteSnapshot(
        Guid AuthorizationVersion,
        int RoleCount,
        int RoleCreateAuditCount);

    private sealed record RoleSnapshot(
        Guid Version,
        DateTime UpdatedAt,
        string Title,
        string? Description,
        string? Color,
        bool Mentionable,
        int PermissionSchemaVersion,
        string PermissionMask,
        Guid ServerAuthorizationVersion,
        int UpdateAuditCount);
}
