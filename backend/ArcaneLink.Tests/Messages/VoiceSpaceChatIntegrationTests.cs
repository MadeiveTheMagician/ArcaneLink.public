using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Moderation;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Messages;

public sealed class VoiceSpaceChatIntegrationTests
{
    private static readonly Guid VoiceSpaceId =
        Guid.Parse("dddddddd-0000-0000-0000-000000000099");
    private static readonly Guid VoiceChatSpaceId =
        Guid.Parse("dddddddd-0000-0000-0000-000000000100");

    [Fact]
    public async Task VoiceSpaceOwnsPersistentChatWithUnreadAndReadState()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddVoiceSpaceAsync(factory);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var createResponse = await client.PostAsJsonAsync(
            ChatPath(),
            new CreateSpaceMessageRequest { Body = "voice chat message" });
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>();
        Assert.NotNull(created);
        Assert.Equal(VoiceChatSpaceId, created.SpaceId);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var messages = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            ChatPath());
        Assert.Contains(messages!, message => message.Id == created.Id);

        var spaces = await client.GetFromJsonAsync<List<SpaceResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces");
        var voiceSpace = Assert.Single(spaces!, space => space.Id == VoiceSpaceId);
        Assert.Equal(VoiceChatSpaceId, voiceSpace.VoiceChatSpaceId);
        Assert.DoesNotContain(spaces!, space => space.Id == VoiceChatSpaceId);
        Assert.True(voiceSpace.EffectiveCapabilities.CanSendMessages);
        Assert.Equal(1, voiceSpace.UnreadCount);

        using var markReadResponse = await client.PutAsJsonAsync(
            $"{ChatPath()}/read-state",
            new MarkSpaceReadRequest { ThroughMessageId = created.Id });
        markReadResponse.EnsureSuccessStatusCode();
        var marked = await markReadResponse.Content
            .ReadFromJsonAsync<SpaceReadStateResponse>();
        Assert.Equal(0, marked?.UnreadCount);
    }

    [Fact]
    public async Task VoiceChatSendMessagesPermissionIsIndependentFromConnectPermission()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddVoiceSpaceAsync(factory);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var denyResponse = await client.PutAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{VoiceSpaceId}/permission-overrides",
            new UpsertSpacePermissionOverrideRequest
            {
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                PermissionId = SpacePermissionIds.SendMessages,
                Deny = true
            });
        denyResponse.EnsureSuccessStatusCode();

        client.AuthorizeWith(await client.LoginAsync("member"));
        var spaces = await client.GetFromJsonAsync<List<SpaceResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces");
        var voiceSpace = Assert.Single(spaces!, space => space.Id == VoiceSpaceId);
        Assert.False(voiceSpace.EffectiveCapabilities.CanSendMessages);
        Assert.True(voiceSpace.EffectiveCapabilities.CanConnectVoice);

        using var createResponse = await client.PostAsJsonAsync(
            ChatPath(),
            new CreateSpaceMessageRequest { Body = "must be denied" });
        Assert.Equal(HttpStatusCode.NotFound, createResponse.StatusCode);
    }

    [Fact]
    public async Task VoiceChat_UsesVoiceSpecificSendAndHistoryPermissions()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddVoiceSpaceAsync(factory);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var seedResponse = await client.PostAsJsonAsync(
                   ChatPath(),
                   new CreateSpaceMessageRequest { Body = "voice history target" }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(seedResponse);
        }

        await SetEveryonePermissionsExceptAsync(
            factory,
            "SEND_MESSAGES_IN_VOICE_CHAT");
        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var deniedVoiceSend = await client.PostAsJsonAsync(
                   ChatPath(),
                   new CreateSpaceMessageRequest { Body = "voice send denied" }))
        {
            Assert.Equal(HttpStatusCode.NotFound, deniedVoiceSend.StatusCode);
        }
        using (var allowedTextSend = await client.PostAsJsonAsync(
                   TextMessagesPath(),
                   new CreateSpaceMessageRequest { Body = "text send remains allowed" }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(allowedTextSend);
        }

        await SetEveryonePermissionsExceptAsync(
            factory,
            "READ_VOICE_CHAT_HISTORY");
        using (var deniedVoiceHistory = await client.GetAsync(ChatPath()))
        {
            Assert.Equal(HttpStatusCode.NotFound, deniedVoiceHistory.StatusCode);
        }
        using var allowedTextHistory = await client.GetAsync(TextMessagesPath());
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(allowedTextHistory);
    }

    [Fact]
    public async Task VoiceChatReportUsesCompanionSpaceAndParentAuthorization()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddVoiceSpaceAsync(factory);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var createResponse = await client.PostAsJsonAsync(
            ChatPath(),
            new CreateSpaceMessageRequest { Body = "reportable voice chat message" });
        createResponse.EnsureSuccessStatusCode();
        var message = await createResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>();
        Assert.NotNull(message);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var reportResponse = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{VoiceChatSpaceId}/messages/{message.Id}/reports",
            new CreateModerationReportRequest
            {
                ReasonCode = ModerationReasonCodes.Harassment
            });
        reportResponse.EnsureSuccessStatusCode();

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var moderationCase = await db.ModerationCases
            .AsNoTracking()
            .SingleAsync(report => report.MessageId == message.Id);
        Assert.Equal(VoiceChatSpaceId, moderationCase.SpaceId);
    }

    [Fact]
    public async Task VoiceSpaceCreationMaintainsHiddenCompanionLifecycle()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var spacesPath =
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces";

        using var createResponse = await client.PostAsJsonAsync(
            spacesPath,
            new CreateSpaceRequest
            {
                TypeCode = "voice_room",
                Title = "lifecycle voice"
            });
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content
            .ReadFromJsonAsync<SpaceResponse>();
        Assert.NotNull(created);
        Assert.True(created.VoiceChatSpaceId.HasValue);

        var visibleSpaces = await client.GetFromJsonAsync<List<SpaceResponse>>(
            spacesPath);
        Assert.Contains(visibleSpaces!, space => space.Id == created.Id);
        Assert.DoesNotContain(
            visibleSpaces!,
            space => space.Id == created.VoiceChatSpaceId.Value);

        using var updateResponse = await client.PatchAsJsonAsync(
            $"{spacesPath}/{created.Id}",
            new UpdateSpaceRequest
            {
                Title = "renamed lifecycle voice",
                Description = "synced description"
            });
        updateResponse.EnsureSuccessStatusCode();

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"{spacesPath}/{created.Id}")
        {
            Content = JsonContent.Create(new DeleteSpaceRequest())
        };
        using var deleteResponse = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var companion = await db.Spaces
            .AsNoTracking()
            .SingleAsync(space => space.Id == created.VoiceChatSpaceId.Value);
        Assert.Equal(created.Id, companion.ParentVoiceSpaceId);
        Assert.Equal("renamed lifecycle voice", companion.Title);
        Assert.Equal("synced description", companion.Description);
        Assert.True(companion.IsSystem);
        Assert.NotNull(companion.DeletedAt);
    }

    private static async Task AddVoiceSpaceAsync(ArcaneLinkApiFactory factory)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        db.Spaces.AddRange(
        new Space
        {
            Id = VoiceSpaceId,
            ServerId = ArcaneLinkApiFactory.ServerId,
            TypeId = SpaceIds.TypeVoiceRoom,
            CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            Title = "voice-with-chat",
            Position = 1,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        },
        new Space
        {
            Id = VoiceChatSpaceId,
            ServerId = ArcaneLinkApiFactory.ServerId,
            TypeId = SpaceIds.TypeTextRoom,
            ParentVoiceSpaceId = VoiceSpaceId,
            CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            Title = "voice-with-chat",
            Position = 0,
            IsSystem = true,
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();
    }

    private static async Task SetEveryonePermissionsExceptAsync(
        ArcaneLinkApiFactory factory,
        string deniedPermissionCode)
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
                Code = "voice-everyone-v1-test",
                Title = "@everyone voice v1 test",
                Kind = ServerRoleKindCodes.Everyone,
                Level = int.MaxValue,
                IsSystem = true,
                CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.ServerRoles.Add(role);
        }

        role.PermissionMask = ServerPermissionRegistry.CreateMask(
                ServerPermissionRegistry.DefaultEveryonePermissionCodes
                    .Except([deniedPermissionCode], StringComparer.Ordinal))
            .ToByteArray();
        role.PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion;
        role.Version = Guid.NewGuid();
        role.UpdatedAt = now;
        var server = await db.Servers.SingleAsync(candidate =>
            candidate.Id == ArcaneLinkApiFactory.ServerId);
        server.AuthorizationVersion = Guid.NewGuid();
        await db.SaveChangesAsync();
    }

    private static string ChatPath()
    {
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/voice-spaces/{VoiceSpaceId}/chat/messages";
    }

    private static string TextMessagesPath()
    {
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/messages";
    }
}
