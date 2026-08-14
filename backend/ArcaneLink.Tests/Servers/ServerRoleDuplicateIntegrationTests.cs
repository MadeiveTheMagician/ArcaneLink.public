using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerRoleDuplicateIntegrationTests
{
    [Fact]
    public async Task DuplicateRole_CopiesEditableStateWithoutAssignmentsOrAuthorityLinks()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var source = await CreateRoleAsync(client, "Source role", ["manage_invites"]);
        source = await UpdateRoleAsync(
            client,
            source,
            description: "Source description",
            color: "#AABBCC",
            mentionable: true,
            permissionCodes: ["manage_invites"]);

        using (var assignmentResponse = await client.PostAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/" +
                   $"{ArcaneLinkApiFactory.MemberMemberId}/roles",
                   new AssignServerRoleRequest { RoleId = source.Id }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(assignmentResponse);
        }

        var before = await ReadServerRevisionAsync(factory);
        using var response = await client.PostAsJsonAsync(
            DuplicatePath(source.Id),
            new DuplicateServerRoleRequest
            {
                ExpectedVersion = source.Version
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var duplicate = (await response.Content
            .ReadFromJsonAsync<ServerRoleResponse>())!;
        var after = await ReadServerRevisionAsync(factory);

        Assert.NotEqual(source.Id, duplicate.Id);
        Assert.Equal("Source role (copy)", duplicate.Title);
        Assert.Equal(source.Description, duplicate.Description);
        Assert.Equal(source.Color, duplicate.Color);
        Assert.False(duplicate.Mentionable);
        Assert.Equal(ServerRoleKindCodes.Standard, duplicate.Kind);
        Assert.False(duplicate.IsSystem);
        Assert.Null(duplicate.Code);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, duplicate.CreatedByUserId);
        Assert.Equal(["manage_invites"], duplicate.Permissions.Select(item => item.Code));
        Assert.Equal(0, duplicate.DirectAssignmentCount);
        Assert.True(duplicate.Level > source.Level);
        Assert.NotEqual(Guid.Empty, duplicate.Version);
        Assert.NotEqual(before.AuthorizationVersion, after.AuthorizationVersion);
        Assert.NotEqual(before.SpaceAclRevision, after.SpaceAclRevision);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.ServerMemberRoles
            .AsNoTracking()
            .AnyAsync(item => item.RoleId == duplicate.Id));
        Assert.False(await db.SpacePermissionOverrides
            .AsNoTracking()
            .AnyAsync(item =>
                item.RoleId == duplicate.Id ||
                item.ProtectionRoleId == duplicate.Id));
        Assert.False(await db.Spaces
            .AsNoTracking()
            .AnyAsync(item =>
                item.RequiredServerRoleId == duplicate.Id ||
                item.CreatedWithRoleId == duplicate.Id ||
                item.ProtectionRoleId == duplicate.Id));
        var audit = await db.ServerAuditLogs
            .AsNoTracking()
            .Where(item =>
                item.EventTypeId == ServerGovernanceIds.AuditRoleCreated &&
                item.RelatedRoleId == duplicate.Id)
            .SingleAsync();
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, audit.ActorUserId);
        Assert.Contains("role_duplicated", audit.Payload, StringComparison.Ordinal);
        Assert.Contains(source.Id.ToString(), audit.Payload, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DuplicateRole_GeneratesStableCollisionFreeTitles()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var source = await CreateRoleAsync(client, new string('A', 64), []);

        var first = await DuplicateAsync(client, source);
        var second = await DuplicateAsync(client, source);

        Assert.Equal(64, first.Title.Length);
        Assert.EndsWith(" (copy)", first.Title, StringComparison.Ordinal);
        Assert.Equal(64, second.Title.Length);
        Assert.EndsWith(" (copy 2)", second.Title, StringComparison.Ordinal);
        Assert.NotEqual(first.Title, second.Title);
    }

    [Fact]
    public async Task DuplicateAdministratorRole_RequiresExplicitOwnerConfirmation()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var source = await CreateRoleAsync(
            client,
            "Administrator source",
            ["manage_server", "manage_roles"]);

        using (var unconfirmed = await client.PostAsJsonAsync(
                   DuplicatePath(source.Id),
                   new DuplicateServerRoleRequest
                   {
                       ExpectedVersion = source.Version
                   }))
        {
            Assert.Equal(HttpStatusCode.Conflict, unconfirmed.StatusCode);
            var error = await unconfirmed.Content
                .ReadFromJsonAsync<RoleMutationErrorResponse>();
            Assert.Equal(
                "server_role_administrator_confirmation_required",
                error?.Code);
        }

        using var confirmed = await client.PostAsJsonAsync(
            DuplicatePath(source.Id),
            new DuplicateServerRoleRequest
            {
                ExpectedVersion = source.Version,
                ConfirmAdministrator = true
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(confirmed);
        var duplicate = (await confirmed.Content
            .ReadFromJsonAsync<ServerRoleResponse>())!;
        Assert.Equal(
            ["manage_roles", "manage_server"],
            duplicate.Permissions
                .Select(item => item.Code)
                .OrderBy(code => code, StringComparer.Ordinal));
    }

    [Fact]
    public async Task DuplicateRole_WithStaleVersion_IsAtomicConflict()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var original = await CreateRoleAsync(client, "Stale duplicate", []);
        _ = await UpdateRoleAsync(
            client,
            original,
            description: "Changed",
            color: null,
            mentionable: false,
            permissionCodes: []);
        var before = await ReadDuplicateSnapshotAsync(factory, original.Id);

        using var response = await client.PostAsJsonAsync(
            DuplicatePath(original.Id),
            new DuplicateServerRoleRequest
            {
                ExpectedVersion = original.Version
            });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var error = await response.Content
            .ReadFromJsonAsync<RoleMutationErrorResponse>();
        Assert.Equal("server_role_conflict", error?.Code);
        Assert.Equal(before, await ReadDuplicateSnapshotAsync(factory, original.Id));
    }

    private static async Task<ServerRoleResponse> CreateRoleAsync(
        HttpClient client,
        string title,
        IReadOnlyList<string> permissionCodes)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = title,
                PermissionCodes = permissionCodes
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static async Task<ServerRoleResponse> UpdateRoleAsync(
        HttpClient client,
        ServerRoleResponse role,
        string? description,
        string? color,
        bool mentionable,
        IReadOnlyList<string> permissionCodes)
    {
        using var response = await client.PatchAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{role.Id}",
            new UpdateServerRoleRequest
            {
                Title = role.Title,
                Description = description,
                Color = color,
                Mentionable = mentionable,
                PermissionCodes = permissionCodes,
                ExpectedVersion = role.Version
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static async Task<ServerRoleResponse> DuplicateAsync(
        HttpClient client,
        ServerRoleResponse source)
    {
        using var response = await client.PostAsJsonAsync(
            DuplicatePath(source.Id),
            new DuplicateServerRoleRequest
            {
                ExpectedVersion = source.Version
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static string DuplicatePath(Guid roleId) =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{roleId}/duplicate";

    private static async Task<ServerRevisionSnapshot> ReadServerRevisionAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Servers
            .AsNoTracking()
            .Where(item => item.Id == ArcaneLinkApiFactory.ServerId)
            .Select(item => new ServerRevisionSnapshot(
                item.AuthorizationVersion,
                item.SpaceAclRevision))
            .SingleAsync();
    }

    private static async Task<DuplicateSnapshot> ReadDuplicateSnapshotAsync(
        ArcaneLinkApiFactory factory,
        Guid sourceRoleId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var revision = await db.Servers
            .AsNoTracking()
            .Where(item => item.Id == ArcaneLinkApiFactory.ServerId)
            .Select(item => new ServerRevisionSnapshot(
                item.AuthorizationVersion,
                item.SpaceAclRevision))
            .SingleAsync();
        return new DuplicateSnapshot(
            revision.AuthorizationVersion,
            revision.SpaceAclRevision,
            await db.ServerRoles.AsNoTracking().CountAsync(),
            await db.ServerAuditLogs.AsNoTracking().CountAsync(item =>
                item.EventTypeId == ServerGovernanceIds.AuditRoleCreated &&
                item.Payload != null &&
                item.Payload.Contains(sourceRoleId.ToString())));
    }

    private sealed record ServerRevisionSnapshot(
        Guid AuthorizationVersion,
        Guid SpaceAclRevision);

    private sealed record DuplicateSnapshot(
        Guid AuthorizationVersion,
        Guid SpaceAclRevision,
        int RoleCount,
        int DuplicateAuditCount);

    private sealed class RoleMutationErrorResponse
    {
        public string? Code { get; set; }
    }
}
