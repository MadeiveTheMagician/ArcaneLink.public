using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
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
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ActiveMember_CanCreateAndReadMessage()
    {
        _client.AuthorizeWith(await _client.LoginAsync("member"));

        var createResponse = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "  hello from integration  " });
        createResponse.EnsureSuccessStatusCode();

        var created = await createResponse.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("hello from integration", created?["body"]?.GetValue<string>());

        var messages = await _client.GetFromJsonAsync<JsonArray>(MessagesPath());
        Assert.Contains(
            messages ?? [],
            message => message?["body"]?.GetValue<string>() == "hello from integration");
    }

    [Fact]
    public async Task ActiveMember_CanEditOwnMessage()
    {
        _client.AuthorizeWith(await _client.LoginAsync("member"));
        var createResponse = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "before own edit" });
        createResponse.EnsureSuccessStatusCode();

        var created = await createResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>();
        Assert.NotNull(created);

        var updateResponse = await _client.PatchAsJsonAsync(
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
        _client.AuthorizeWith(await _client.LoginAsync("member"));
        var marker = $"cursor-{Guid.NewGuid():N}";
        var messageIds = new List<Guid>();

        for (var index = 0; index < 3; index++)
        {
            using var createResponse = await _client.PostAsJsonAsync(
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
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.SpaceMessages
                .Where(message => messageIds.Contains(message.Id))
                .ExecuteUpdateAsync(update => update
                    .SetProperty(message => message.CreatedAt, sharedCreatedAt)
                    .SetProperty(message => message.UpdatedAt, sharedCreatedAt));
        }

        var firstPage = await _client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            $"{MessagesPath()}?limit=2");
        var firstPageMatches = Assert.IsAssignableFrom<List<SpaceMessageResponse>>(
                firstPage)
            .Where(message => message.Body?.StartsWith(marker) == true)
            .ToList();
        Assert.Equal(2, firstPageMatches.Count);

        var cursor = firstPageMatches[0];
        var cursorCreatedAt = Uri.EscapeDataString(cursor.CreatedAt.ToString("O"));
        var nextPage = await _client.GetFromJsonAsync<List<SpaceMessageResponse>>(
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
        _client.AuthorizeWith(await _client.LoginAsync("outsider"));

        var response = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "not a member" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task OwnerCanPinMessage_ButMemberCannot()
    {
        _client.AuthorizeWith(await _client.LoginAsync("member"));
        var createResponse = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "pin me" });
        createResponse.EnsureSuccessStatusCode();

        var message = await createResponse.Content.ReadFromJsonAsync<JsonObject>();
        var messageId = message?["id"]?.GetValue<Guid>();
        Assert.True(messageId.HasValue);

        var memberPinResponse = await _client.PostAsync($"{MessagesPath()}/{messageId}/pin", null);
        Assert.Equal(HttpStatusCode.NotFound, memberPinResponse.StatusCode);

        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        var ownerPinResponse = await _client.PostAsync($"{MessagesPath()}/{messageId}/pin", null);
        ownerPinResponse.EnsureSuccessStatusCode();

        var pinned = await _client.GetFromJsonAsync<JsonArray>($"{MessagesPath()}/pinned");
        Assert.Contains(
            pinned ?? [],
            pinnedMessage => pinnedMessage?["id"]?.GetValue<Guid>() == messageId);
    }

    [Fact]
    public async Task Member_CannotEditOrDeleteAnotherUsersMessage()
    {
        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        var createResponse = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "owner message protected from member mutation" });
        createResponse.EnsureSuccessStatusCode();

        var message = await createResponse.Content.ReadFromJsonAsync<JsonObject>();
        var messageId = message?["id"]?.GetValue<Guid>();
        Assert.True(messageId.HasValue);

        _client.AuthorizeWith(await _client.LoginAsync("member"));
        var updateResponse = await _client.PatchAsJsonAsync(
            $"{MessagesPath()}/{messageId}",
            new UpdateSpaceMessageRequest { Body = "member mutation should not land" });
        var deleteResponse = await _client.DeleteAsync($"{MessagesPath()}/{messageId}");

        Assert.Equal(HttpStatusCode.NotFound, updateResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, deleteResponse.StatusCode);

        var messages = await _client.GetFromJsonAsync<JsonArray>(MessagesPath());
        Assert.Contains(
            messages ?? [],
            candidate =>
                candidate?["id"]?.GetValue<Guid>() == messageId &&
                candidate?["body"]?.GetValue<string>() == "owner message protected from member mutation");
    }

    [Fact]
    public async Task Member_CanSendMultipleAttachmentsAndStreamUnicodeNamedVideo()
    {
        _client.AuthorizeWith(await _client.LoginAsync("member"));

        var image = await UploadAttachmentAsync(
            "preview.png",
            "image/png",
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        var video = await UploadAttachmentAsync(
            "Запись экрана.mp4",
            "video/mp4",
            [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D]);

        AssertStoredInIsolatedTestRoot(image);
        AssertStoredInIsolatedTestRoot(video);

        var createResponse = await _client.PostAsJsonAsync(
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

        using var videoResponse = await _client.GetAsync($"/api/assets/{video.Id}/content");
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

        using var response = await _client.PostAsync($"{MessagesPath()}/attachments", form);
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<AssetResponse>())!;
    }

    private void AssertStoredInIsolatedTestRoot(AssetResponse asset)
    {
        var testStorageRoot = Path.GetFullPath(_factory.AssetStorageRootPath);
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
