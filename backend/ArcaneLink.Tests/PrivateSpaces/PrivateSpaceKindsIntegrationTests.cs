using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Tests.PrivateSpaces;

public sealed class PrivateSpaceKindsIntegrationTests
{
    [Fact]
    public async Task CreateWithoutInvites_CreatesOwnerOnlyGroup()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var group = await CreateSpaceAsync(client);

        Assert.Equal(PrivateSpaceKindCodes.Group, group.Kind);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, group.OwnerUserId);
        var owner = Assert.Single(group.Members);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, owner.UserId);
        Assert.Equal("active", owner.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var hiddenResponse = await client.GetAsync(SpacePath(group.SpaceId));
        Assert.Equal(HttpStatusCode.NotFound, hiddenResponse.StatusCode);
    }

    [Fact]
    public async Task CreateWithOneInvite_ReusesTheSingleDirectForThePair()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var first = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        Assert.Equal(PrivateSpaceKindCodes.Direct, first.Kind);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var reverseRequest = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.OwnerUserId);

        Assert.Equal(PrivateSpaceKindCodes.Direct, reverseRequest.Kind);
        Assert.Equal(first.SpaceId, reverseRequest.SpaceId);
        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            reverseRequest.Members.Select(member => member.UserId).Order());

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var explicitDirectResponse = await client.PostAsync(
            $"/api/private-spaces/direct/{ArcaneLinkApiFactory.MemberUserId}",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            explicitDirectResponse);
        var explicitDirect = (await explicitDirectResponse.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>())!;

        Assert.Equal(first.SpaceId, explicitDirect.SpaceId);
        var visibleSpaces = await client.GetFromJsonAsync<List<PrivateSpaceResponse>>(
            "/api/private-spaces");
        Assert.Single(
            visibleSpaces!,
            space =>
                space.Kind == PrivateSpaceKindCodes.Direct &&
                space.Members.Any(member =>
                    member.UserId == ArcaneLinkApiFactory.MemberUserId));
    }

    [Fact]
    public async Task AddingThirdParticipantToDirect_CreatesGroupAndPreservesDirect()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var direct = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var directMessagesPath = $"{SpacePath(direct.SpaceId)}/messages";
        var originalMessage = await CreateMessageAsync(
            client,
            directMessagesPath,
            "direct history must stay in the direct space");

        using var addResponse = await client.PostAsJsonAsync(
            $"{SpacePath(direct.SpaceId)}/members",
            new AddPrivateSpaceMemberRequest
            {
                UserId = ArcaneLinkApiFactory.OutsiderUserId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(addResponse);
        var mutation = (await addResponse.Content
            .ReadFromJsonAsync<PrivateSpaceMembershipMutationResponse>())!;

        Assert.True(mutation.CreatedGroup);
        Assert.NotEqual(direct.SpaceId, mutation.SpaceId);
        Assert.Equal(mutation.SpaceId, mutation.Member.SpaceId);

        var unchangedDirect = await client.GetFromJsonAsync<PrivateSpaceResponse>(
            SpacePath(direct.SpaceId));
        Assert.NotNull(unchangedDirect);
        Assert.Equal(PrivateSpaceKindCodes.Direct, unchangedDirect.Kind);
        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            unchangedDirect.Members.Select(member => member.UserId).Order());
        var directMessages = await client
            .GetFromJsonAsync<List<SpaceMessageResponse>>(directMessagesPath);
        Assert.Contains(
            directMessages!,
            message => message.Id == originalMessage.Id);

        var group = await client.GetFromJsonAsync<PrivateSpaceResponse>(
            SpacePath(mutation.SpaceId));
        Assert.NotNull(group);
        Assert.Equal(PrivateSpaceKindCodes.Group, group.Kind);
        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.OutsiderUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            group.Members.Select(member => member.UserId).Order());
        Assert.Empty(
            (await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
                $"{SpacePath(group.SpaceId)}/messages"))!);
    }

    [Fact]
    public async Task DirectPersonalSettings_ValidateNoteLengthAndStayViewerPrivate()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var direct = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var settingsPath = $"{SpacePath(direct.SpaceId)}/settings/me";

        using (var ownerSettingsResponse = await client.PatchAsJsonAsync(
                   settingsPath,
                   new UpdatePrivateSpacePersonalSettingsRequest
                   {
                       Note = "owner-only note",
                       CustomNickname = "My teammate"
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(
                ownerSettingsResponse);
            var ownerView = (await ownerSettingsResponse.Content
                .ReadFromJsonAsync<PrivateSpaceResponse>())!;
            Assert.Equal("owner-only note", ownerView.ViewerSettings.Note);
            Assert.Equal("My teammate", ownerView.ViewerSettings.CustomNickname);
        }

        using (var tooLongNoteResponse = await client.PatchAsJsonAsync(
                   settingsPath,
                   new UpdatePrivateSpacePersonalSettingsRequest
                   {
                       Note = new string(
                           'x',
                           UpdatePrivateSpacePersonalSettingsRequest
                               .NoteMaxLength + 1)
                   }))
        {
            await AssertValidationProblemAsync(tooLongNoteResponse, "Note");
        }
        await AssertPersonalSettingsAsync(
            client,
            direct.SpaceId,
            "owner-only note",
            "My teammate");

        using (var tooLongNicknameResponse = await client.PatchAsJsonAsync(
                   settingsPath,
                   new UpdatePrivateSpacePersonalSettingsRequest
                   {
                       CustomNickname = new string(
                           'x',
                           UpdatePrivateSpacePersonalSettingsRequest
                               .CustomNicknameMaxLength + 1)
                   }))
        {
            await AssertValidationProblemAsync(
                tooLongNicknameResponse,
                "CustomNickname");
        }
        await AssertPersonalSettingsAsync(
            client,
            direct.SpaceId,
            "owner-only note",
            "My teammate");

        using (var tooLongMuteModeResponse = await client.PatchAsJsonAsync(
                   settingsPath,
                   new UpdatePrivateSpacePersonalSettingsRequest
                   {
                       MuteMode = new string(
                           'x',
                           UpdatePrivateSpacePersonalSettingsRequest
                               .MuteModeMaxLength + 1)
                   }))
        {
            await AssertValidationProblemAsync(
                tooLongMuteModeResponse,
                "MuteMode");
        }
        await AssertPersonalSettingsAsync(
            client,
            direct.SpaceId,
            "owner-only note",
            "My teammate");

        client.AuthorizeWith(await client.LoginAsync("member"));
        var memberView = await client.GetFromJsonAsync<PrivateSpaceResponse>(
            SpacePath(direct.SpaceId));
        Assert.NotNull(memberView);
        Assert.Null(memberView.ViewerSettings.Note);
        Assert.Null(memberView.ViewerSettings.CustomNickname);

        using (var memberSettingsResponse = await client.PatchAsJsonAsync(
                   settingsPath,
                   new UpdatePrivateSpacePersonalSettingsRequest
                   {
                       Note = "member-only note"
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(
                memberSettingsResponse);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var ownerViewAfterMemberUpdate =
            await client.GetFromJsonAsync<PrivateSpaceResponse>(
                SpacePath(direct.SpaceId));
        Assert.NotNull(ownerViewAfterMemberUpdate);
        Assert.Equal(
            "owner-only note",
            ownerViewAfterMemberUpdate.ViewerSettings.Note);
    }

    [Fact]
    public async Task Group_AllowsViewerAvatarSettingsButRejectsDirectOnlyAliases()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var group = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.OutsiderUserId);
        var settingsPath = $"{SpacePath(group.SpaceId)}/settings/me";

        using var avatarSettingsResponse = await client.PatchAsJsonAsync(
            settingsPath,
            new UpdatePrivateSpacePersonalSettingsRequest
            {
                CustomAvatarCropOffsetX = 0.25,
                CustomAvatarCropOffsetY = -0.15,
                CustomAvatarCropZoom = 1.5
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            avatarSettingsResponse);
        var ownerView = (await avatarSettingsResponse.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>())!;
        Assert.Equal(0.25, ownerView.ViewerSettings.CustomAvatarCropOffsetX);
        Assert.Equal(-0.15, ownerView.ViewerSettings.CustomAvatarCropOffsetY);
        Assert.Equal(1.5, ownerView.ViewerSettings.CustomAvatarCropZoom);

        using var directOnlyResponse = await client.PatchAsJsonAsync(
            settingsPath,
            new UpdatePrivateSpacePersonalSettingsRequest
            {
                Note = "group aliases are not supported",
                CustomNickname = "not allowed"
            });
        Assert.Equal(HttpStatusCode.BadRequest, directOnlyResponse.StatusCode);
    }

    [Fact]
    public async Task MarkAllRead_ClearsUnreadCountsAcrossPrivateSpaces()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var direct = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var group = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.OutsiderUserId);

        client.AuthorizeWith(await client.LoginAsync("member"));
        await CreateMessageAsync(
            client,
            $"{SpacePath(direct.SpaceId)}/messages",
            "unread direct message");
        await CreateMessageAsync(
            client,
            $"{SpacePath(group.SpaceId)}/messages",
            "unread group message");

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var before = await client.GetFromJsonAsync<List<PrivateSpaceResponse>>(
            "/api/private-spaces") ?? [];
        Assert.Equal(
            1,
            Assert.Single(before, space => space.SpaceId == direct.SpaceId)
                .UnreadCount);
        Assert.Equal(
            1,
            Assert.Single(before, space => space.SpaceId == group.SpaceId)
                .UnreadCount);

        using var markAllResponse = await client.PutAsync(
            "/api/private-spaces/read-state/all",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(markAllResponse);
        var markAll = (await markAllResponse.Content
            .ReadFromJsonAsync<MarkAllPrivateSpacesReadResponse>())!;
        Assert.Equal(2, markAll.UpdatedSpaceCount);

        var after = await client.GetFromJsonAsync<List<PrivateSpaceResponse>>(
            "/api/private-spaces") ?? [];
        Assert.Equal(
            0,
            Assert.Single(after, space => space.SpaceId == direct.SpaceId)
                .UnreadCount);
        Assert.Equal(
            0,
            Assert.Single(after, space => space.SpaceId == group.SpaceId)
                .UnreadCount);
    }

    [Fact]
    public async Task GroupReceipt_NewParticipantDoesNotDowngradeOldReadMessage()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var group = await CreateSpaceAsync(client);
        await AddMemberAsync(
            client,
            group.SpaceId,
            ArcaneLinkApiFactory.MemberUserId);
        var messagesPath = $"{SpacePath(group.SpaceId)}/messages";
        var message = await CreateMessageAsync(
            client,
            messagesPath,
            "read before another participant joins");

        client.AuthorizeWith(await client.LoginAsync("member"));
        await MarkReadAsync(client, messagesPath, message.Id);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var beforeJoin = await GetMessageAsync(
            client,
            messagesPath,
            message.Id);
        Assert.Equal("read", beforeJoin.Receipt?.StatusCode);
        Assert.Equal(1, beforeJoin.Receipt?.RecipientCount);
        Assert.Equal(1, beforeJoin.Receipt?.ReadByCount);

        await AddMemberAsync(
            client,
            group.SpaceId,
            ArcaneLinkApiFactory.OutsiderUserId);

        var afterJoin = await GetMessageAsync(
            client,
            messagesPath,
            message.Id);
        Assert.Equal("read", afterJoin.Receipt?.StatusCode);
        Assert.Equal(1, afterJoin.Receipt?.RecipientCount);
        Assert.Equal(1, afterJoin.Receipt?.ReadByCount);
    }

    [Fact]
    public async Task DirectReceipt_StillBecomesReadWhenPeerReadsMessage()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var direct = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var messagesPath = $"{SpacePath(direct.SpaceId)}/messages";
        var message = await CreateMessageAsync(
            client,
            messagesPath,
            "direct receipt baseline");

        client.AuthorizeWith(await client.LoginAsync("member"));
        await MarkReadAsync(client, messagesPath, message.Id);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var refreshed = await GetMessageAsync(
            client,
            messagesPath,
            message.Id);
        Assert.Equal("read", refreshed.Receipt?.StatusCode);
        Assert.Equal(1, refreshed.Receipt?.RecipientCount);
        Assert.Equal(1, refreshed.Receipt?.ReadByCount);
        Assert.NotNull(refreshed.Receipt?.ReadAt);
    }

    [Fact]
    public async Task GroupReceipt_LeaveAndRejoinDoesNotChangeOldReceipt()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var group = await CreateSpaceAsync(client);
        await AddMemberAsync(
            client,
            group.SpaceId,
            ArcaneLinkApiFactory.MemberUserId);
        var messagesPath = $"{SpacePath(group.SpaceId)}/messages";
        var message = await CreateMessageAsync(
            client,
            messagesPath,
            "receipt survives membership reactivation");

        client.AuthorizeWith(await client.LoginAsync("member"));
        await MarkReadAsync(client, messagesPath, message.Id);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var beforeLeave = await GetMessageAsync(
            client,
            messagesPath,
            message.Id);
        Assert.Equal("read", beforeLeave.Receipt?.StatusCode);
        Assert.Equal(1, beforeLeave.Receipt?.RecipientCount);
        Assert.Equal(1, beforeLeave.Receipt?.ReadByCount);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var leaveResponse = await client.DeleteAsync(
                   $"{SpacePath(group.SpaceId)}/members/me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, leaveResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        await AddMemberAsync(
            client,
            group.SpaceId,
            ArcaneLinkApiFactory.MemberUserId);

        var afterRejoin = await GetMessageAsync(
            client,
            messagesPath,
            message.Id);
        Assert.Equal("read", afterRejoin.Receipt?.StatusCode);
        Assert.Equal(1, afterRejoin.Receipt?.RecipientCount);
        Assert.Equal(1, afterRejoin.Receipt?.ReadByCount);
        Assert.Equal(beforeLeave.Receipt?.ReadAt, afterRejoin.Receipt?.ReadAt);
    }

    [Fact]
    public async Task GroupReceipt_UnreadParticipantLeavingDoesNotUpgradeOldMessage()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var group = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.OutsiderUserId);
        var messagesPath = $"{SpacePath(group.SpaceId)}/messages";
        var message = await CreateMessageAsync(
            client,
            messagesPath,
            "one participant leaves without reading");

        client.AuthorizeWith(await client.LoginAsync("member"));
        await MarkReadAsync(client, messagesPath, message.Id);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var beforeLeave = await GetMessageAsync(
            client,
            messagesPath,
            message.Id);
        Assert.Equal("delivered", beforeLeave.Receipt?.StatusCode);
        Assert.Equal(2, beforeLeave.Receipt?.RecipientCount);
        Assert.Equal(1, beforeLeave.Receipt?.ReadByCount);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using (var leaveResponse = await client.DeleteAsync(
                   $"{SpacePath(group.SpaceId)}/members/me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, leaveResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var afterLeave = await GetMessageAsync(
            client,
            messagesPath,
            message.Id);
        Assert.Equal("delivered", afterLeave.Receipt?.StatusCode);
        Assert.Equal(2, afterLeave.Receipt?.RecipientCount);
        Assert.Equal(1, afterLeave.Receipt?.ReadByCount);
    }

    private static async Task<PrivateSpaceResponse> CreateSpaceAsync(
        HttpClient client,
        params Guid[] memberUserIds)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                MemberUserIds = memberUserIds
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>())!;
    }

    private static async Task<SpaceMessageResponse> CreateMessageAsync(
        HttpClient client,
        string messagesPath,
        string body)
    {
        using var response = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest { Body = body });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;
    }

    private static async Task AddMemberAsync(
        HttpClient client,
        Guid spaceId,
        Guid userId)
    {
        using var response = await client.PostAsJsonAsync(
            $"{SpacePath(spaceId)}/members",
            new AddPrivateSpaceMemberRequest { UserId = userId });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
    }

    private static async Task MarkReadAsync(
        HttpClient client,
        string messagesPath,
        Guid messageId)
    {
        using var response = await client.PutAsJsonAsync(
            $"{messagesPath}/read-state",
            new MarkSpaceReadRequest { ThroughMessageId = messageId });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
    }

    private static async Task<SpaceMessageResponse> GetMessageAsync(
        HttpClient client,
        string messagesPath,
        Guid messageId)
    {
        var messages = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            messagesPath);
        return Assert.Single(messages!, candidate => candidate.Id == messageId);
    }

    private static async Task AssertValidationProblemAsync(
        HttpResponseMessage response,
        string propertyName)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(
            "application/problem+json",
            response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content
            .ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(400, problem.Status);
        Assert.Contains(
            problem.Errors.Keys,
            key => string.Equals(
                key,
                propertyName,
                StringComparison.OrdinalIgnoreCase));
    }

    private static async Task AssertPersonalSettingsAsync(
        HttpClient client,
        Guid spaceId,
        string expectedNote,
        string expectedCustomNickname)
    {
        var response = await client.GetFromJsonAsync<PrivateSpaceResponse>(
            SpacePath(spaceId));
        Assert.NotNull(response);
        Assert.Equal(expectedNote, response.ViewerSettings.Note);
        Assert.Equal(
            expectedCustomNickname,
            response.ViewerSettings.CustomNickname);
    }

    private static string SpacePath(Guid spaceId) =>
        $"/api/private-spaces/{spaceId}";
}
