using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Notifications;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Messages;

public sealed class GranularMessagePermissionIntegrationTests
{
    [Fact]
    public async Task ReadHistory_DeniesTimelineSearchPinsReadStateAttachmentNotificationAndOverviewPreview()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var asset = await UploadAttachmentAsync(client, "history-evidence.png");
        var marker = $"history-{Guid.NewGuid():N}";
        var body = $"{marker} @member";
        using var createResponse = await client.PostAsJsonAsync(
            MessagesPath,
            new CreateSpaceMessageRequest
            {
                Body = body,
                Attachments =
                [
                    new CreateSpaceMessageAttachmentRequest { AssetId = asset.Id }
                ],
                Mentions =
                [
                    new SpaceMessageMentionRequest
                    {
                        Kind = MentionKinds.User,
                        TargetId = ArcaneLinkApiFactory.MemberUserId,
                        Start = body.IndexOf("@member", StringComparison.Ordinal),
                        Length = "@member".Length
                    }
                ]
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
        var message = (await createResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;
        using (var pinResponse = await client.PostAsync(
                   $"{MessagesPath}/{message.Id}/pin",
                   null))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(pinResponse);
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        Assert.Contains(
            await GetNotificationsAsync(client),
            notification => notification.MessageId == message.Id);
        await AssertStatusAsync(
            client,
            $"/api/assets/{asset.Id}/content",
            HttpStatusCode.OK);

        await SetEveryonePermissionsAsync(
            factory,
            ServerPermissionRegistry.DefaultEveryonePermissionCodes
                .Except(["READ_MESSAGE_HISTORY"], StringComparer.Ordinal));

        await AssertStatusAsync(client, MessagesPath, HttpStatusCode.NotFound);
        await AssertStatusAsync(
            client,
            $"{MessagesPath}/pinned",
            HttpStatusCode.NotFound);
        using (var markReadResponse = await client.PutAsJsonAsync(
                   $"{MessagesPath}/read-state",
                   new MarkSpaceReadRequest { ThroughMessageId = message.Id }))
        {
            Assert.Equal(HttpStatusCode.NotFound, markReadResponse.StatusCode);
        }
        await AssertStatusAsync(
            client,
            $"/api/assets/{asset.Id}/content",
            HttpStatusCode.NotFound);

        using (var searchResponse = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/messages/search?query={marker}"))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(searchResponse);
            var results = await searchResponse.Content
                .ReadFromJsonAsync<List<SpaceMessageResponse>>();
            Assert.DoesNotContain(results ?? [], candidate => candidate.Id == message.Id);
        }

        Assert.DoesNotContain(
            await GetNotificationsAsync(client),
            notification => notification.MessageId == message.Id);
        var memberships = await client.GetFromJsonAsync<List<ServerMemberResponse>>(
            "/api/servers/me");
        var membership = Assert.Single(
            memberships!,
            candidate => candidate.ServerId == ArcaneLinkApiFactory.ServerId);
        Assert.Equal(0, membership.UnreadCount);
        Assert.Null(membership.LastMessage);
    }

    [Fact]
    public async Task MessagingPermissions_IndependentlyGateLinksAttachmentsReactionsEveryoneAndView()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("member"));
        var stagedAsset = await UploadAttachmentAsync(client, "staged-before-revoke.png");

        await SetEveryonePermissionsExceptAsync(factory, "ATTACH_FILES");
        using (var uploadResponse = await UploadAttachmentResponseAsync(
                   client,
                   "must-not-upload.png"))
        {
            Assert.Equal(HttpStatusCode.NotFound, uploadResponse.StatusCode);
        }
        using (var attachResponse = await client.PostAsJsonAsync(
                   MessagesPath,
                   new CreateSpaceMessageRequest
                   {
                       Body = "must not attach staged asset",
                       Attachments =
                       [
                           new CreateSpaceMessageAttachmentRequest
                           {
                               AssetId = stagedAsset.Id
                           }
                       ]
                   }))
        {
            Assert.Equal(HttpStatusCode.NotFound, attachResponse.StatusCode);
        }

        await SetEveryonePermissionsExceptAsync(factory, "SEND_LINKS");
        foreach (var body in new[]
                 {
                     "https://example.com/path",
                     "[docs](example.com/reference)",
                     "https：／／example.com/unicode"
                 })
        {
            using var linkResponse = await client.PostAsJsonAsync(
                MessagesPath,
                new CreateSpaceMessageRequest { Body = body });
            Assert.Equal(HttpStatusCode.NotFound, linkResponse.StatusCode);
        }

        using var plainResponse = await client.PostAsJsonAsync(
            MessagesPath,
            new CreateSpaceMessageRequest
            {
                Body = "plain text and member@example.test are still allowed"
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(plainResponse);
        var editable = (await plainResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;
        using (var linkEditResponse = await client.PatchAsJsonAsync(
                   $"{MessagesPath}/{editable.Id}",
                   new UpdateSpaceMessageRequest
                   {
                       Body = "updated to https://example.com"
                   }))
        {
            Assert.Equal(HttpStatusCode.NotFound, linkEditResponse.StatusCode);
        }

        await SetEveryonePermissionsExceptAsync(factory, "MENTION_EVERYONE");
        using (var everyoneResponse = await client.PostAsJsonAsync(
                   MessagesPath,
                   new CreateSpaceMessageRequest
                   {
                       Body = "@everyone",
                       Mentions =
                       [
                           new SpaceMessageMentionRequest
                           {
                               Kind = MentionKinds.Everyone,
                               Start = 0,
                               Length = "@everyone".Length
                           }
                       ]
                   }))
        {
            Assert.Equal(HttpStatusCode.NotFound, everyoneResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var targetResponse = await client.PostAsJsonAsync(
            MessagesPath,
            new CreateSpaceMessageRequest { Body = "reaction target" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(targetResponse);
        var target = (await targetResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;
        await SetEveryonePermissionsExceptAsync(factory, "ADD_REACTIONS");
        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var reactionResponse = await client.PutAsJsonAsync(
                   $"{MessagesPath}/{target.Id}/reactions",
                   new SetSpaceMessageReactionRequest { EmojiCode = "👍" }))
        {
            Assert.Equal(HttpStatusCode.NotFound, reactionResponse.StatusCode);
        }

        await SetEveryonePermissionsExceptAsync(factory, "VIEW_TEXT_SPACES");
        await AssertStatusAsync(client, MessagesPath, HttpStatusCode.NotFound);
        using (var sendWithoutView = await client.PostAsJsonAsync(
                   MessagesPath,
                   new CreateSpaceMessageRequest { Body = "view dependency blocks send" }))
        {
            Assert.Equal(HttpStatusCode.NotFound, sendWithoutView.StatusCode);
        }

        await SetEveryonePermissionsExceptAsync(factory, "READ_MESSAGE_HISTORY");
        using (var sendWithoutHistory = await client.PostAsJsonAsync(
                   MessagesPath,
                   new CreateSpaceMessageRequest { Body = "send does not imply history" }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(sendWithoutHistory);
        }
        await AssertStatusAsync(client, MessagesPath, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ManagePinsAndMessages_RequireTheirGranularRights()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var createResponse = await client.PostAsJsonAsync(
            MessagesPath,
            new CreateSpaceMessageRequest { Body = "granular moderation target" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
        var message = (await createResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;

        client.AuthorizeWith(await client.LoginAsync("member"));
        await AssertStatusAsync(
            client,
            $"{MessagesPath}/{message.Id}/pin",
            HttpStatusCode.NotFound,
            HttpMethod.Post);
        await AssertStatusAsync(
            client,
            $"{MessagesPath}/{message.Id}",
            HttpStatusCode.NotFound,
            HttpMethod.Delete);

        await AddGranularRoleAsync(
            factory,
            ServerPermissionRegistry.CreateMask(
                ["MANAGE_PINS", "MANAGE_MESSAGES"]));
        using (var pinResponse = await client.PostAsync(
                   $"{MessagesPath}/{message.Id}/pin",
                   null))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(pinResponse);
        }
        using var deleteResponse = await client.DeleteAsync(
            $"{MessagesPath}/{message.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    private static async Task<AssetResponse> UploadAttachmentAsync(
        HttpClient client,
        string fileName)
    {
        using var response = await UploadAttachmentResponseAsync(client, fileName);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<AssetResponse>())!;
    }

    private static async Task<HttpResponseMessage> UploadAttachmentResponseAsync(
        HttpClient client,
        string fileName)
    {
        var form = new MultipartFormDataContent();
        var content = new ByteArrayContent(
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        content.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(content, "file", fileName);
        return await client.PostAsync($"{MessagesPath}/attachments", form);
    }

    private static async Task<IReadOnlyList<UserNotificationResponse>>
        GetNotificationsAsync(HttpClient client)
    {
        return await client.GetFromJsonAsync<List<UserNotificationResponse>>(
                   "/api/notifications") ?? [];
    }

    private static async Task AssertStatusAsync(
        HttpClient client,
        string path,
        HttpStatusCode expected,
        HttpMethod? method = null)
    {
        using var request = new HttpRequestMessage(method ?? HttpMethod.Get, path);
        using var response = await client.SendAsync(request);
        Assert.Equal(expected, response.StatusCode);
    }

    private static Task SetEveryonePermissionsExceptAsync(
        ArcaneLinkApiFactory factory,
        string permissionCode)
    {
        return SetEveryonePermissionsAsync(
            factory,
            ServerPermissionRegistry.DefaultEveryonePermissionCodes
                .Except([permissionCode], StringComparer.Ordinal));
    }

    private static async Task SetEveryonePermissionsAsync(
        ArcaneLinkApiFactory factory,
        IEnumerable<string> permissionCodes)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var role = await db.ServerRoles.SingleOrDefaultAsync(candidate =>
            candidate.ServerId == ArcaneLinkApiFactory.ServerId &&
            candidate.Kind == ServerRoleKindCodes.Everyone &&
            candidate.DeletedAt == null);
        var now = DateTime.UtcNow;
        if (role == null)
        {
            role = new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                Code = "everyone-v1-test",
                Title = "@everyone v1 test",
                Kind = ServerRoleKindCodes.Everyone,
                Level = int.MaxValue,
                IsSystem = true,
                CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.ServerRoles.Add(role);
        }

        role.PermissionMask = ServerPermissionRegistry
            .CreateMask(permissionCodes)
            .ToByteArray();
        role.PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion;
        role.Version = Guid.NewGuid();
        role.UpdatedAt = now;
        await BumpAuthorizationVersionAsync(db);
        await db.SaveChangesAsync();
    }

    private static async Task AddGranularRoleAsync(
        ArcaneLinkApiFactory factory,
        PermissionMask256 permissionMask)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var roleId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var role = new ServerRole
        {
            Id = roleId,
            ServerId = ArcaneLinkApiFactory.ServerId,
            Code = $"granular-manager-{roleId:N}",
            Title = $"Granular manager {roleId:N}"[..40],
            Kind = ServerRoleKindCodes.Standard,
            Level = 10,
            PermissionMask = permissionMask.ToByteArray(),
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.ServerRoles.Add(role);
        db.ServerMemberRoles.Add(new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            MemberId = ArcaneLinkApiFactory.MemberMemberId,
            RoleId = roleId,
            AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            AssignedAt = now
        });
        await BumpAuthorizationVersionAsync(db);
        await db.SaveChangesAsync();
    }

    private static async Task BumpAuthorizationVersionAsync(AppDbContext db)
    {
        var server = await db.Servers.SingleAsync(candidate =>
            candidate.Id == ArcaneLinkApiFactory.ServerId);
        server.AuthorizationVersion = Guid.NewGuid();
    }

    private static string MessagesPath =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/messages";
}
