using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerRolePermissionMaskPersistenceIntegrationTests
{
    [Fact]
    public async Task ServerCreation_PersistsOwnerAndDefaultEveryoneMasks()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var response = await client.PostAsJsonAsync(
            "/api/servers",
            new CreateServerRequest { Title = "Mask persistence server" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var server = (await response.Content.ReadFromJsonAsync<ServerResponse>())!;

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ownerRole = await db.ServerRoles
            .AsNoTracking()
            .SingleAsync(role =>
                role.ServerId == server.Id &&
                role.Code == "owner");

        AssertOwnerCompatibilityMask(ownerRole.PermissionMask);
        Assert.Equal(
            ServerPermissionRegistry.SchemaVersion,
            ownerRole.PermissionSchemaVersion);

        var everyoneRole = await db.ServerRoles
            .AsNoTracking()
            .SingleAsync(role =>
                role.ServerId == server.Id &&
                role.Kind == ServerRoleKindCodes.Everyone);
        Assert.Equal("everyone", everyoneRole.Code);
        Assert.Equal("@everyone", everyoneRole.Title);
        Assert.True(everyoneRole.IsSystem);
        Assert.True(ServerRolePermissionMaskCodec.TryDecode(
            everyoneRole.PermissionMask,
            everyoneRole.PermissionSchemaVersion,
            out var everyoneMask));
        Assert.Equal(
            ServerPermissionRegistry.DefaultEveryonePermissionsMask,
            everyoneMask);
    }

    [Fact]
    public async Task OwnerRoleRepair_BackfillsThePersistedCompatibilityMask()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var response = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles");
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ownerRole = await db.ServerRoles
            .AsNoTracking()
            .SingleAsync(role =>
                role.ServerId == ArcaneLinkApiFactory.ServerId &&
                role.Code == "owner");

        AssertOwnerCompatibilityMask(ownerRole.PermissionMask);
        Assert.Equal(
            ServerPermissionRegistry.SchemaVersion,
            ownerRole.PermissionSchemaVersion);
    }

    [Fact]
    public async Task DefaultEveryoneRole_OwnerCanUpdateOnlyItsPermissionMask()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var createResponse = await client.PostAsJsonAsync(
            "/api/servers",
            new CreateServerRequest { Title = "Default role update server" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
        var server = (await createResponse.Content.ReadFromJsonAsync<ServerResponse>())!;

        ServerRole everyoneRole;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            everyoneRole = await db.ServerRoles
                .AsNoTracking()
                .SingleAsync(role =>
                    role.ServerId == server.Id &&
                    role.Kind == ServerRoleKindCodes.Everyone);
        }

        var nextCodes = ServerPermissionRegistry.DefaultEveryonePermissionCodes
            .Where(code => code != "SEND_LINKS")
            .ToArray();
        using var updateResponse = await client.PatchAsJsonAsync(
            $"/api/servers/{server.Id}/roles/{everyoneRole.Id}",
            new UpdateServerRoleRequest
            {
                Title = everyoneRole.Title,
                Description = everyoneRole.Description,
                Color = everyoneRole.Color,
                Mentionable = everyoneRole.Mentionable,
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                PermissionCodes = nextCodes,
                ExpectedVersion = everyoneRole.Version
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(updateResponse);

        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var updated = await verifyDb.ServerRoles
            .AsNoTracking()
            .SingleAsync(role => role.Id == everyoneRole.Id);
        Assert.True(ServerRolePermissionMaskCodec.TryDecode(
            updated.PermissionMask,
            updated.PermissionSchemaVersion,
            out var actual));
        Assert.Equal(ServerPermissionRegistry.CreateMask(nextCodes), actual);
        Assert.Equal("@everyone", updated.Title);
        Assert.True(updated.IsSystem);
    }

    private static void AssertOwnerCompatibilityMask(byte[] storedMask)
    {
        var adapter = new LegacyServerPermissionMaskAdapter();
        Assert.True(adapter.TryCreateMask(
            ServerGovernanceIds.ServerPermissionIds,
            out var expected));
        Assert.True(ServerRolePermissionMaskCodec.TryDecode(
            storedMask,
            ServerPermissionRegistry.SchemaVersion,
            out var actual));
        Assert.Equal(expected, actual);
    }
}
