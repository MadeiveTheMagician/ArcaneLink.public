using System.Net;
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

public sealed class ServerGranularGovernanceIntegrationTests
{
    [Fact]
    public async Task EveryonePermissions_AreIncludedInRoleManagementScope()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        var everyoneRoleId = Guid.NewGuid();
        Guid everyoneVersion;
        await using (var seedScope = factory.Services.CreateAsyncScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            var permissionCodes = ServerPermissionRegistry
                .DefaultEveryonePermissionCodes
                .Append("MANAGE_DEFAULT_PERMISSIONS")
                .ToArray();
            var everyoneRole = new ServerRole
            {
                Id = everyoneRoleId,
                ServerId = ArcaneLinkApiFactory.ServerId,
                Code = "everyone",
                Title = "@everyone",
                Kind = ServerRoleKindCodes.Everyone,
                Level = int.MaxValue,
                IsSystem = true,
                PermissionMask = ServerRolePermissionMaskCodec.Encode(
                    ServerPermissionRegistry.CreateMask(permissionCodes)),
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.ServerRoles.Add(everyoneRole);
            var server = await db.Servers.SingleAsync(item =>
                item.Id == ArcaneLinkApiFactory.ServerId);
            server.AuthorizationVersion = Guid.NewGuid();
            await db.SaveChangesAsync();
            everyoneVersion = everyoneRole.Version;
        }

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        using var response = await memberClient.PatchAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{everyoneRoleId}",
            new UpdateServerRoleRequest
            {
                Title = "@everyone",
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                PermissionCodes = ServerPermissionRegistry
                    .DefaultEveryonePermissionCodes
                    .Where(code => code != "MENTION_EVERYONE")
                    .Append("MANAGE_DEFAULT_PERMISSIONS")
                    .ToArray(),
                ExpectedVersion = everyoneVersion
            });

        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
    }

    [Fact]
    public async Task ManageDefaultPermissions_IsRequiredForTheEveryoneRole()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        var everyoneRoleId = Guid.NewGuid();
        Guid everyoneVersion;
        await using (var seedScope = factory.Services.CreateAsyncScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            var everyoneRole = new ServerRole
            {
                Id = everyoneRoleId,
                ServerId = ArcaneLinkApiFactory.ServerId,
                Code = "everyone",
                Title = "@everyone",
                Description = "Default permissions for every active server member",
                Kind = ServerRoleKindCodes.Everyone,
                Level = int.MaxValue,
                IsSystem = true,
                PermissionMask = ServerRolePermissionMaskCodec.Encode(
                    ServerPermissionRegistry.DefaultEveryonePermissionsMask),
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.ServerRoles.Add(everyoneRole);
            var server = await db.Servers.SingleAsync(item =>
                item.Id == ArcaneLinkApiFactory.ServerId);
            server.AuthorizationVersion = Guid.NewGuid();
            await db.SaveChangesAsync();
            everyoneVersion = everyoneRole.Version;
        }

        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        await GrantMemberAsync(ownerClient, "MANAGE_ROLES");
        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        var update = new UpdateServerRoleRequest
        {
            Title = "@everyone",
            Description = "Default permissions for every active server member",
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            PermissionCodes = ServerPermissionRegistry.DefaultEveryonePermissionCodes
                .Where(code => code != "MENTION_EVERYONE")
                .ToArray(),
            ExpectedVersion = everyoneVersion
        };

        using (var denied = await memberClient.PatchAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{everyoneRoleId}",
                   update))
        {
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        }

        await GrantMemberAsync(ownerClient, "MANAGE_DEFAULT_PERMISSIONS");
        // A delegated editor may only grant permissions it also owns. Grant the
        // compatibility baseline explicitly so the subset rule remains intact.
        await GrantMemberAsync(
            ownerClient,
            ServerPermissionRegistry.DefaultEveryonePermissionCodes);

        using var allowed = await memberClient.PatchAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{everyoneRoleId}",
            update);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(allowed);
    }

    [Fact]
    public async Task ManageRolesAndAssignRoles_AreIndependentCapabilities()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        var targetMemberId = Guid.NewGuid();
        await using (var seedScope = factory.Services.CreateAsyncScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            db.ServerMembers.Add(new ServerMember
            {
                Id = targetMemberId,
                ServerId = ArcaneLinkApiFactory.ServerId,
                UserId = ArcaneLinkApiFactory.OutsiderUserId,
                StatusId = ServerMemberStatusIds.Active,
                JoinedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            });
            await db.SaveChangesAsync();
        }

        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        await GrantMemberAsync(ownerClient, "MANAGE_ROLES");

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        using var createResponse = await memberClient.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = $"assign-target-{Guid.NewGuid():N}",
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                PermissionCodes = []
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
        var targetRole = (await createResponse.Content
            .ReadFromJsonAsync<ServerRoleResponse>())!;

        using (var denied = await memberClient.PostAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/" +
                   $"{targetMemberId}/roles",
                   new AssignServerRoleRequest { RoleId = targetRole.Id }))
        {
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        }

        await GrantMemberAsync(ownerClient, "ASSIGN_ROLES");
        using var allowed = await memberClient.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/" +
            $"{targetMemberId}/roles",
            new AssignServerRoleRequest { RoleId = targetRole.Id });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(allowed);
    }

    [Fact]
    public async Task ManageServerProfile_DoesNotGrantServerSettings()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        await GrantMemberAsync(ownerClient, "MANAGE_SERVER_PROFILE");

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        using (var profileResponse = await memberClient.PatchAsJsonAsync(
                   ServerPath,
                   new UpdateServerRequest { Title = "Granular profile title" }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(profileResponse);
        }

        using (var settingsResponse = await memberClient.PatchAsJsonAsync(
                   ServerPath,
                   new UpdateServerRequest { AccessMode = "public" }))
        {
            Assert.Equal(HttpStatusCode.NotFound, settingsResponse.StatusCode);
        }

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var server = await db.Servers.AsNoTracking().SingleAsync(item =>
            item.Id == ArcaneLinkApiFactory.ServerId);
        Assert.Equal("Granular profile title", server.Title);
        Assert.NotEqual("public", server.AccessMode);
    }

    [Fact]
    public async Task ManageServerSettings_DoesNotGrantProfile_AndMixedPatchIsAtomic()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var ownerClient = factory.CreateClient();
        ownerClient.AuthorizeWith(await ownerClient.LoginAsync("owner"));
        await GrantMemberAsync(ownerClient, "MANAGE_SERVER_SETTINGS");

        using var memberClient = factory.CreateClient();
        memberClient.AuthorizeWith(await memberClient.LoginAsync("member"));
        using (var settingsResponse = await memberClient.PatchAsJsonAsync(
                   ServerPath,
                   new UpdateServerRequest { AccessMode = "public" }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(settingsResponse);
        }

        using (var mixedResponse = await memberClient.PatchAsJsonAsync(
                   ServerPath,
                   new UpdateServerRequest
                   {
                       Title = "Must not be written",
                       AccessMode = "private"
                   }))
        {
            Assert.Equal(HttpStatusCode.NotFound, mixedResponse.StatusCode);
        }

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var server = await db.Servers.AsNoTracking().SingleAsync(item =>
            item.Id == ArcaneLinkApiFactory.ServerId);
        Assert.Equal("public", server.AccessMode);
        Assert.NotEqual("Must not be written", server.Title);
    }

    private static async Task GrantMemberAsync(
        HttpClient ownerClient,
        string permissionCode)
    {
        await GrantMemberAsync(ownerClient, [permissionCode]);
    }

    private static async Task GrantMemberAsync(
        HttpClient ownerClient,
        IReadOnlyList<string> permissionCodes)
    {
        using var createResponse = await ownerClient.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = $"granular-{Guid.NewGuid():N}",
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                PermissionCodes = permissionCodes
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
        var role = (await createResponse.Content
            .ReadFromJsonAsync<ServerRoleResponse>())!;

        using var assignResponse = await ownerClient.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/" +
            $"{ArcaneLinkApiFactory.MemberMemberId}/roles",
            new AssignServerRoleRequest { RoleId = role.Id });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(assignResponse);
    }

    private static string ServerPath =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}";
}
