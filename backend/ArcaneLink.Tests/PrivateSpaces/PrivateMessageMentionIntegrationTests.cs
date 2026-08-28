using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Notifications;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.Services.Messages;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.PrivateSpaces;

public sealed class PrivateMessageMentionIntegrationTests
{
    [Fact]
    public async Task UserAndEveryoneMentions_NotifyActiveMembers_AndRespectPersonalDeletion()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(client);
        var messagesPath = $"/api/private-spaces/{space.SpaceId}/messages";
        const string body = "@member and @everyone";
        using var createResponse = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest
            {
                Body = body,
                Mentions =
                [
                    new SpaceMessageMentionRequest
                    {
                        Kind = MentionKinds.User,
                        TargetId = ArcaneLinkApiFactory.MemberUserId,
                        Start = 0,
                        Length = 7
                    },
                    new SpaceMessageMentionRequest
                    {
                        Kind = MentionKinds.Everyone,
                        Start = 12,
                        Length = 9
                    }
                ]
            });
        createResponse.EnsureSuccessStatusCode();
        var message = (await createResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
        Assert.Equal(2, message.Mentions.Count);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var notifications = await client.GetFromJsonAsync<List<UserNotificationResponse>>(
            "/api/notifications");
        var mention = Assert.Single(notifications!, x => x.MessageId == message.Id);
        Assert.Null(mention.ServerId);
        Assert.Equal(space.SpaceId, mention.SpaceId);
        Assert.Contains("личной переписке", mention.Body, StringComparison.Ordinal);

        using (var deleteResponse = await client.DeleteAsync(
                   $"{messagesPath}/{message.Id}?scope=me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        }
        notifications = await client.GetFromJsonAsync<List<UserNotificationResponse>>(
            "/api/notifications");
        Assert.DoesNotContain(notifications!, x => x.MessageId == message.Id);
    }

    [Fact]
    public async Task PrivateRoleMention_IsRejected_AndHiddenReplyHasNoPreviewContent()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(client);
        var messagesPath = $"/api/private-spaces/{space.SpaceId}/messages";

        using (var roleResponse = await client.PostAsJsonAsync(
                   messagesPath,
                   new CreateSpaceMessageRequest
                   {
                       Body = "@Crew",
                       Mentions =
                       [
                           new SpaceMessageMentionRequest
                           {
                               Kind = MentionKinds.Role,
                               TargetId = Guid.NewGuid(),
                               Start = 0,
                               Length = 5
                           }
                       ]
                   }))
        {
            Assert.Equal(HttpStatusCode.NotFound, roleResponse.StatusCode);
        }

        var original = await CreateMessageAsync(client, messagesPath, "private reply target");
        client.AuthorizeWith(await client.LoginAsync("member"));
        using var replyResponse = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest
            {
                Body = "private reply",
                ReplyToMessageId = original.Id,
                Mentions = []
            });
        replyResponse.EnsureSuccessStatusCode();
        var reply = (await replyResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
        Assert.Equal("private reply target", reply.ReplyTo?.Body);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var hideResponse = await client.DeleteAsync(
                   $"{messagesPath}/{original.Id}?scope=me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, hideResponse.StatusCode);
        }
        var messages = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath);
        var reloaded = Assert.Single(messages!, x => x.Id == reply.Id);
        Assert.True(reloaded.ReplyTo?.IsUnavailable);
        Assert.Null(reloaded.ReplyTo?.Body);
        Assert.Null(reloaded.ReplyTo?.SenderDisplayName);
    }

    [Fact]
    public async Task LegacyPrivateMention_AllowsSentenceDot_ButRejectsUnknownDottedContinuation()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(client);
        var messagesPath = $"/api/private-spaces/{space.SpaceId}/messages";

        using var sentenceResponse = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest { Body = "legacy @member." });
        sentenceResponse.EnsureSuccessStatusCode();
        var sentence = (await sentenceResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;
        Assert.Single(sentence.Mentions);
        Assert.Equal("@member", sentence.Mentions[0].DisplayText);

        using var continuationResponse = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest { Body = "legacy @member.extra" });
        continuationResponse.EnsureSuccessStatusCode();
        var continuation = (await continuationResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;
        Assert.Empty(continuation.Mentions);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var notifications = await client.GetFromJsonAsync<List<UserNotificationResponse>>(
            "/api/notifications");
        Assert.Contains(notifications!, notification => notification.MessageId == sentence.Id);
        Assert.DoesNotContain(
            notifications!,
            notification => notification.MessageId == continuation.Id);
    }

    [Fact]
    public async Task LegacyPrivateMention_ResolvesExistingLoginWithInternalDot()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        const string login = "private.dotted";
        using var registerResponse = await client.PostAsJsonAsync(
            "/api/auth/register",
            new CreateUserRequest
            {
                Login = login,
                DisplayName = "Private Dotted",
                Email = "private.dotted@example.test",
                Password = ArcaneLinkApiFactory.Password
            });
        registerResponse.EnsureSuccessStatusCode();
        var user = (await registerResponse.Content.ReadFromJsonAsync<UserResponse>())!;

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var registeredUser = await db.Users.SingleAsync(x => x.Id == user.Id);
            registeredUser.StatusId = UserStatusIds.Active;
            registeredUser.EmailConfirmedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var spaceResponse = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                Title = "Dotted login private space",
                MemberUserIds = [user.Id]
            });
        spaceResponse.EnsureSuccessStatusCode();
        var space = (await spaceResponse.Content.ReadFromJsonAsync<PrivateSpaceResponse>())!;
        var messagesPath = $"/api/private-spaces/{space.SpaceId}/messages";

        using var response = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest { Body = $"legacy @{login}." });
        response.EnsureSuccessStatusCode();
        var message = (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
        var mention = Assert.Single(message.Mentions);
        Assert.Equal(user.Id, mention.TargetUserId);
        Assert.Equal($"@{login}", mention.DisplayText);
    }

    private static async Task<PrivateSpaceResponse> CreatePrivateSpaceAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                Title = "Mention integration private space",
                MemberUserIds = [ArcaneLinkApiFactory.MemberUserId]
            });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PrivateSpaceResponse>())!;
    }

    private static async Task<SpaceMessageResponse> CreateMessageAsync(
        HttpClient client,
        string path,
        string body)
    {
        using var response = await client.PostAsJsonAsync(
            path,
            new CreateSpaceMessageRequest { Body = body, Mentions = [] });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
    }
}
