using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Messages;

public sealed class MessageIntegrationTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly ArcaneLinkApiFactory _factory;
    private readonly HttpClient _client;

    public MessageIntegrationTests(ArcaneLinkApiFactory factory)
    {
        this._factory = factory;
        this._client = factory.CreateClient();
    }

    [Fact]
    public async Task ActiveMember_CanCreateAndReadMessage()
    {
        this._client.AuthorizeWith(await this._client.LoginAsync("member"));

        var createResponse = await this._client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "  hello from integration  " });
        createResponse.EnsureSuccessStatusCode();

        var created = await createResponse.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("hello from integration", created?["body"]?.GetValue<string>());

        var messages = await this._client.GetFromJsonAsync<JsonArray>(MessagesPath());
        Assert.Contains(
            messages ?? [],
            message => message?["body"]?.GetValue<string>() == "hello from integration");
    }

    [Fact]
    public async Task ActiveMember_CanEditOwnMessage()
    {
        this._client.AuthorizeWith(await this._client.LoginAsync("member"));
        var createResponse = await this._client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "before own edit" });
        createResponse.EnsureSuccessStatusCode();

        var created = await createResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>();
        Assert.NotNull(created);

        var updateResponse = await this._client.PatchAsJsonAsync(
            $"{MessagesPath()}/{created.Id}",
            new UpdateSpaceMessageRequest { Body = "after own edit" });
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>();
        Assert.Equal("after own edit", updated?.Body);
        Assert.NotNull(updated?.EditedAt);
    }

    [Fact]
    public async Task CompositeCursor_DoesNotSkipMessagesWithEqualCreatedAt()
    {
        this._client.AuthorizeWith(await this._client.LoginAsync("member"));
        var marker = $"cursor-{Guid.NewGuid():N}";
        var messageIds = new List<Guid>();

        for (var index = 0; index < 3; index++)
        {
            using var createResponse = await this._client.PostAsJsonAsync(
                MessagesPath(),
                new CreateSpaceMessageRequest { Body = $"{marker}-{index}" });
            createResponse.EnsureSuccessStatusCode();
            var created = await createResponse.Content
                .ReadFromJsonAsync<SpaceMessageResponse>();
            messageIds.Add(Assert.IsType<Guid>(created?.Id));
        }

        var sharedCreatedAt = new DateTime(
            2040,
            1,
            1,
            12,
            0,
            0,
            DateTimeKind.Utc);
        await using (var scope = this._factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.SpaceMessages
                .Where(message => messageIds.Contains(message.Id))
                .ExecuteUpdateAsync(update => update
                    .SetProperty(message => message.CreatedAt, sharedCreatedAt)
                    .SetProperty(message => message.UpdatedAt, sharedCreatedAt));
        }

        var firstPage = await this._client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            $"{MessagesPath()}?limit=2");
        var firstPageMatches = Assert.IsAssignableFrom<List<SpaceMessageResponse>>(
                firstPage)
            .Where(message => message.Body?.StartsWith(marker) == true)
            .ToList();
        Assert.Equal(2, firstPageMatches.Count);

        var cursor = firstPageMatches[0];
        var cursorCreatedAt = Uri.EscapeDataString(cursor.CreatedAt.ToString("O"));
        var nextPage = await this._client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            $"{MessagesPath()}?limit=100&beforeCreatedAt={cursorCreatedAt}&beforeId={cursor.Id}");
        var nextPageIds = Assert.IsAssignableFrom<List<SpaceMessageResponse>>(
                nextPage)
            .Where(message => message.Body?.StartsWith(marker) == true)
            .Select(message => message.Id)
            .ToHashSet();

        Assert.Single(nextPageIds);
        Assert.DoesNotContain(
            firstPageMatches,
            message => nextPageIds.Contains(message.Id));
        var expectedNextPageIds = messageIds
            .Except(firstPageMatches.Select(message => message.Id))
            .ToHashSet();
        Assert.True(expectedNextPageIds.SetEquals(nextPageIds));
    }

    [Fact]
    public async Task Outsider_CannotCreateServerMessage()
    {
        this._client.AuthorizeWith(await this._client.LoginAsync("outsider"));

        var response = await this._client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "not a member" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task OwnerCanPinAndUnpinMessage_WithPersistedTimelineEvent()
    {
        this._client.AuthorizeWith(await this._client.LoginAsync("member"));
        var createResponse = await this._client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "pin me" });
        createResponse.EnsureSuccessStatusCode();

        var message = await createResponse.Content.ReadFromJsonAsync<JsonObject>();
        var messageId = message?["id"]?.GetValue<Guid>();
        Assert.True(messageId.HasValue);

        var memberPinResponse = await this._client.PostAsync($"{MessagesPath()}/{messageId}/pin", null);
        Assert.Equal(HttpStatusCode.NotFound, memberPinResponse.StatusCode);

        this._client.AuthorizeWith(await this._client.LoginAsync("owner"));
        var ownerPinResponse = await this._client.PostAsync($"{MessagesPath()}/{messageId}/pin", null);
        ownerPinResponse.EnsureSuccessStatusCode();
        using (var repeatedPinResponse = await this._client.PostAsync(
                   $"{MessagesPath()}/{messageId}/pin",
                   null))
        {
            repeatedPinResponse.EnsureSuccessStatusCode();
        }

        var pinned = await this._client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            $"{MessagesPath()}/pinned");
        Assert.Contains(
            pinned ?? [],
            pinnedMessage => pinnedMessage.Id == messageId);

        var messages = await this._client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            MessagesPath());
        var pinEvent = Assert.Single(
            messages ?? [],
            candidate =>
                candidate.MessageTypeCode == "event" &&
                candidate.ReplyToMessageId == messageId);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, pinEvent.SenderUserId);
        using (var payload = JsonDocument.Parse(Assert.IsType<string>(pinEvent.Payload)))
        {
            Assert.Equal(
                "message_pinned",
                payload.RootElement.GetProperty("kind").GetString());
            Assert.Equal(
                messageId.Value,
                payload.RootElement.GetProperty("messageId").GetGuid());
        }

        this._client.AuthorizeWith(await this._client.LoginAsync("member"));
        using (var memberUnpinResponse = await this._client.DeleteAsync(
                   $"{MessagesPath()}/{messageId}/pin"))
        {
            Assert.Equal(HttpStatusCode.NotFound, memberUnpinResponse.StatusCode);
        }

        this._client.AuthorizeWith(await this._client.LoginAsync("owner"));
        using (var ownerUnpinResponse = await this._client.DeleteAsync(
                   $"{MessagesPath()}/{messageId}/pin"))
        {
            Assert.Equal(HttpStatusCode.NoContent, ownerUnpinResponse.StatusCode);
        }
        var afterUnpin = await this._client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            $"{MessagesPath()}/pinned");
        Assert.DoesNotContain(
            afterUnpin ?? [],
            pinnedMessage => pinnedMessage.Id == messageId);

        await using var scope = this._factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var pinRecord = await db.SpacePinnedMessages
            .AsNoTracking()
            .SingleAsync(record => record.MessageId == messageId);
        Assert.NotNull(pinRecord.UnpinnedAt);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, pinRecord.UnpinnedByUserId);
    }

    [Fact]
    public async Task Member_CannotEditOrDeleteAnotherUsersMessage()
    {
        this._client.AuthorizeWith(await this._client.LoginAsync("owner"));
        var createResponse = await this._client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "owner message protected from member mutation" });
        createResponse.EnsureSuccessStatusCode();

        var message = await createResponse.Content.ReadFromJsonAsync<JsonObject>();
        var messageId = message?["id"]?.GetValue<Guid>();
        Assert.True(messageId.HasValue);

        this._client.AuthorizeWith(await this._client.LoginAsync("member"));
        var updateResponse = await this._client.PatchAsJsonAsync(
            $"{MessagesPath()}/{messageId}",
            new UpdateSpaceMessageRequest { Body = "member mutation should not land" });
        var deleteResponse = await this._client.DeleteAsync($"{MessagesPath()}/{messageId}");

        Assert.Equal(HttpStatusCode.NotFound, updateResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, deleteResponse.StatusCode);

        var messages = await this._client.GetFromJsonAsync<JsonArray>(MessagesPath());
        Assert.Contains(
            messages ?? [],
            candidate =>
                candidate?["id"]?.GetValue<Guid>() == messageId &&
                candidate?["body"]?.GetValue<string>() == "owner message protected from member mutation");
    }

    [Fact]
    public async Task Member_CanSendMultipleAttachmentsAndStreamUnicodeNamedVideo()
    {
        this._client.AuthorizeWith(await this._client.LoginAsync("member"));

        var image = await this.UploadAttachmentAsync(
            "preview.png",
            "image/png",
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        var video = await this.UploadAttachmentAsync(
            "Запись экрана.mp4",
            "video/mp4",
            [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D]);

        this.AssertStoredInIsolatedTestRoot(image);
        this.AssertStoredInIsolatedTestRoot(video);

        var createResponse = await this._client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest
            {
                Attachments =
                [
                    new CreateSpaceMessageAttachmentRequest
                    {
                        AssetId = image.Id,
                        DisplayName = "Первое вложение.png"
                    },
                    new CreateSpaceMessageAttachmentRequest
                    {
                        AssetId = video.Id,
                        DisplayName = "Запись экрана.mp4"
                    }
                ]
            });
        createResponse.EnsureSuccessStatusCode();

        var created = await createResponse.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(2, created?["assets"]?.AsArray().Count);

        using var videoResponse = await this._client.GetAsync($"/api/assets/{video.Id}/content");
        videoResponse.EnsureSuccessStatusCode();
        Assert.Equal("video/mp4", videoResponse.Content.Headers.ContentType?.MediaType);
        Assert.Equal("Запись экрана.mp4", videoResponse.Content.Headers.ContentDisposition?.FileNameStar);
    }

    private async Task<AssetResponse> UploadAttachmentAsync(
        string fileName,
        string mimeType,
        byte[] content)
    {
        using var form = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(content);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(mimeType);
        form.Add(fileContent, "file", fileName);

        using var response = await this._client.PostAsync($"{MessagesPath()}/attachments", form);
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<AssetResponse>())!;
    }

    private void AssertStoredInIsolatedTestRoot(AssetResponse asset)
    {
        var testStorageRoot = Path.GetFullPath(this._factory.AssetStorageRootPath);
        var systemTempRoot = Path.GetFullPath(Path.GetTempPath());
        var storedFilePath = Path.GetFullPath(
            Assert.Single(
                Directory.GetFiles(
                    testStorageRoot,
                    $"{asset.Id}.*",
                    SearchOption.AllDirectories)));

        Assert.True(
            testStorageRoot.StartsWith(
                systemTempRoot,
                StringComparison.OrdinalIgnoreCase),
            $"Expected test storage '{testStorageRoot}' to be under '{systemTempRoot}'.");
        Assert.True(
            storedFilePath.StartsWith(
                $"{testStorageRoot}{Path.DirectorySeparatorChar}",
                StringComparison.OrdinalIgnoreCase),
            $"Expected asset path '{storedFilePath}' to be under '{testStorageRoot}'.");
        Assert.True(File.Exists(storedFilePath));
    }

    private static string MessagesPath()
    {
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/messages";
    }
}
