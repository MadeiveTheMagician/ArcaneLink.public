using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerRoleQueryIntegrationTests
{
    [Fact]
    public async Task RoleCatalogue_ReturnsMetadataCountsAndServerSideFilters()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var alphaRole = await CreateRoleAsync(
            client,
            "Alpha Moderators",
            ["KICK_MEMBERS"]);
        var inviteRole = await CreateRoleAsync(
            client,
            "Invite Team",
            ["MANAGE_INVITES"]);
        var attachmentRole = await CreateRoleAsync(
            client,
            "Upload Crew",
            ["ATTACH_FILES"]);
        await AssignRoleAsync(client, alphaRole.Id);
        var revokedAssignment = await AssignRoleAsync(client, inviteRole.Id);
        using (var revokeResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/" +
                   revokedAssignment.Id))
        {
            Assert.Equal(HttpStatusCode.NoContent, revokeResponse.StatusCode);
        }

        var roles = await client.GetFromJsonAsync<List<ServerRoleResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles");
        Assert.NotNull(roles);
        var storedAlpha = Assert.Single(roles, role => role.Id == alphaRole.Id);
        var storedInvite = Assert.Single(roles, role => role.Id == inviteRole.Id);
        Assert.Equal(
            [alphaRole.Id, inviteRole.Id],
            roles
                .Where(role => role.Id == alphaRole.Id || role.Id == inviteRole.Id)
                .Select(role => role.Id)
                .ToArray());

        Assert.Equal(ServerRoleKindCodes.Standard, storedAlpha.Kind);
        Assert.Null(storedAlpha.Color);
        Assert.False(storedAlpha.Mentionable);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, storedAlpha.CreatedByUserId);
        Assert.NotEqual(Guid.Empty, storedAlpha.Version);
        Assert.Equal(1, storedAlpha.DirectAssignmentCount);
        Assert.Equal(0, storedInvite.DirectAssignmentCount);

        var byTitle = await GetRolesAsync(client, "q=alpha");
        Assert.Equal(alphaRole.Id, Assert.Single(byTitle).Id);

        var byPermissionTitle = await GetRolesAsync(
            client,
            $"q={Uri.EscapeDataString("MANAGE INVITES")}");
        Assert.Contains(byPermissionTitle, role => role.Id == inviteRole.Id);
        Assert.DoesNotContain(byPermissionTitle, role => role.Id == alphaRole.Id);

        var byPermissionCode = await GetRolesAsync(
            client,
            "permissionCode=KICK_MEMBERS");
        Assert.Contains(byPermissionCode, role => role.Id == alphaRole.Id);
        Assert.DoesNotContain(byPermissionCode, role => role.Id == inviteRole.Id);

        var byGranularPermissionTitle = await GetRolesAsync(
            client,
            $"q={Uri.EscapeDataString("Attach files")}");
        Assert.Equal(
            attachmentRole.Id,
            Assert.Single(byGranularPermissionTitle).Id);
        var byGranularPermissionCode = await GetRolesAsync(
            client,
            "permissionCode=ATTACH_FILES");
        Assert.Equal(
            attachmentRole.Id,
            Assert.Single(byGranularPermissionCode).Id);
    }

    [Fact]
    public async Task RoleCatalogue_RequiresMembershipAndBoundsFilters()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using (var outsiderResponse = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles"))
        {
            Assert.Equal(HttpStatusCode.NotFound, outsiderResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var oversizedQueryResponse = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles?q={new string('a', 101)}");
        Assert.Equal(HttpStatusCode.BadRequest, oversizedQueryResponse.StatusCode);
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
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
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
        return (await response.Content.ReadFromJsonAsync<ServerMemberRoleResponse>())!;
    }

    private static async Task<List<ServerRoleResponse>> GetRolesAsync(
        HttpClient client,
        string query)
    {
        return (await client.GetFromJsonAsync<List<ServerRoleResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles?{query}"))!;
    }
}
