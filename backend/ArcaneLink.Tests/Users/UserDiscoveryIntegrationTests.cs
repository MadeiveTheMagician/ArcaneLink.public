using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Users;

public sealed class UserDiscoveryIntegrationTests
{
    [Fact]
    public async Task SharedServerScope_ReturnsOnlyUsersFromCurrentUsersServers()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var users = await GetUsersAsync(
            client,
            "/api/users/discover?scope=shared-servers&sort=name");

        Assert.Contains(users, x => x.Id == ArcaneLinkApiFactory.MemberUserId);
        Assert.DoesNotContain(users, x => x.Id == ArcaneLinkApiFactory.OutsiderUserId);
    }

    [Fact]
    public async Task OnlineFilter_ReturnsOnlyConnectedVisibleUsers()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        factory.Services
            .GetRequiredService<RealtimeConnectionRegistry>()
            .Register(
                ArcaneLinkApiFactory.MemberUserId,
                $"discovery-{Guid.NewGuid():N}");
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var users = await GetUsersAsync(
            client,
            "/api/users/discover?scope=all&online=true&sort=name");

        Assert.Contains(users, x => x.Id == ArcaneLinkApiFactory.MemberUserId);
        Assert.DoesNotContain(users, x => x.Id == ArcaneLinkApiFactory.OutsiderUserId);
    }

    [Fact]
    public async Task TagFilter_ReturnsOnlyUsersWithSelectedTags()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddProfileTagsAsync(
            factory,
            (ArcaneLinkApiFactory.OutsiderUserId, ProfileTagIds.Art));
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var users = await GetUsersAsync(
            client,
            $"/api/users/discover?scope=all&sort=name&tagIds={ProfileTagIds.Art}");

        var user = Assert.Single(users);
        Assert.Equal(ArcaneLinkApiFactory.OutsiderUserId, user.Id);
        Assert.Contains(user.Tags, x => x.Id == ProfileTagIds.Art);
    }

    [Fact]
    public async Task RecommendedSort_PrioritizesHigherCombinedScore()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddProfileTagsAsync(
            factory,
            (ArcaneLinkApiFactory.OwnerUserId, ProfileTagIds.Art),
            (ArcaneLinkApiFactory.OwnerUserId, ProfileTagIds.Music),
            (ArcaneLinkApiFactory.OutsiderUserId, ProfileTagIds.Art),
            (ArcaneLinkApiFactory.OutsiderUserId, ProfileTagIds.Music));
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var users = await GetUsersAsync(
            client,
            "/api/users/discover?scope=all&sort=recommended");

        var outsiderIndex = users.FindIndex(
            x => x.Id == ArcaneLinkApiFactory.OutsiderUserId);
        var memberIndex = users.FindIndex(
            x => x.Id == ArcaneLinkApiFactory.MemberUserId);

        Assert.True(outsiderIndex >= 0);
        Assert.True(memberIndex >= 0);
        Assert.True(outsiderIndex < memberIndex);
        Assert.True(users[outsiderIndex].RecommendationScore > users[memberIndex].RecommendationScore);
        Assert.Equal(2, users[outsiderIndex].SharedTagCount);
        Assert.Equal(1, users[memberIndex].MutualServerCount);
    }

    private static async Task<List<FriendUserResponse>> GetUsersAsync(
        HttpClient client,
        string requestUri)
    {
        var response = await client.GetAsync(requestUri);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);

        return await response.Content.ReadFromJsonAsync<List<FriendUserResponse>>() ?? [];
    }

    private static async Task AddProfileTagsAsync(
        ArcaneLinkApiFactory factory,
        params (Guid UserId, Guid TagId)[] tags)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;

        db.UserProfileTags.AddRange(tags.Select(x => new UserProfileTag
        {
            UserId = x.UserId,
            TagId = x.TagId,
            CreatedAt = now
        }));
        await db.SaveChangesAsync();
    }
}
