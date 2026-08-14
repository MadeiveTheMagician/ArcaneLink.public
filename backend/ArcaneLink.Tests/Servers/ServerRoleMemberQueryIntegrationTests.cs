using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Tests.Infrastructure;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerRoleMemberQueryIntegrationTests
{
    [Fact]
    public async Task MemberCatalogue_FiltersByRoleAndCaseInsensitiveIdentityQuery()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client);
        var assignment = await AssignRoleAsync(client, role.Id);

        var page = await client.GetFromJsonAsync<ServerMemberPageResponse>(
            MemberQuery(role.Id, "  MeMb  "));

        Assert.NotNull(page);
        Assert.Equal(1, page.TotalCount);
        var member = Assert.Single(page.Items);
        Assert.Equal(ArcaneLinkApiFactory.MemberMemberId, member.Id);
        Assert.Equal("member", member.User.Login);
        Assert.Contains(
            member.RoleAssignments,
            item => item.Id == assignment.Id && item.RoleId == role.Id);

        var noMatch = await client.GetFromJsonAsync<ServerMemberPageResponse>(
            MemberQuery(role.Id, "owner"));
        Assert.NotNull(noMatch);
        Assert.Equal(0, noMatch.TotalCount);
        Assert.Empty(noMatch.Items);
    }

    [Fact]
    public async Task MemberCatalogue_StopsReturningRevokedRoleAssignments()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client);
        var assignment = await AssignRoleAsync(client, role.Id);

        using (var revokeResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/" +
                   assignment.Id))
        {
            Assert.Equal(HttpStatusCode.NoContent, revokeResponse.StatusCode);
        }

        var page = await client.GetFromJsonAsync<ServerMemberPageResponse>(
            MemberQuery(role.Id));
        Assert.NotNull(page);
        Assert.Equal(0, page.TotalCount);
        Assert.Empty(page.Items);
    }

    [Fact]
    public async Task MemberCatalogue_RejectsOversizedSearchQuery()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var response = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members?" +
            $"q={new string('x', 101)}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<ServerRoleResponse> CreateRoleAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = $"member-query-{Guid.NewGuid():N}"
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

    private static string MemberQuery(Guid roleId, string? query = null)
    {
        var queryPart = query == null
            ? string.Empty
            : $"&q={Uri.EscapeDataString(query)}";
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members?" +
               $"roleId={roleId}{queryPart}";
    }
}
