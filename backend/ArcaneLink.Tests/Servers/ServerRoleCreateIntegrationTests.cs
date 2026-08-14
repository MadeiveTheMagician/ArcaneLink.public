using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerRoleCreateIntegrationTests
{
    [Fact]
    public async Task CreateRole_DefaultRequestCreatesSafeEmptyDraft()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var response = await client.PostAsJsonAsync(
            RolesPath,
            new CreateServerRoleRequest { Title = "  Draft role  " });

        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var role = (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
        Assert.Equal("Draft role", role.Title);
        Assert.Null(role.Description);
        Assert.Null(role.Color);
        Assert.False(role.Mentionable);
        Assert.Empty(role.Permissions);
        Assert.Equal(0, role.DirectAssignmentCount);
        Assert.False(role.IsSystem);
    }

    [Fact]
    public async Task CreateRole_NormalizesAppearanceAndRejectsUnknownPermissionAtomically()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using (var configuredResponse = await client.PostAsJsonAsync(
                   RolesPath,
                   new CreateServerRoleRequest
                   {
                       Title = "Configured role",
                       Description = "  Description  ",
                       Color = "#AABBCCDD",
                       Mentionable = true,
                       PermissionCodes = [" MANAGE_INVITES ", "manage_invites"]
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(configuredResponse);
            var configured = (await configuredResponse.Content
                .ReadFromJsonAsync<ServerRoleResponse>())!;
            Assert.Equal("Description", configured.Description);
            Assert.Equal("#aabbccdd", configured.Color);
            Assert.True(configured.Mentionable);
            Assert.Equal(
                ["manage_invites"],
                configured.Permissions.Select(item => item.Code));
        }

        var before = await CountRolesAsync(factory);
        using var invalid = await client.PostAsJsonAsync(
            RolesPath,
            new CreateServerRoleRequest
            {
                Title = "Must not exist",
                PermissionCodes = ["unknown_permission"]
            });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var error = await invalid.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal("invalid_role_create", error?.Code);
        Assert.Equal(before, await CountRolesAsync(factory));
    }

    [Fact]
    public async Task CreateRole_DuplicateTitleReturnsConflict()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var first = await client.PostAsJsonAsync(
                   RolesPath,
                   new CreateServerRoleRequest { Title = "Unique title" }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(first);
        }

        using var duplicate = await client.PostAsJsonAsync(
            RolesPath,
            new CreateServerRoleRequest { Title = "Unique title" });

        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        var error = await duplicate.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal("server_role_title_conflict", error?.Code);
    }

    private static async Task<int> CountRolesAsync(ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.ServerRoles.AsNoTracking().CountAsync();
    }

    private static string RolesPath =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles";

    private sealed class ErrorResponse
    {
        public string? Code { get; set; }
    }
}
