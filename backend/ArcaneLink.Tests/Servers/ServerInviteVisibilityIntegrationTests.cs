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

public sealed class ServerInviteVisibilityIntegrationTests
{
    [Fact]
    public async Task PublicServerMemberWithoutPermission_CannotManageInvites()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await MakeServerPublicAsync(factory);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var ownerInvite = await CreateLinkInviteAsync(client);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var createResponse = await client.PostAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
                   new CreateServerInviteRequest { KindCode = "link" }))
        {
            Assert.Equal(HttpStatusCode.NotFound, createResponse.StatusCode);
        }
        using (var listResponse = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites"))
        {
            Assert.Equal(HttpStatusCode.NotFound, listResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var ownerView = await GetServerInvitesAsync(client);

        Assert.Contains(ownerView, invite => invite.Id == ownerInvite.Id);
        Assert.Single(ownerView);
    }

    [Theory]
    [InlineData("manage_invites")]
    [InlineData("manage_server")]
    public async Task MemberWithInviteManagementPermission_ListsAllServerInvites(
        string permissionCode)
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await GrantPermissionToMemberAsync(factory, permissionCode);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var ownerInvite = await CreateLinkInviteAsync(client);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var memberInvite = await CreateLinkInviteAsync(client);
        var memberView = await GetServerInvitesAsync(client);

        Assert.Contains(memberView, invite => invite.Id == ownerInvite.Id);
        Assert.Contains(memberView, invite => invite.Id == memberInvite.Id);
    }

    private static async Task MakeServerPublicAsync(ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var server = await db.Servers.SingleAsync(
            candidate => candidate.Id == ArcaneLinkApiFactory.ServerId);

        server.AccessMode = ServerAccessModeCodes.Public;
        await db.SaveChangesAsync();
    }

    private static async Task GrantPermissionToMemberAsync(
        ArcaneLinkApiFactory factory,
        string permissionCode)
    {
        var permissionId = permissionCode switch
        {
            "manage_invites" => ServerGovernanceIds.PermissionManageInvites,
            "manage_server" => ServerGovernanceIds.PermissionManageServer,
            _ => throw new ArgumentOutOfRangeException(
                nameof(permissionCode),
                permissionCode,
                "Unsupported server permission code.")
        };
        var now = DateTime.UtcNow;
        var role = new ServerRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            Title = $"Invite visibility ({permissionCode})",
            Level = 10,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        role.Permissions.Add(new ServerRolePermission
        {
            RoleId = role.Id,
            PermissionId = permissionId,
            IsGranted = true,
            CreatedAt = now
        });

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.ServerRoles.Add(role);
        db.ServerMemberRoles.Add(new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            MemberId = ArcaneLinkApiFactory.MemberMemberId,
            RoleId = role.Id,
            AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            AssignedAt = now
        });
        await db.SaveChangesAsync();
    }

    private static async Task<ServerInviteResponse> CreateLinkInviteAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
            new CreateServerInviteRequest { KindCode = "link" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);

        return (await response.Content.ReadFromJsonAsync<ServerInviteResponse>())!;
    }

    private static async Task<IReadOnlyList<ServerInviteResponse>> GetServerInvitesAsync(
        HttpClient client)
    {
        return await client.GetFromJsonAsync<List<ServerInviteResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites") ?? [];
    }
}
