using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Spaces;

public sealed class ServerSpaceAclRevisionIntegrationTests
{
    [Fact]
    public async Task StagedBumps_AlwaysUseFreshRevisionIncludingStaleLastWriter()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        using var firstScope = factory.Services.CreateScope();
        using var secondScope = factory.Services.CreateScope();
        var firstDb = firstScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var secondDb = secondScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var originalRevision = await firstDb.Servers
            .Where(server => server.Id == ArcaneLinkApiFactory.ServerId)
            .Select(server => server.SpaceAclRevision)
            .SingleAsync();

        var firstRevision = await firstDb.StageServerAclRevisionBumpAsync(
            ArcaneLinkApiFactory.ServerId);
        var secondRevision = await secondDb.StageServerAclRevisionBumpAsync(
            ArcaneLinkApiFactory.ServerId);

        Assert.NotEqual(Guid.Empty, originalRevision);
        Assert.NotEqual(originalRevision, firstRevision);
        Assert.NotEqual(originalRevision, secondRevision);
        Assert.NotEqual(firstRevision, secondRevision);

        await firstDb.SaveChangesAsync();
        await secondDb.SaveChangesAsync();

        Assert.Equal(secondRevision, await ReadRevisionAsync(factory));
    }

    [Fact]
    public async Task SpaceCrudReorderAndOverrides_BumpRevisionAfterEveryMutation()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var revision = await ReadRevisionAsync(factory);
        var spacesPath = $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces";

        using var createResponse = await client.PostAsJsonAsync(
            spacesPath,
            new CreateSpaceRequest
            {
                TypeCode = "category",
                Title = "ACL revision category"
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
        var space = (await createResponse.Content.ReadFromJsonAsync<SpaceResponse>())!;
        revision = await AssertRevisionChangedAsync(factory, revision);

        using var updateResponse = await client.PatchAsJsonAsync(
            $"{spacesPath}/{space.Id}",
            new UpdateSpaceRequest { Title = "Updated ACL revision category" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(updateResponse);
        revision = await AssertRevisionChangedAsync(factory, revision);

        using var reorderResponse = await client.PutAsJsonAsync(
            $"{spacesPath}/reorder",
            new ReorderSpacesRequest
            {
                Spaces =
                [
                    new SpacePositionRequest
                    {
                        SpaceId = space.Id,
                        ParentSpaceId = null,
                        Position = 42
                    }
                ]
            });
        reorderResponse.EnsureSuccessStatusCode();
        revision = await AssertRevisionChangedAsync(factory, revision);

        using var upsertOverrideResponse = await client.PutAsJsonAsync(
            $"{spacesPath}/{space.Id}/permission-overrides",
            new UpsertSpacePermissionOverrideRequest
            {
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                PermissionId = SpacePermissionIds.ViewSpace,
                Allow = false,
                Deny = true
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(upsertOverrideResponse);
        var permissionOverride = (await upsertOverrideResponse.Content
            .ReadFromJsonAsync<SpacePermissionOverrideResponse>())!;
        revision = await AssertRevisionChangedAsync(factory, revision);

        using var deleteOverrideResponse = await client.DeleteAsync(
            $"{spacesPath}/{space.Id}/permission-overrides/{permissionOverride.Id}");
        deleteOverrideResponse.EnsureSuccessStatusCode();
        revision = await AssertRevisionChangedAsync(factory, revision);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"{spacesPath}/{space.Id}")
        {
            Content = JsonContent.Create(new DeleteSpaceRequest())
        };
        using var deleteResponse = await client.SendAsync(deleteRequest);
        deleteResponse.EnsureSuccessStatusCode();
        await AssertRevisionChangedAsync(factory, revision);
    }

    [Fact]
    public async Task RolePermissionAssignmentAndRevocation_BumpRevision()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var rolesPath = $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles";

        using var createResponse = await client.PostAsJsonAsync(
            rolesPath,
            new CreateServerRoleRequest
            {
                Title = "ACL revision role",
                PermissionCodes = ["manage_invites"]
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
        var role = (await createResponse.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
        var revision = await ReadRevisionAsync(factory);

        using var updateResponse = await client.PatchAsJsonAsync(
            $"{rolesPath}/{role.Id}/permissions",
            new UpdateServerRolePermissionsRequest
            {
                PermissionCodes = ["manage_members"]
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(updateResponse);
        revision = await AssertRevisionChangedAsync(factory, revision);

        using var assignResponse = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{ArcaneLinkApiFactory.MemberMemberId}/roles",
            new AssignServerRoleRequest { RoleId = role.Id });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(assignResponse);
        var assignment = (await assignResponse.Content
            .ReadFromJsonAsync<ServerMemberRoleResponse>())!;
        revision = await AssertRevisionChangedAsync(factory, revision);

        using var revokeResponse = await client.DeleteAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/{assignment.Id}");
        revokeResponse.EnsureSuccessStatusCode();
        revision = await AssertRevisionChangedAsync(factory, revision);

        using var restoreResponse = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{ArcaneLinkApiFactory.MemberMemberId}/roles",
            new AssignServerRoleRequest { RoleId = role.Id });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(restoreResponse);
        await AssertRevisionChangedAsync(factory, revision);
    }

    [Fact]
    public async Task MembershipJoinLeaveRejoinAndRemoval_BumpRevision()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var ownerToken = await client.LoginAsync("owner");
        var outsiderToken = await client.LoginAsync("outsider");

        client.AuthorizeWith(ownerToken);
        var firstInvite = await CreateDirectInviteAsync(client);
        var revision = await ReadRevisionAsync(factory);

        client.AuthorizeWith(outsiderToken);
        using var firstAcceptResponse = await client.PostAsync(
            $"/api/server-invites/{firstInvite.Id}/accept",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(firstAcceptResponse);
        revision = await AssertRevisionChangedAsync(factory, revision);

        using var leaveResponse = await client.DeleteAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/me");
        leaveResponse.EnsureSuccessStatusCode();
        revision = await AssertRevisionChangedAsync(factory, revision);

        client.AuthorizeWith(ownerToken);
        var secondInvite = await CreateDirectInviteAsync(client);
        var revisionBeforeRejoin = await ReadRevisionAsync(factory);
        Assert.Equal(revision, revisionBeforeRejoin);

        client.AuthorizeWith(outsiderToken);
        using var secondAcceptResponse = await client.PostAsync(
            $"/api/server-invites/{secondInvite.Id}/accept",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(secondAcceptResponse);
        revision = await AssertRevisionChangedAsync(factory, revisionBeforeRejoin);

        var outsiderMemberId = await ReadMemberIdAsync(
            factory,
            ArcaneLinkApiFactory.OutsiderUserId);
        client.AuthorizeWith(ownerToken);
        using var removeResponse = await client.DeleteAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{outsiderMemberId}");
        removeResponse.EnsureSuccessStatusCode();
        await AssertRevisionChangedAsync(factory, revision);
    }

    [Fact]
    public async Task OwnershipTransfer_BumpsRevision()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var revision = await ReadRevisionAsync(factory);

        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/ownership-transfers",
            new TransferServerOwnershipRequest
            {
                ToMemberId = ArcaneLinkApiFactory.MemberMemberId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);

        await AssertRevisionChangedAsync(factory, revision);
    }

    private static async Task<ServerInviteResponse> CreateDirectInviteAsync(
        HttpClient client)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
            new CreateServerInviteRequest
            {
                KindCode = "direct",
                TargetUserId = ArcaneLinkApiFactory.OutsiderUserId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerInviteResponse>())!;
    }

    private static async Task<Guid> AssertRevisionChangedAsync(
        ArcaneLinkApiFactory factory,
        Guid previousRevision)
    {
        var revision = await ReadRevisionAsync(factory);

        Assert.NotEqual(Guid.Empty, revision);
        Assert.NotEqual(previousRevision, revision);
        return revision;
    }

    private static async Task<Guid> ReadRevisionAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Servers
            .AsNoTracking()
            .Where(server => server.Id == ArcaneLinkApiFactory.ServerId)
            .Select(server => server.SpaceAclRevision)
            .SingleAsync();
    }

    private static async Task<Guid> ReadMemberIdAsync(
        ArcaneLinkApiFactory factory,
        Guid userId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.ServerMembers
            .AsNoTracking()
            .Where(member =>
                member.ServerId == ArcaneLinkApiFactory.ServerId &&
                member.UserId == userId)
            .Select(member => member.Id)
            .SingleAsync();
    }
}
