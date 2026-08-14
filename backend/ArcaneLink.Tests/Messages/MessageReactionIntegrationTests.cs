using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Tests.Infrastructure;

namespace ArcaneLink.Tests.Messages;

public sealed class MessageReactionIntegrationTests
{
    private const string HeartEmoji = "❤️";

    [Fact]
    public async Task ServerReaction_IsIdempotentAndAggregatedForCurrentUser()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateServerMessageAsync(client, "owner", "react to me");
        var reactionPath = $"{ServerMessagesPath()}/{message.Id}/reactions";

        client.AuthorizeWith(await client.LoginAsync("member"));
        var firstAdd = await PutReactionAsync(client, reactionPath, $"  {HeartEmoji}  ");
        AssertReaction(firstAdd, HeartEmoji, 1, reactedByCurrentUser: true);

        var repeatedAdd = await PutReactionAsync(client, reactionPath, HeartEmoji);
        AssertReaction(repeatedAdd, HeartEmoji, 1, reactedByCurrentUser: true);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var ownerAdd = await PutReactionAsync(client, reactionPath, HeartEmoji);
        AssertReaction(ownerAdd, HeartEmoji, 2, reactedByCurrentUser: true);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var loaded = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            ServerMessagesPath());
        var loadedMessage = Assert.Single(loaded!, item => item.Id == message.Id);
        AssertReaction(loadedMessage, HeartEmoji, 2, reactedByCurrentUser: true);

        var firstRemove = await DeleteReactionAsync(client, reactionPath, HeartEmoji);
        AssertReaction(firstRemove, HeartEmoji, 1, reactedByCurrentUser: false);

        var repeatedRemove = await DeleteReactionAsync(client, reactionPath, HeartEmoji);
        AssertReaction(repeatedRemove, HeartEmoji, 1, reactedByCurrentUser: false);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var ownerView = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            ServerMessagesPath());
        AssertReaction(
            Assert.Single(ownerView!, item => item.Id == message.Id),
            HeartEmoji,
            1,
            reactedByCurrentUser: true);
    }

    [Fact]
    public async Task ServerReaction_HidesWrongScopeDeletedMessageAndDeniedSender()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateServerMessageAsync(client, "owner", "protected reaction target");

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var outsiderResponse = await client.PutAsJsonAsync(
            $"{ServerMessagesPath()}/{message.Id}/reactions",
            new SetSpaceMessageReactionRequest { EmojiCode = "👍" });
        Assert.Equal(HttpStatusCode.NotFound, outsiderResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var wrongSpaceResponse = await client.PutAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{Guid.NewGuid()}/messages/{message.Id}/reactions",
            new SetSpaceMessageReactionRequest { EmojiCode = "👍" });
        Assert.Equal(HttpStatusCode.NotFound, wrongSpaceResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var deleteResponse = await client.DeleteAsync(
            $"{ServerMessagesPath()}/{message.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var deletedReactionResponse = await client.PutAsJsonAsync(
            $"{ServerMessagesPath()}/{message.Id}/reactions",
            new SetSpaceMessageReactionRequest { EmojiCode = "👍" });
        Assert.Equal(HttpStatusCode.NotFound, deletedReactionResponse.StatusCode);

        var invalidEmojiResponse = await client.PutAsJsonAsync(
            $"{ServerMessagesPath()}/{message.Id}/reactions",
            new SetSpaceMessageReactionRequest { EmojiCode = "not an emoji" });
        Assert.Equal(HttpStatusCode.BadRequest, invalidEmojiResponse.StatusCode);
    }

    [Fact]
    public async Task ServerReaction_RequiresSendPermissionForAddAndRemove()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateServerMessageAsync(client, "owner", "send ACL target");
        var reactionPath = $"{ServerMessagesPath()}/{message.Id}/reactions";

        client.AuthorizeWith(await client.LoginAsync("member"));
        AssertReaction(
            await PutReactionAsync(client, reactionPath, "👍"),
            "👍",
            1,
            reactedByCurrentUser: true);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var denyResponse = await client.PutAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/permission-overrides",
            new UpsertSpacePermissionOverrideRequest
            {
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                PermissionId = SpacePermissionIds.SendMessages,
                Deny = true
            });
        denyResponse.EnsureSuccessStatusCode();

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var addResponse = await client.PutAsJsonAsync(
            reactionPath,
            new SetSpaceMessageReactionRequest { EmojiCode = "🎉" });
        Assert.Equal(HttpStatusCode.NotFound, addResponse.StatusCode);

        using var removeRequest = new HttpRequestMessage(HttpMethod.Delete, reactionPath)
        {
            Content = JsonContent.Create(
                new SetSpaceMessageReactionRequest { EmojiCode = "👍" })
        };
        using var removeResponse = await client.SendAsync(removeRequest);
        Assert.Equal(HttpStatusCode.NotFound, removeResponse.StatusCode);

        var visibleMessages = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            ServerMessagesPath());
        AssertReaction(
            Assert.Single(visibleMessages!, item => item.Id == message.Id),
            "👍",
            1,
            reactedByCurrentUser: true);
    }

    [Fact]
    public async Task ServerReaction_AcceptsEmojiSequencesAndRejectsNonEmojiGlyphs()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateServerMessageAsync(client, "member", "emoji validation target");
        var reactionPath = $"{ServerMessagesPath()}/{message.Id}/reactions";

        AssertReaction(
            await PutReactionAsync(client, reactionPath, "  1️⃣  "),
            "1️⃣",
            1,
            reactedByCurrentUser: true);
        AssertReaction(
            await PutReactionAsync(client, reactionPath, "👩🏽‍💻"),
            "👩🏽‍💻",
            1,
            reactedByCurrentUser: true);

        foreach (var invalidEmoji in new[] { "^", "text", "👍👍", "a\u0301", "\u2060" })
        {
            using var response = await client.PutAsJsonAsync(
                reactionPath,
                new SetSpaceMessageReactionRequest { EmojiCode = invalidEmoji });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }

    [Fact]
    public async Task PrivateReaction_RequiresActiveMembershipAndAggregatesUsers()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var spaceResponse = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                Title = "Reaction room"
            });
        spaceResponse.EnsureSuccessStatusCode();
        var space = (await spaceResponse.Content.ReadFromJsonAsync<PrivateSpaceResponse>())!;
        Assert.Equal(PrivateSpaceKindCodes.Group, space.Kind);
        using (var addMemberResponse = await client.PostAsJsonAsync(
                   $"/api/private-spaces/{space.SpaceId}/members",
                   new AddPrivateSpaceMemberRequest
                   {
                       UserId = ArcaneLinkApiFactory.MemberUserId
                   }))
        {
            addMemberResponse.EnsureSuccessStatusCode();
        }
        var messagesPath = $"/api/private-spaces/{space.SpaceId}/messages";
        var createResponse = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest { Body = "private reaction target" });
        createResponse.EnsureSuccessStatusCode();
        var message = (await createResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
        var reactionPath = $"{messagesPath}/{message.Id}/reactions";

        var ownerAdd = await PutReactionAsync(client, reactionPath, "🎉");
        AssertReaction(ownerAdd, "🎉", 1, reactedByCurrentUser: true);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var memberAdd = await PutReactionAsync(client, reactionPath, "🎉");
        AssertReaction(memberAdd, "🎉", 2, reactedByCurrentUser: true);
        var repeatedAdd = await PutReactionAsync(client, reactionPath, "🎉");
        AssertReaction(repeatedAdd, "🎉", 2, reactedByCurrentUser: true);

        var memberRemove = await DeleteReactionAsync(client, reactionPath, "🎉");
        AssertReaction(memberRemove, "🎉", 1, reactedByCurrentUser: false);
        var repeatedRemove = await DeleteReactionAsync(client, reactionPath, "🎉");
        AssertReaction(repeatedRemove, "🎉", 1, reactedByCurrentUser: false);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var outsiderResponse = await client.PutAsJsonAsync(
            reactionPath,
            new SetSpaceMessageReactionRequest { EmojiCode = "🎉" });
        Assert.Equal(HttpStatusCode.NotFound, outsiderResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var leaveResponse = await client.DeleteAsync(
            $"/api/private-spaces/{space.SpaceId}/members/me");
        Assert.Equal(HttpStatusCode.NoContent, leaveResponse.StatusCode);

        var inactiveResponse = await client.PutAsJsonAsync(
            reactionPath,
            new SetSpaceMessageReactionRequest { EmojiCode = "👍" });
        Assert.Equal(HttpStatusCode.NotFound, inactiveResponse.StatusCode);
    }

    [Fact]
    public async Task PrivateReaction_HidesWrongScopeAndDeletedMessage()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var sourceSpace = await CreatePrivateSpaceAsync(client, "Source reaction room");
        var otherSpace = await CreatePrivateSpaceAsync(client, "Other reaction room");
        var sourceMessagesPath = $"/api/private-spaces/{sourceSpace.SpaceId}/messages";
        using var createResponse = await client.PostAsJsonAsync(
            sourceMessagesPath,
            new CreateSpaceMessageRequest { Body = "private scoped target" });
        createResponse.EnsureSuccessStatusCode();
        var message = (await createResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;

        using var wrongScopeResponse = await client.PutAsJsonAsync(
            $"/api/private-spaces/{otherSpace.SpaceId}/messages/{message.Id}/reactions",
            new SetSpaceMessageReactionRequest { EmojiCode = "👍" });
        Assert.Equal(HttpStatusCode.NotFound, wrongScopeResponse.StatusCode);

        using var deleteResponse = await client.DeleteAsync(
            $"{sourceMessagesPath}/{message.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        using var deletedResponse = await client.PutAsJsonAsync(
            $"{sourceMessagesPath}/{message.Id}/reactions",
            new SetSpaceMessageReactionRequest { EmojiCode = "👍" });
        Assert.Equal(HttpStatusCode.NotFound, deletedResponse.StatusCode);
    }

    private static async Task<SpaceMessageResponse> CreateServerMessageAsync(
        HttpClient client,
        string login,
        string body)
    {
        client.AuthorizeWith(await client.LoginAsync(login));
        var response = await client.PostAsJsonAsync(
            ServerMessagesPath(),
            new CreateSpaceMessageRequest { Body = body });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
    }

    private static async Task<PrivateSpaceResponse> CreatePrivateSpaceAsync(
        HttpClient client,
        string title)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                Title = title
            });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PrivateSpaceResponse>())!;
    }

    private static async Task<SpaceMessageResponse> PutReactionAsync(
        HttpClient client,
        string path,
        string emojiCode)
    {
        var response = await client.PutAsJsonAsync(
            path,
            new SetSpaceMessageReactionRequest { EmojiCode = emojiCode });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
    }

    private static async Task<SpaceMessageResponse> DeleteReactionAsync(
        HttpClient client,
        string path,
        string emojiCode)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, path)
        {
            Content = JsonContent.Create(
                new SetSpaceMessageReactionRequest { EmojiCode = emojiCode })
        };
        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
    }

    private static void AssertReaction(
        SpaceMessageResponse message,
        string emojiCode,
        int count,
        bool reactedByCurrentUser)
    {
        var reaction = Assert.Single(
            message.Reactions,
            item => item.EmojiCode == emojiCode);
        Assert.Equal(count, reaction.Count);
        Assert.Equal(reactedByCurrentUser, reaction.ReactedByCurrentUser);
    }

    private static string ServerMessagesPath()
    {
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/messages";
    }
}
