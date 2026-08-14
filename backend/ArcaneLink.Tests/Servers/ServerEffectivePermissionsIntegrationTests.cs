using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerEffectivePermissionsIntegrationTests
{
    [Fact]
    public async Task EffectivePermissions_ReturnsOwnerAndOrdinaryMemberAuthority()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        var owner = await ownerClient
            .GetFromJsonAsync<ServerEffectivePermissionsResponse>(PermissionsPath);
        Assert.NotNull(owner);
        Assert.True(owner.IsOwner);
        Assert.False(owner.IsAdministrator);
        Assert.Equal("owner", owner.AuthorityTier);
        Assert.Null(owner.AuthorityPosition);
        Assert.Equal(ServerPermissionRegistry.SchemaVersion, owner.PermissionSchemaVersion);
        Assert.Equal(
            ServerPermissionRegistry.All.Select(permission => permission.Code),
            owner.PermissionCodes);

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        var member = await memberClient
            .GetFromJsonAsync<ServerEffectivePermissionsResponse>(PermissionsPath);
        Assert.NotNull(member);
        Assert.False(member.IsOwner);
        Assert.False(member.IsAdministrator);
        Assert.Equal("everyone", member.AuthorityTier);
        Assert.Equal(
            ServerPermissionRegistry.DefaultEveryonePermissionCodes,
            member.PermissionCodes);
    }

    [Fact]
    public async Task EffectivePermissions_TracksRoleAssignmentAndRevisionInvalidation()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        var role = await CreateRoleAsync(ownerClient, ["manage_roles"]);

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        var before = (await memberClient
            .GetFromJsonAsync<ServerEffectivePermissionsResponse>(PermissionsPath))!;
        var assignment = await AssignRoleAsync(ownerClient, role.Id);
        var assigned = (await memberClient
            .GetFromJsonAsync<ServerEffectivePermissionsResponse>(PermissionsPath))!;

        Assert.NotEqual(before.AuthorizationVersion, assigned.AuthorizationVersion);
        Assert.Equal("standard", assigned.AuthorityTier);
        Assert.Equal(role.Level, assigned.AuthorityPosition);
        Assert.Equal(
            ServerPermissionRegistry.DefaultEveryonePermissionCodes
                .Concat(["MANAGE_ROLES", "ASSIGN_ROLES"])
                .OrderBy(code => ServerPermissionRegistry.GetRequired(code).Bit),
            assigned.PermissionCodes);

        using (var revoke = await ownerClient.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/" +
                   assignment.Id))
        {
            Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);
        }

        var revoked = (await memberClient
            .GetFromJsonAsync<ServerEffectivePermissionsResponse>(PermissionsPath))!;
        Assert.NotEqual(assigned.AuthorizationVersion, revoked.AuthorizationVersion);
        Assert.Equal("everyone", revoked.AuthorityTier);
        Assert.Equal(
            ServerPermissionRegistry.DefaultEveryonePermissionCodes,
            revoked.PermissionCodes);
    }

    [Fact]
    public async Task EffectivePermissions_AdministratorGetsKnownRegistryWithoutBecomingOwner()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        var role = await CreateRoleAsync(ownerClient, ["manage_server"]);
        _ = await AssignRoleAsync(ownerClient, role.Id);

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        var permissions = (await memberClient
            .GetFromJsonAsync<ServerEffectivePermissionsResponse>(PermissionsPath))!;

        Assert.False(permissions.IsOwner);
        Assert.True(permissions.IsAdministrator);
        Assert.Equal("administrator", permissions.AuthorityTier);
        Assert.Equal(role.Level, permissions.AuthorityPosition);
        Assert.Equal(
            ServerPermissionRegistry.All.Select(permission => permission.Code),
            permissions.PermissionCodes);
    }

    [Fact]
    public async Task EffectivePermissions_HidesServerFromOutsider()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("outsider"));

        using var response = await client.GetAsync(PermissionsPath);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task<ServerRoleResponse> CreateRoleAsync(
        HttpClient client,
        IReadOnlyList<string> permissionCodes)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = $"effective-{Guid.NewGuid():N}",
                PermissionCodes = permissionCodes
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static async Task<ServerMemberRoleResponse> AssignRoleAsync(
        HttpClient client,
        Guid roleId)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/" +
            $"{ArcaneLinkApiFactory.MemberMemberId}/roles",
            new AssignServerRoleRequest { RoleId = roleId });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content
            .ReadFromJsonAsync<ServerMemberRoleResponse>())!;
    }

    private static string PermissionsPath =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/me/" +
        "effective-permissions";
}
