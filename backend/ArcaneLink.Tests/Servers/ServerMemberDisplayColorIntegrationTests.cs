using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Tests.Infrastructure;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerMemberDisplayColorIntegrationTests
{
    [Fact]
    public async Task DisplayColor_ListsAssignedColoredRolesAndUpdatesSelection()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        var role = await CreateColoredRoleAsync(ownerClient, "Azure", "#11AACC");
        _ = await AssignToMemberAsync(ownerClient, role.Id);

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        var initial = await memberClient
            .GetFromJsonAsync<ServerMemberDisplayColorResponse>(DisplayColorPath);
        Assert.NotNull(initial);
        Assert.Equal("auto", initial.Mode);
        Assert.Null(initial.RoleId);
        Assert.Equal(role.Id, initial.ResolvedRoleId);
        Assert.Equal("#11aacc", initial.ResolvedColor);
        var option = Assert.Single(initial.AvailableRoles);
        Assert.Equal(role.Id, option.Id);

        using var response = await memberClient.PatchAsJsonAsync(
            DisplayColorPath,
            new UpdateServerMemberDisplayColorRequest
            {
                Mode = " ROLE ",
                RoleId = role.Id,
                ExpectedRolesVersion = initial.RolesVersion
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var selected = (await response.Content
            .ReadFromJsonAsync<ServerMemberDisplayColorResponse>())!;
        Assert.Equal("role", selected.Mode);
        Assert.Equal(role.Id, selected.RoleId);
        Assert.Equal(role.Id, selected.ResolvedRoleId);
        Assert.Equal("#11aacc", selected.ResolvedColor);
        Assert.NotEqual(initial.RolesVersion, selected.RolesVersion);

        using var noOpResponse = await memberClient.PatchAsJsonAsync(
            DisplayColorPath,
            new UpdateServerMemberDisplayColorRequest
            {
                Mode = "role",
                RoleId = role.Id,
                ExpectedRolesVersion = selected.RolesVersion
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(noOpResponse);
        var noOp = (await noOpResponse.Content
            .ReadFromJsonAsync<ServerMemberDisplayColorResponse>())!;
        Assert.Equal(selected.RolesVersion, noOp.RolesVersion);
    }

    [Fact]
    public async Task DisplayColor_RejectsUnassignedRoleAndStaleRevisionAtomically()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        var assigned = await CreateColoredRoleAsync(ownerClient, "Assigned", "#AA1100");
        var unassigned = await CreateColoredRoleAsync(ownerClient, "Unassigned", "#00AA11");
        _ = await AssignToMemberAsync(ownerClient, assigned.Id);

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        var initial = (await memberClient
            .GetFromJsonAsync<ServerMemberDisplayColorResponse>(DisplayColorPath))!;

        using (var invalid = await memberClient.PatchAsJsonAsync(
                   DisplayColorPath,
                   new UpdateServerMemberDisplayColorRequest
                   {
                       Mode = "role",
                       RoleId = unassigned.Id,
                       ExpectedRolesVersion = initial.RolesVersion
                   }))
        {
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        }

        var unchanged = (await memberClient
            .GetFromJsonAsync<ServerMemberDisplayColorResponse>(DisplayColorPath))!;
        Assert.Equal(initial.RolesVersion, unchanged.RolesVersion);
        Assert.Equal("auto", unchanged.Mode);

        using (var current = await memberClient.PatchAsJsonAsync(
                   DisplayColorPath,
                   new UpdateServerMemberDisplayColorRequest
                   {
                       Mode = "default",
                       ExpectedRolesVersion = unchanged.RolesVersion
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(current);
        }

        using var stale = await memberClient.PatchAsJsonAsync(
            DisplayColorPath,
            new UpdateServerMemberDisplayColorRequest
            {
                Mode = "role",
                RoleId = assigned.Id,
                ExpectedRolesVersion = unchanged.RolesVersion
            });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var error = await stale.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal("server_member_display_color_conflict", error?.Code);
        var afterStale = (await memberClient
            .GetFromJsonAsync<ServerMemberDisplayColorResponse>(DisplayColorPath))!;
        Assert.Equal("default", afterStale.Mode);
        Assert.Null(afterStale.RoleId);
    }

    [Fact]
    public async Task RevokingSelectedRole_FallsBackToAutoInSameMutation()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        var role = await CreateColoredRoleAsync(ownerClient, "Temporary", "#334455");
        var assignment = await AssignToMemberAsync(ownerClient, role.Id);

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        var initial = (await memberClient
            .GetFromJsonAsync<ServerMemberDisplayColorResponse>(DisplayColorPath))!;
        using (var select = await memberClient.PatchAsJsonAsync(
                   DisplayColorPath,
                   new UpdateServerMemberDisplayColorRequest
                   {
                       Mode = "role",
                       RoleId = role.Id,
                       ExpectedRolesVersion = initial.RolesVersion
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(select);
        }

        using (var revoke = await ownerClient.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/" +
                   assignment.Id))
        {
            Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);
        }

        var fallback = (await memberClient
            .GetFromJsonAsync<ServerMemberDisplayColorResponse>(DisplayColorPath))!;
        Assert.Equal("auto", fallback.Mode);
        Assert.Null(fallback.RoleId);
        Assert.Null(fallback.ResolvedRoleId);
        Assert.Null(fallback.ResolvedColor);
        Assert.DoesNotContain(fallback.AvailableRoles, option => option.Id == role.Id);
    }

    [Fact]
    public async Task RemovingSelectedRoleColor_FallsBackToAutoInSameMutation()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        var role = await CreateColoredRoleAsync(ownerClient, "Color removed", "#778899");
        _ = await AssignToMemberAsync(ownerClient, role.Id);

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        var initial = (await memberClient
            .GetFromJsonAsync<ServerMemberDisplayColorResponse>(DisplayColorPath))!;
        using (var select = await memberClient.PatchAsJsonAsync(
                   DisplayColorPath,
                   new UpdateServerMemberDisplayColorRequest
                   {
                       Mode = "role",
                       RoleId = role.Id,
                       ExpectedRolesVersion = initial.RolesVersion
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(select);
        }

        var selected = (await memberClient
            .GetFromJsonAsync<ServerMemberDisplayColorResponse>(DisplayColorPath))!;
        using (var removeColor = await ownerClient.PatchAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{role.Id}",
                   new UpdateServerRoleRequest
                   {
                       Title = role.Title,
                       Color = null,
                       Mentionable = role.Mentionable,
                       PermissionCodes = role.Permissions.Select(item => item.Code).ToList(),
                       ExpectedVersion = role.Version
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(removeColor);
        }

        var fallback = (await memberClient
            .GetFromJsonAsync<ServerMemberDisplayColorResponse>(DisplayColorPath))!;
        Assert.NotEqual(selected.RolesVersion, fallback.RolesVersion);
        Assert.Equal("auto", fallback.Mode);
        Assert.Null(fallback.RoleId);
        Assert.Null(fallback.ResolvedRoleId);
        Assert.Empty(fallback.AvailableRoles);
    }

    private static async Task<ServerRoleResponse> CreateColoredRoleAsync(
        HttpClient client,
        string title,
        string color)
    {
        using var create = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest { Title = title });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(create);
        var role = (await create.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
        using var update = await client.PatchAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{role.Id}",
            new UpdateServerRoleRequest
            {
                Title = role.Title,
                Color = color,
                Mentionable = false,
                PermissionCodes = [],
                ExpectedVersion = role.Version
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(update);
        return (await update.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static async Task<ServerMemberRoleResponse> AssignToMemberAsync(
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

    private static string DisplayColorPath =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/me/display-color";

    private sealed class ErrorResponse
    {
        public string? Code { get; set; }
    }
}
