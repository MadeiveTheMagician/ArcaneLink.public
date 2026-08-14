using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Spaces;

public sealed class SpaceReorderIntegrationTests
{
    [Fact]
    public async Task CategoryMove_RejectsFinalSubtreeDepthBeyondLimit()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var destinationRoot = await CreateSpaceAsync(client, "category", "destination root");
        var destinationChild = await CreateSpaceAsync(
            client,
            "category",
            "destination child",
            destinationRoot.Id);
        var movingRoot = await CreateSpaceAsync(client, "category", "moving root");
        var movingChild = await CreateSpaceAsync(
            client,
            "category",
            "moving child",
            movingRoot.Id);

        using var tooDeepResponse = await ReorderAsync(
            client,
            Position(movingRoot.Id, destinationChild.Id));
        Assert.Equal(HttpStatusCode.NotFound, tooDeepResponse.StatusCode);
        Assert.Null(await GetParentSpaceIdAsync(factory, movingRoot.Id));

        using var validResponse = await ReorderAsync(
            client,
            Position(movingRoot.Id, destinationRoot.Id));
        Assert.Equal(HttpStatusCode.NoContent, validResponse.StatusCode);
        Assert.Equal(
            destinationRoot.Id,
            await GetParentSpaceIdAsync(factory, movingRoot.Id));
        Assert.Equal(
            movingRoot.Id,
            await GetParentSpaceIdAsync(factory, movingChild.Id));
    }

    [Fact]
    public async Task CategoryMove_RequiresManageOnEveryDescendant()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var destination = await CreateSpaceAsync(client, "category", "destination");
        var movingRoot = await CreateSpaceAsync(client, "category", "moving root");
        var descendant = await CreateSpaceAsync(
            client,
            "text_room",
            "protected descendant",
            movingRoot.Id);
        await SetMemberManageAsync(client, destination.Id, allow: true, deny: false);
        await SetMemberManageAsync(client, movingRoot.Id, allow: true, deny: false);
        await SetMemberManageAsync(client, descendant.Id, allow: false, deny: true);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var deniedResponse = await ReorderAsync(
            client,
            Position(movingRoot.Id, destination.Id));
        Assert.Equal(HttpStatusCode.NotFound, deniedResponse.StatusCode);
        Assert.Null(await GetParentSpaceIdAsync(factory, movingRoot.Id));

        client.AuthorizeWith(await client.LoginAsync("owner"));
        await SetMemberManageAsync(client, descendant.Id, allow: true, deny: false);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var allowedResponse = await ReorderAsync(
            client,
            Position(movingRoot.Id, destination.Id));
        Assert.Equal(HttpStatusCode.NoContent, allowedResponse.StatusCode);
        Assert.Equal(
            destination.Id,
            await GetParentSpaceIdAsync(factory, movingRoot.Id));
    }

    [Fact]
    public async Task CategoryMove_RequiresManageOnDestinationAncestors()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var destinationRoot = await CreateSpaceAsync(client, "category", "destination root");
        var destinationChild = await CreateSpaceAsync(
            client,
            "category",
            "destination child",
            destinationRoot.Id);
        var movingRoot = await CreateSpaceAsync(client, "category", "moving root");
        await SetMemberManageAsync(client, movingRoot.Id, allow: true, deny: false);
        await SetMemberManageAsync(client, destinationRoot.Id, allow: false, deny: true);
        await SetMemberManageAsync(client, destinationChild.Id, allow: true, deny: false);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var deniedResponse = await ReorderAsync(
            client,
            Position(movingRoot.Id, destinationChild.Id));
        Assert.Equal(HttpStatusCode.NotFound, deniedResponse.StatusCode);
        Assert.Null(await GetParentSpaceIdAsync(factory, movingRoot.Id));

        client.AuthorizeWith(await client.LoginAsync("owner"));
        await SetMemberManageAsync(client, destinationRoot.Id, allow: true, deny: false);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var allowedResponse = await ReorderAsync(
            client,
            Position(movingRoot.Id, destinationChild.Id));
        Assert.Equal(HttpStatusCode.NoContent, allowedResponse.StatusCode);
        Assert.Equal(
            destinationChild.Id,
            await GetParentSpaceIdAsync(factory, movingRoot.Id));
    }

    [Fact]
    public async Task SpaceManager_CannotMoveCategoryToServerRoot()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var parent = await CreateSpaceAsync(client, "category", "parent");
        var movingCategory = await CreateSpaceAsync(
            client,
            "category",
            "moving category",
            parent.Id);
        await SetMemberManageAsync(client, movingCategory.Id, allow: true, deny: false);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var response = await ReorderAsync(
            client,
            Position(movingCategory.Id, parentSpaceId: null));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(
            parent.Id,
            await GetParentSpaceIdAsync(factory, movingCategory.Id));
    }

    private static async Task<SpaceResponse> CreateSpaceAsync(
        HttpClient client,
        string typeCode,
        string title,
        Guid? parentSpaceId = null)
    {
        using var response = await client.PostAsJsonAsync(
            SpacesPath(),
            new CreateSpaceRequest
            {
                TypeCode = typeCode,
                ParentSpaceId = parentSpaceId,
                Title = title
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);

        return (await response.Content.ReadFromJsonAsync<SpaceResponse>())!;
    }

    private static async Task SetMemberManageAsync(
        HttpClient client,
        Guid spaceId,
        bool allow,
        bool deny)
    {
        using var response = await client.PutAsJsonAsync(
            $"{SpacesPath()}/{spaceId}/permission-overrides",
            new UpsertSpacePermissionOverrideRequest
            {
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                PermissionId = SpacePermissionIds.ManageSpace,
                Allow = allow,
                Deny = deny
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
    }

    private static Task<HttpResponseMessage> ReorderAsync(
        HttpClient client,
        params SpacePositionRequest[] positions)
    {
        return client.PutAsJsonAsync(
            $"{SpacesPath()}/reorder",
            new ReorderSpacesRequest { Spaces = positions });
    }

    private static SpacePositionRequest Position(
        Guid spaceId,
        Guid? parentSpaceId,
        int position = 0)
    {
        return new SpacePositionRequest
        {
            SpaceId = spaceId,
            ParentSpaceId = parentSpaceId,
            Position = position
        };
    }

    private static async Task<Guid?> GetParentSpaceIdAsync(
        ArcaneLinkApiFactory factory,
        Guid spaceId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Spaces
            .AsNoTracking()
            .Where(space => space.Id == spaceId)
            .Select(space => space.ParentSpaceId)
            .SingleAsync();
    }

    private static string SpacesPath()
    {
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces";
    }
}
