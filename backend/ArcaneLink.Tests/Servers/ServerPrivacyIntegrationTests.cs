using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerPrivacyIntegrationTests
{
    [Fact]
    public async Task AvailableDiscovery_ExposesPublicAndRestrictedButHidesPrivate()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SeedDiscoveryMatrixAsync(factory);
        client.AuthorizeWith(await client.LoginAsync("outsider"));

        using var response = await client.GetAsync(
            "/api/servers/discover?visibility=available&query=Privacy%20Matrix&sort=name");
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var servers = await response.Content
            .ReadFromJsonAsync<List<ServerDiscoveryResponse>>() ?? [];

        Assert.Equal(2, servers.Count);
        var publicServer = Assert.Single(
            servers,
            server =>
                server.Server.AccessMode == ServerAccessModeCodes.Public);
        Assert.Equal("Privacy Matrix Public", publicServer.Server.Title);
        Assert.Equal(ServerJoinActionCodes.Join, publicServer.JoinAction);
        Assert.Null(publicServer.CurrentUserJoinRequest);

        var restrictedServer = Assert.Single(
            servers,
            server =>
                server.Server.AccessMode == ServerAccessModeCodes.Restricted);
        Assert.Equal("Privacy Matrix Restricted", restrictedServer.Server.Title);
        Assert.Equal(ServerJoinActionCodes.Request, restrictedServer.JoinAction);
        Assert.Null(restrictedServer.CurrentUserJoinRequest);
        Assert.DoesNotContain(
            servers,
            server => server.Server.AccessMode == ServerAccessModeCodes.Private);
    }

    [Fact]
    public async Task PublicServer_JoinIsImmediateAndIdempotent()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetAccessModeAsync(factory, ServerAccessModeCodes.Public);
        client.AuthorizeWith(await client.LoginAsync("outsider"));

        var first = await JoinAsync(client);
        var second = await JoinAsync(client);

        Assert.Equal(ServerJoinResultStatusCodes.Joined, first.Status);
        Assert.NotNull(first.Membership);
        Assert.Null(first.JoinRequest);
        Assert.Equal(
            ArcaneLinkApiFactory.OutsiderUserId,
            first.Membership.UserId);
        Assert.Equal("active", first.Membership.StatusCode);
        Assert.Equal(first.Membership.Id, second.Membership?.Id);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(
            1,
            await db.ServerMembers.CountAsync(member =>
                member.ServerId == ArcaneLinkApiFactory.ServerId &&
                member.UserId == ArcaneLinkApiFactory.OutsiderUserId &&
                member.StatusId == ServerMemberStatusIds.Active));
        Assert.False(await db.ServerJoinRequests.AnyAsync(request =>
            request.ServerId == ArcaneLinkApiFactory.ServerId &&
            request.UserId == ArcaneLinkApiFactory.OutsiderUserId));
    }

    [Fact]
    public async Task PrivateServer_RejectsDirectJoinWithoutCreatingState()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("outsider"));

        using var response = await client.PostAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/join",
            null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.ServerMembers.AnyAsync(member =>
            member.ServerId == ArcaneLinkApiFactory.ServerId &&
            member.UserId == ArcaneLinkApiFactory.OutsiderUserId));
        Assert.False(await db.ServerJoinRequests.AnyAsync(request =>
            request.ServerId == ArcaneLinkApiFactory.ServerId &&
            request.UserId == ArcaneLinkApiFactory.OutsiderUserId));
    }

    [Fact]
    public async Task PrivateServer_MetadataIsVisibleToMembersButHiddenFromOutsiders()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("outsider"));

        using (var byId = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}"))
        {
            Assert.Equal(HttpStatusCode.NotFound, byId.StatusCode);
        }
        using (var bySlug = await client.GetAsync(
                   "/api/servers/by-slug/test-server"))
        {
            Assert.Equal(HttpStatusCode.NotFound, bySlug.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        var byIdForMember = await client.GetFromJsonAsync<ServerResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}");
        var bySlugForMember = await client.GetFromJsonAsync<ServerResponse>(
            "/api/servers/by-slug/test-server");

        Assert.Equal(ServerAccessModeCodes.Private, byIdForMember?.AccessMode);
        Assert.Equal(ArcaneLinkApiFactory.ServerId, bySlugForMember?.Id);
    }

    private static async Task<ServerJoinResponse> JoinAsync(HttpClient client)
    {
        using var response = await client.PostAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/join",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerJoinResponse>())!;
    }

    private static async Task SetAccessModeAsync(
        ArcaneLinkApiFactory factory,
        string accessMode)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var server = await db.Servers.SingleAsync(
            candidate => candidate.Id == ArcaneLinkApiFactory.ServerId);
        server.AccessMode = accessMode;
        await db.SaveChangesAsync();
    }

    private static async Task SeedDiscoveryMatrixAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var seeded = await db.Servers.SingleAsync(
            server => server.Id == ArcaneLinkApiFactory.ServerId);
        seeded.Title = "Privacy Matrix Private";
        seeded.AccessMode = ServerAccessModeCodes.Private;
        var now = DateTime.UtcNow;

        db.Servers.AddRange(
            CreateDiscoveryServer(
                "Privacy Matrix Public",
                "privacy-matrix-public",
                ServerAccessModeCodes.Public,
                now),
            CreateDiscoveryServer(
                "Privacy Matrix Restricted",
                "privacy-matrix-restricted",
                ServerAccessModeCodes.Restricted,
                now));
        await db.SaveChangesAsync();
    }

    private static Server CreateDiscoveryServer(
        string title,
        string slug,
        string accessMode,
        DateTime now)
    {
        return new Server
        {
            Id = Guid.NewGuid(),
            CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            OwnerUserId = ArcaneLinkApiFactory.OwnerUserId,
            Slug = slug,
            Title = title,
            AccessMode = accessMode,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };
    }
}
