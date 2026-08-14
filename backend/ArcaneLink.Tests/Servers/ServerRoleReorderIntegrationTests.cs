using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerRoleReorderIntegrationTests
{
    [Fact]
    public async Task OwnerReorder_NormalizesCustomHierarchyAndBumpsRevisions()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        _ = await CreateRoleAsync(client, "Reorder A");
        _ = await CreateRoleAsync(client, "Reorder B");
        _ = await CreateRoleAsync(client, "Reorder C");
        var beforeRoles = await GetCustomRolesAsync(client);
        var beforeServer = await ReadServerSnapshotAsync(factory);
        var requested = beforeRoles.AsEnumerable().Reverse().ToList();

        using var response = await client.PutAsJsonAsync(
            OrderPath,
            CreateRequest(beforeServer.AuthorizationVersion, requested));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var afterRoles = await GetCustomRolesAsync(client);
        var afterServer = await ReadServerSnapshotAsync(factory);
        Assert.Equal(requested.Select(role => role.Id), afterRoles.Select(role => role.Id));
        Assert.Equal(
            Enumerable.Range(100, afterRoles.Count),
            afterRoles.Select(role => role.Level));
        Assert.NotEqual(beforeServer.AuthorizationVersion, afterServer.AuthorizationVersion);
        Assert.NotEqual(beforeServer.SpaceAclRevision, afterServer.SpaceAclRevision);
        Assert.Equal(beforeServer.ReorderAuditCount + 1, afterServer.ReorderAuditCount);
        Assert.Contains(
            afterRoles,
            role => beforeRoles.Single(before => before.Id == role.Id).Version != role.Version);
    }

    [Fact]
    public async Task OwnerReorder_WithCurrentOrder_IsNoOp()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        _ = await CreateRoleAsync(client, "No-op order A");
        _ = await CreateRoleAsync(client, "No-op order B");
        var roles = await GetCustomRolesAsync(client);
        var before = await ReadServerSnapshotAsync(factory);

        using var response = await client.PutAsJsonAsync(
            OrderPath,
            CreateRequest(before.AuthorizationVersion, roles));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(before, await ReadServerSnapshotAsync(factory));
        Assert.Equal(
            roles.Select(role => (role.Id, role.Version, role.Level)),
            (await GetCustomRolesAsync(client))
                .Select(role => (role.Id, role.Version, role.Level)));
    }

    [Fact]
    public async Task Reorder_RejectsStaleOrIncompleteRoleSetAtomically()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        _ = await CreateRoleAsync(client, "Validation order A");
        _ = await CreateRoleAsync(client, "Validation order B");
        var roles = await GetCustomRolesAsync(client);
        var before = await ReadServerSnapshotAsync(factory);

        using (var incomplete = await client.PutAsJsonAsync(
                   OrderPath,
                   CreateRequest(
                       before.AuthorizationVersion,
                       roles.Take(roles.Count - 1).ToList())))
        {
            Assert.Equal(HttpStatusCode.BadRequest, incomplete.StatusCode);
        }

        Assert.Equal(before, await ReadServerSnapshotAsync(factory));
        using (var update = await client.PatchAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{roles[0].Id}",
                   new UpdateServerRoleRequest
                   {
                       Title = roles[0].Title + " updated",
                       PermissionCodes = [],
                       ExpectedVersion = roles[0].Version
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(update);
        }

        var beforeStale = await ReadServerSnapshotAsync(factory);
        using var stale = await client.PutAsJsonAsync(
            OrderPath,
            CreateRequest(
                before.AuthorizationVersion,
                roles.AsEnumerable().Reverse().ToList()));
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal(beforeStale, await ReadServerSnapshotAsync(factory));
    }

    [Fact]
    public async Task ManageRoles_ReordersOnlyRolesBelowTheActorsHierarchy()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        var managerRole = await CreateRoleAsync(
            ownerClient,
            "Role manager",
            ["MANAGE_ROLES"],
            level: 100);
        var lowerRoleA = await CreateRoleAsync(
            ownerClient,
            "Lower role A",
            level: 200);
        var lowerRoleB = await CreateRoleAsync(
            ownerClient,
            "Lower role B",
            level: 300);
        using (var assign = await ownerClient.PostAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/" +
                   $"{ArcaneLinkApiFactory.MemberMemberId}/roles",
                   new AssignServerRoleRequest { RoleId = managerRole.Id }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(assign);
        }

        var roles = await GetCustomRolesAsync(ownerClient);
        var server = await ReadServerSnapshotAsync(factory);
        var allowedOrder = roles.ToList();
        var lowerAIndex = allowedOrder.FindIndex(role => role.Id == lowerRoleA.Id);
        var lowerBIndex = allowedOrder.FindIndex(role => role.Id == lowerRoleB.Id);
        (allowedOrder[lowerAIndex], allowedOrder[lowerBIndex]) =
            (allowedOrder[lowerBIndex], allowedOrder[lowerAIndex]);
        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        using (var allowed = await memberClient.PutAsJsonAsync(
                   OrderPath,
                   CreateRequest(server.AuthorizationVersion, allowedOrder)))
        {
            Assert.Equal(HttpStatusCode.NoContent, allowed.StatusCode);
        }

        var rolesAfterAllowed = await GetCustomRolesAsync(ownerClient);
        Assert.Equal(
            allowedOrder.Select(role => role.Id),
            rolesAfterAllowed.Select(role => role.Id));

        var beforeDenied = await ReadServerSnapshotAsync(factory);
        var deniedOrder = rolesAfterAllowed.ToList();
        var managerIndex = deniedOrder.FindIndex(role => role.Id == managerRole.Id);
        var nextIndex = managerIndex + 1;
        (deniedOrder[managerIndex], deniedOrder[nextIndex]) =
            (deniedOrder[nextIndex], deniedOrder[managerIndex]);
        using var denied = await memberClient.PutAsJsonAsync(
            OrderPath,
            CreateRequest(beforeDenied.AuthorizationVersion, deniedOrder));

        Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        Assert.Equal(beforeDenied, await ReadServerSnapshotAsync(factory));
    }

    private static async Task<ServerRoleResponse> CreateRoleAsync(
        HttpClient client,
        string title,
        IReadOnlyList<string>? permissionCodes = null,
        int? level = null)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = title,
                Level = level,
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                PermissionCodes = permissionCodes ?? []
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static async Task<List<ServerRoleResponse>> GetCustomRolesAsync(
        HttpClient client)
    {
        var roles = await client.GetFromJsonAsync<List<ServerRoleResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles");
        return roles!.Where(role => !role.IsSystem).ToList();
    }

    private static ReorderServerRolesRequest CreateRequest(
        Guid authorizationVersion,
        IReadOnlyList<ServerRoleResponse> roles)
    {
        return new ReorderServerRolesRequest
        {
            ExpectedAuthorizationVersion = authorizationVersion,
            Roles = roles.Select(role => new ReorderServerRoleItemRequest
            {
                RoleId = role.Id,
                ExpectedVersion = role.Version
            }).ToList()
        };
    }

    private static async Task<ServerReorderSnapshot> ReadServerSnapshotAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var server = await db.Servers
            .AsNoTracking()
            .Where(item => item.Id == ArcaneLinkApiFactory.ServerId)
            .Select(item => new
            {
                item.AuthorizationVersion,
                item.SpaceAclRevision
            })
            .SingleAsync();
        var reorderAuditCount = await db.ServerAuditLogs
            .AsNoTracking()
            .CountAsync(item =>
                item.ServerId == ArcaneLinkApiFactory.ServerId &&
                item.Payload != null &&
                item.Payload.Contains("roles_reordered"));
        return new ServerReorderSnapshot(
            server.AuthorizationVersion,
            server.SpaceAclRevision,
            reorderAuditCount);
    }

    private static string OrderPath =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/order";

    private sealed record ServerReorderSnapshot(
        Guid AuthorizationVersion,
        Guid SpaceAclRevision,
        int ReorderAuditCount);
}
