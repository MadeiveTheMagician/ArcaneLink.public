using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Notifications;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.PrivateSpaces;

public sealed class DirectMessagePrivacyIntegrationTests
{
    [Fact]
    public async Task NewDirectConversation_CreatesOneInviteNotification_WithoutDuplicates()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var first = await OpenDirectSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var second = await OpenDirectSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);

        Assert.Equal(first.SpaceId, second.SpaceId);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var invitation = Assert.Single(
            await GetNotificationsAsync(client),
            notification =>
                notification.Kind == "private-space-invite" &&
                notification.SpaceId == first.SpaceId);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, invitation.ActorUserId);
        Assert.Null(invitation.InviteId);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        Assert.DoesNotContain(
            await GetNotificationsAsync(client),
            notification =>
                notification.Kind == "private-space-invite" &&
                notification.SpaceId == first.SpaceId);
    }

    [Fact]
    public async Task NobodyAndBlacklist_DenyAdmission_WithoutPartialRows()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetPermissionAsync(client, "outsider", "nobody");

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var denied = await client.PostAsync(
                   $"/api/private-spaces/direct/{ArcaneLinkApiFactory.OutsiderUserId}",
                   null))
        {
            Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        }

        await SetPermissionAsync(client, "member", "everyone");
        client.AuthorizeWith(await client.LoginAsync("member"));
        var blocked = await client.PutAsync(
            $"/api/users/me/direct-message-blocks/{ArcaneLinkApiFactory.OwnerUserId}",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(blocked);
        var block = await blocked.Content
            .ReadFromJsonAsync<DirectMessageBlockedUserResponse>();
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, block!.UserId);
        var blockPage = await client
            .GetFromJsonAsync<DirectMessageBlockedUsersPageResponse>(
                "/api/users/me/direct-message-blocks");
        Assert.Single(blockPage!.Items);
        Assert.Equal(1, blockPage.TotalCount);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var denied = await client.PostAsync(
                   $"/api/private-spaces/direct/{ArcaneLinkApiFactory.MemberUserId}",
                   null))
        {
            Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.PrivateSpaces.AnyAsync(space =>
            space.Members.Any(member =>
                member.UserId == ArcaneLinkApiFactory.OwnerUserId) &&
            space.Members.Any(member =>
                member.UserId == ArcaneLinkApiFactory.MemberUserId ||
                member.UserId == ArcaneLinkApiFactory.OutsiderUserId)));
        Assert.False(await db.UserNotifications.AnyAsync(notification =>
            notification.Kind == "private-space-invite" &&
            (notification.UserId == ArcaneLinkApiFactory.MemberUserId ||
             notification.UserId == ArcaneLinkApiFactory.OutsiderUserId)));
    }

    [Fact]
    public async Task Blocklist_StoresCommentsAndSupportsStatusAndCursorPagination()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var firstBlockResponse = await client.PutAsJsonAsync(
            $"/api/users/me/direct-message-blocks/{ArcaneLinkApiFactory.MemberUserId}",
            new UpdateDirectMessageBlockRequest
            {
                Comment = "  Не хочу забыть причину  "
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(firstBlockResponse);
        var firstBlock = (await firstBlockResponse.Content
            .ReadFromJsonAsync<DirectMessageBlockedUserResponse>())!;
        Assert.Equal("Не хочу забыть причину", firstBlock.Comment);

        using var updateResponse = await client.PutAsJsonAsync(
            $"/api/users/me/direct-message-blocks/{ArcaneLinkApiFactory.MemberUserId}",
            new UpdateDirectMessageBlockRequest
            {
                Comment = "Обновлённая причина"
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(updateResponse);
        var updatedBlock = (await updateResponse.Content
            .ReadFromJsonAsync<DirectMessageBlockedUserResponse>())!;
        Assert.Equal(firstBlock.CreatedAt, updatedBlock.CreatedAt);
        Assert.Equal("Обновлённая причина", updatedBlock.Comment);

        using var secondBlockResponse = await client.PutAsync(
            $"/api/users/me/direct-message-blocks/{ArcaneLinkApiFactory.OutsiderUserId}",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(secondBlockResponse);

        var firstPage = await client
            .GetFromJsonAsync<DirectMessageBlockedUsersPageResponse>(
                "/api/users/me/direct-message-blocks?limit=1");
        Assert.NotNull(firstPage);
        Assert.Single(firstPage.Items);
        Assert.Equal(2, firstPage.TotalCount);
        Assert.NotNull(firstPage.NextCursor);

        var secondPage = await client
            .GetFromJsonAsync<DirectMessageBlockedUsersPageResponse>(
                "/api/users/me/direct-message-blocks?limit=1&cursor=" +
                Uri.EscapeDataString(firstPage.NextCursor));
        Assert.NotNull(secondPage);
        Assert.Single(secondPage.Items);
        Assert.Equal(2, secondPage.TotalCount);
        Assert.Null(secondPage.NextCursor);
        Assert.NotEqual(
            firstPage.Items[0].UserId,
            secondPage.Items[0].UserId);

        using (var invalidCursorResponse = await client.GetAsync(
                   "/api/users/me/direct-message-blocks?cursor=not-a-cursor"))
        {
            Assert.Equal(
                HttpStatusCode.BadRequest,
                invalidCursorResponse.StatusCode);
        }

        var blockedStatus = await client
            .GetFromJsonAsync<DirectMessageBlockStatusResponse>(
                $"/api/users/me/direct-message-blocks/{ArcaneLinkApiFactory.MemberUserId}");
        Assert.True(blockedStatus!.IsBlocked);
        Assert.Equal("Обновлённая причина", blockedStatus.Comment);

        using (var tooLongResponse = await client.PutAsJsonAsync(
                   $"/api/users/me/direct-message-blocks/{ArcaneLinkApiFactory.MemberUserId}",
                   new UpdateDirectMessageBlockRequest
                   {
                       Comment = new string('x', 129)
                   }))
        {
            Assert.Equal(HttpStatusCode.BadRequest, tooLongResponse.StatusCode);
        }

        using (var unblockResponse = await client.DeleteAsync(
                   $"/api/users/me/direct-message-blocks/{ArcaneLinkApiFactory.MemberUserId}"))
        {
            Assert.Equal(HttpStatusCode.NoContent, unblockResponse.StatusCode);
        }

        var unblockedStatus = await client
            .GetFromJsonAsync<DirectMessageBlockStatusResponse>(
                $"/api/users/me/direct-message-blocks/{ArcaneLinkApiFactory.MemberUserId}");
        Assert.False(unblockedStatus!.IsBlocked);
        Assert.Null(unblockedStatus.Comment);
    }

    [Fact]
    public async Task ActiveDirectConversation_RechecksPrivacyAndBlacklistOnSend()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await OpenDirectSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        using var initialMessageResponse = await client.PostAsJsonAsync(
            $"/api/private-spaces/{space.SpaceId}/messages",
            new CreateSpaceMessageRequest
            {
                Body = "allowed-before-policy-change"
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            initialMessageResponse);
        var initialMessage = (await initialMessageResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;

        await SetPermissionAsync(client, "member", "nobody");
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var deniedByPolicy = await client.PostAsJsonAsync(
                   $"/api/private-spaces/{space.SpaceId}/messages",
                   new CreateSpaceMessageRequest
                   {
                       Body = "denied-by-policy"
                   }))
        {
            Assert.Equal(HttpStatusCode.Forbidden, deniedByPolicy.StatusCode);
        }
        using (var deniedEdit = await client.PatchAsJsonAsync(
                   $"/api/private-spaces/{space.SpaceId}/messages/{initialMessage.Id}",
                   new UpdateSpaceMessageRequest
                   {
                       Body = "denied-edit"
                   }))
        {
            Assert.Equal(HttpStatusCode.Forbidden, deniedEdit.StatusCode);
        }

        await SetPermissionAsync(client, "member", "everyone");
        using (var blocked = await client.PutAsync(
                   $"/api/users/me/direct-message-blocks/{ArcaneLinkApiFactory.OwnerUserId}",
                   null))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(blocked);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var deniedByBlacklist = await client.PostAsJsonAsync(
                   $"/api/private-spaces/{space.SpaceId}/messages",
                   new CreateSpaceMessageRequest
                   {
                       Body = "denied-by-blacklist"
                   }))
        {
            Assert.Equal(HttpStatusCode.Forbidden, deniedByBlacklist.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.SpaceMessages.AnyAsync(message =>
            message.SpaceId == space.SpaceId &&
            (message.Body == "denied-by-policy" ||
             message.Body == "denied-by-blacklist" ||
             message.Body == "denied-edit")));
        Assert.Equal(
            "allowed-before-policy-change",
            await db.SpaceMessages
                .Where(message => message.Id == initialMessage.Id)
                .Select(message => message.Body)
                .SingleAsync());
    }

    [Fact]
    public async Task FriendsAndSharedServers_UseCurrentRelationships()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();

        await SetPermissionAsync(client, "outsider", "friends");
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var denied = await client.PostAsync(
                   $"/api/private-spaces/direct/{ArcaneLinkApiFactory.OutsiderUserId}",
                   null))
        {
            Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        }

        var requestResponse = await client.PostAsJsonAsync(
            "/api/friends/requests",
            new CreateFriendRequestRequest
            {
                ToUserId = ArcaneLinkApiFactory.OutsiderUserId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(requestResponse);
        var request = (await requestResponse.Content
            .ReadFromJsonAsync<FriendRequestResponse>())!;

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using (var accepted = await client.PostAsync(
                   $"/api/friends/requests/{request.Id}/accept",
                   null))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(accepted);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        await OpenDirectSpaceAsync(client, ArcaneLinkApiFactory.OutsiderUserId);

        await SetPermissionAsync(client, "member", "shared_servers");
        client.AuthorizeWith(await client.LoginAsync("owner"));
        await OpenDirectSpaceAsync(client, ArcaneLinkApiFactory.MemberUserId);
    }

    [Fact]
    public async Task CustomCategories_AreIndependentAndFriendsOfFriendsUsesMutualFriend()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetPermissionAsync(
            client,
            "member",
            "custom:friends_of_friends");

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using (var deniedWithoutMutualFriend = await client.PostAsync(
                   $"/api/private-spaces/direct/{ArcaneLinkApiFactory.MemberUserId}",
                   null))
        {
            Assert.Equal(
                HttpStatusCode.Forbidden,
                deniedWithoutMutualFriend.StatusCode);
        }

        await CreateFriendshipAsync(
            client,
            "owner",
            ArcaneLinkApiFactory.MemberUserId,
            "member");
        await CreateFriendshipAsync(
            client,
            "owner",
            ArcaneLinkApiFactory.OutsiderUserId,
            "outsider");

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var direct = await OpenDirectSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var messagesPath =
            $"/api/private-spaces/{direct.SpaceId}/messages";

        await SetPermissionAsync(
            client,
            "member",
            "custom:friends");
        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using (var deniedWhenOnlyDirectFriendsAreAllowed =
               await client.PostAsJsonAsync(
                   messagesPath,
                   new CreateSpaceMessageRequest
                   {
                       Body = "mutual friend alone is not direct friendship"
                   }))
        {
            Assert.Equal(
                HttpStatusCode.Forbidden,
                deniedWhenOnlyDirectFriendsAreAllowed.StatusCode);
        }

        await CreateFriendshipAsync(
            client,
            "outsider",
            ArcaneLinkApiFactory.MemberUserId,
            "member");
        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using (var allowedForDirectFriend = await client.PostAsJsonAsync(
                   messagesPath,
                   new CreateSpaceMessageRequest
                   {
                       Body = "direct friend is allowed"
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(
                allowedForDirectFriend);
        }

        await SetPermissionAsync(
            client,
            "member",
            "custom:shared_servers");
        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using (var deniedWithoutSharedServer = await client.PostAsJsonAsync(
                   messagesPath,
                   new CreateSpaceMessageRequest
                   {
                       Body = "friendship does not imply a shared server"
                   }))
        {
            Assert.Equal(
                HttpStatusCode.Forbidden,
                deniedWithoutSharedServer.StatusCode);
        }

        await SetPermissionAsync(
            client,
            "member",
            "custom:shared_servers,friends");
        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using var allowedByCombinedPolicy = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest
            {
                Body = "any selected category may allow the sender"
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            allowedByCombinedPolicy);
    }

    [Fact]
    public async Task GroupCreation_ValidatesEveryNewParticipantPair()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetPermissionAsync(client, "member", "shared_servers");
        await SetPermissionAsync(client, "outsider", "everyone");

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var response = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                Title = "No privacy bypass",
                MemberUserIds =
                [
                    ArcaneLinkApiFactory.MemberUserId,
                    ArcaneLinkApiFactory.OutsiderUserId
                ]
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.PrivateSpaces.AnyAsync(space =>
            space.Space.Title == "No privacy bypass"));
    }

    [Fact]
    public async Task AddMember_RechecksPrivacy_AndNotifiesOnlyAfterSuccess()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await OpenDirectSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);

        await SetPermissionAsync(client, "outsider", "nobody");
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var denied = await client.PostAsJsonAsync(
                   $"/api/private-spaces/{space.SpaceId}/members",
                   new AddPrivateSpaceMemberRequest
                   {
                       UserId = ArcaneLinkApiFactory.OutsiderUserId
                   }))
        {
            Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        Assert.DoesNotContain(
            await GetNotificationsAsync(client),
            notification =>
                notification.Kind == "private-space-invite" &&
                notification.SpaceId == space.SpaceId);

        await SetPermissionAsync(client, "outsider", "everyone");
        client.AuthorizeWith(await client.LoginAsync("owner"));
        Guid createdGroupId;
        using (var added = await client.PostAsJsonAsync(
                   $"/api/private-spaces/{space.SpaceId}/members",
                   new AddPrivateSpaceMemberRequest
                   {
                       UserId = ArcaneLinkApiFactory.OutsiderUserId
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(added);
            var mutation = (await added.Content
                .ReadFromJsonAsync<PrivateSpaceMembershipMutationResponse>())!;
            Assert.True(mutation.CreatedGroup);
            Assert.NotEqual(space.SpaceId, mutation.SpaceId);
            createdGroupId = mutation.SpaceId;
        }

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        Assert.Single(
            await GetNotificationsAsync(client),
            notification =>
                notification.Kind == "private-space-invite" &&
                notification.SpaceId == createdGroupId);
        Assert.DoesNotContain(
            await GetNotificationsAsync(client),
            notification =>
                notification.Kind == "private-space-invite" &&
                notification.SpaceId == space.SpaceId);
    }

    private static async Task SetPermissionAsync(
        HttpClient client,
        string login,
        string permission)
    {
        client.AuthorizeWith(await client.LoginAsync(login));
        using var response = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                DirectMessagePermission = permission
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
    }

    private static async Task CreateFriendshipAsync(
        HttpClient client,
        string fromLogin,
        Guid toUserId,
        string toLogin)
    {
        client.AuthorizeWith(await client.LoginAsync(fromLogin));
        using var requestResponse = await client.PostAsJsonAsync(
            "/api/friends/requests",
            new CreateFriendRequestRequest
            {
                ToUserId = toUserId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            requestResponse);
        var request = (await requestResponse.Content
            .ReadFromJsonAsync<FriendRequestResponse>())!;

        client.AuthorizeWith(await client.LoginAsync(toLogin));
        using var acceptResponse = await client.PostAsync(
            $"/api/friends/requests/{request.Id}/accept",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            acceptResponse);
    }

    private static async Task<PrivateSpaceResponse> OpenDirectSpaceAsync(
        HttpClient client,
        Guid targetUserId)
    {
        using var response = await client.PostAsync(
            $"/api/private-spaces/direct/{targetUserId}",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<PrivateSpaceResponse>())!;
    }

    private static async Task<IReadOnlyList<UserNotificationResponse>>
        GetNotificationsAsync(HttpClient client)
    {
        return await client.GetFromJsonAsync<List<UserNotificationResponse>>(
            "/api/notifications") ?? [];
    }
}
