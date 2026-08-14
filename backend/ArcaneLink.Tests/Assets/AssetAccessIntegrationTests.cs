using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Assets;

public sealed class AssetAccessIntegrationTests
{
    [Fact]
    public async Task ServerMessageAttachment_RequiresSpaceViewAccess()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();

        client.AuthorizeWith(await client.LoginAsync("member"));
        var asset = await UploadAttachmentAsync(
            client,
            ServerMessagesPath(),
            "server-private.png");
        await CreateMessageAsync(client, ServerMessagesPath(), asset.Id);
        using (var genericDelete = await client.DeleteAsync(
                   $"/api/assets/{asset.Id}"))
        {
            Assert.Equal(HttpStatusCode.Conflict, genericDelete.StatusCode);
        }
        await AssertContentStatusAsync(client, asset.Id, HttpStatusCode.OK);

        client.DefaultRequestHeaders.Authorization = null;
        using (var memberContent = await client.GetAsync(
                   $"/api/assets/{asset.Id}/content"))
        {
            Assert.Equal(HttpStatusCode.OK, memberContent.StatusCode);
            Assert.Contains(
                "private",
                memberContent.Headers.CacheControl?.ToString() ?? string.Empty,
                StringComparison.OrdinalIgnoreCase);
            Assert.Contains(
                "no-store",
                memberContent.Headers.CacheControl?.ToString() ?? string.Empty,
                StringComparison.OrdinalIgnoreCase);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        await AssertContentStatusAsync(client, asset.Id, HttpStatusCode.OK);
        using (var denyViewResponse = await client.PutAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/permission-overrides",
                   new UpsertSpacePermissionOverrideRequest
                   {
                       MemberId = ArcaneLinkApiFactory.MemberMemberId,
                       PermissionId = SpacePermissionIds.ViewSpace,
                       Deny = true
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(denyViewResponse);
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        await AssertContentStatusAsync(client, asset.Id, HttpStatusCode.NotFound);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        await AssertContentStatusAsync(client, asset.Id, HttpStatusCode.NotFound);
        using var outsiderMetadata = await client.GetAsync(
            $"/api/assets/{asset.Id}");
        Assert.Equal(HttpStatusCode.NotFound, outsiderMetadata.StatusCode);

        using var anonymousClient = factory.CreateClient();
        await AssertContentStatusAsync(
            anonymousClient,
            asset.Id,
            HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PrivateMessageAttachment_RequiresActivePrivateMembership()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var createSpaceResponse = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                Title = "Attachment access"
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createSpaceResponse);
        var privateSpace = await createSpaceResponse.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>();
        Assert.NotNull(privateSpace);
        using var addMemberResponse = await client.PostAsJsonAsync(
            $"/api/private-spaces/{privateSpace.SpaceId}/members",
            new AddPrivateSpaceMemberRequest
            {
                UserId = ArcaneLinkApiFactory.MemberUserId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(addMemberResponse);
        var membership = (await addMemberResponse.Content
            .ReadFromJsonAsync<PrivateSpaceMembershipMutationResponse>())!;
        Assert.False(membership.CreatedGroup);

        var messagesPath = $"/api/private-spaces/{privateSpace.SpaceId}/messages";
        var asset = await UploadAttachmentAsync(
            client,
            messagesPath,
            "private-space.png");
        await CreateMessageAsync(client, messagesPath, asset.Id);

        client.AuthorizeWith(await client.LoginAsync("member"));
        await AssertContentStatusAsync(client, asset.Id, HttpStatusCode.OK);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        await AssertContentStatusAsync(client, asset.Id, HttpStatusCode.NotFound);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var removeResponse = await client.DeleteAsync(
            $"/api/private-spaces/{privateSpace.SpaceId}/members/{membership.Member.Id}");
        Assert.Equal(HttpStatusCode.NoContent, removeResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("member"));
        await AssertContentStatusAsync(client, asset.Id, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UnlinkedMessageAttachment_IsReadableOnlyByOwner()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();

        var memberAccessToken = await client.LoginAsync("member");
        client.AuthorizeWith(memberAccessToken);
        var asset = await UploadAttachmentAsync(
            client,
            ServerMessagesPath(),
            "draft.png");
        client.DefaultRequestHeaders.Authorization = null;
        await AssertContentStatusAsync(client, asset.Id, HttpStatusCode.OK);
        using (var cookieOnlyDelete = await client.DeleteAsync(
                   $"/api/assets/{asset.Id}"))
        {
            Assert.Equal(HttpStatusCode.Unauthorized, cookieOnlyDelete.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        await AssertContentStatusAsync(client, asset.Id, HttpStatusCode.NotFound);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        await AssertContentStatusAsync(client, asset.Id, HttpStatusCode.NotFound);

        using var anonymousClient = factory.CreateClient();
        await AssertContentStatusAsync(
            anonymousClient,
            asset.Id,
            HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenericDelete_RejectsServerIconManagedByServerDomain()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var asset = await UploadImageAssetAsync(
            client,
            AssetTypeIds.ServerIcon,
            "managed-server-icon.png");

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var server = await db.Servers.SingleAsync(candidate =>
                candidate.Id == ArcaneLinkApiFactory.ServerId);
            server.IconAssetId = asset.Id;
            await db.SaveChangesAsync();
        }

        using (var deleteResponse = await client.DeleteAsync(
                   $"/api/assets/{asset.Id}"))
        {
            Assert.Equal(HttpStatusCode.Conflict, deleteResponse.StatusCode);
        }

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var server = await db.Servers.SingleAsync(candidate =>
                candidate.Id == ArcaneLinkApiFactory.ServerId);
            Assert.Equal(asset.Id, server.IconAssetId);
            Assert.Null(await db.Assets
                .Where(candidate => candidate.Id == asset.Id)
                .Select(candidate => candidate.DeletedAt)
                .SingleAsync());

            server.IconAssetId = null;
            await db.SaveChangesAsync();
        }

        using var cleanupResponse = await client.DeleteAsync(
            $"/api/assets/{asset.Id}");
        Assert.Equal(HttpStatusCode.NoContent, cleanupResponse.StatusCode);
    }

    private static async Task<AssetResponse> UploadAttachmentAsync(
        HttpClient client,
        string messagesPath,
        string fileName)
    {
        using var form = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "file", fileName);

        using var response = await client.PostAsync(
            $"{messagesPath}/attachments",
            form);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);

        var asset = await response.Content.ReadFromJsonAsync<AssetResponse>();
        Assert.NotNull(asset);
        return asset;
    }

    private static async Task<AssetResponse> UploadImageAssetAsync(
        HttpClient client,
        Guid assetTypeId,
        string fileName)
    {
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(assetTypeId.ToString()), "AssetTypeId");
        using var fileContent = new ByteArrayContent(
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "File", fileName);

        using var response = await client.PostAsync("/api/assets/upload", form);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<AssetResponse>())!;
    }

    private static async Task CreateMessageAsync(
        HttpClient client,
        string messagesPath,
        Guid assetId)
    {
        using var response = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest
            {
                Body = "Attachment access test",
                Attachments =
                [
                    new CreateSpaceMessageAttachmentRequest
                    {
                        AssetId = assetId
                    }
                ]
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
    }

    private static async Task AssertContentStatusAsync(
        HttpClient client,
        Guid assetId,
        HttpStatusCode expectedStatusCode)
    {
        using var response = await client.GetAsync(
            $"/api/assets/{assetId}/content");
        Assert.Equal(expectedStatusCode, response.StatusCode);
    }

    private static string ServerMessagesPath()
    {
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/messages";
    }
}
