using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.NotificationsModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ArcaneLink.Tests.Messages;

public sealed class SpaceReadStateIntegrationTests
{
    [Fact]
    public async Task ServerMarker_IsMonotonic_UpdatesCountsAndNotifiesOnlyCurrentUser()
    {
        var realtime = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(realtime);
        using var client = factory.CreateClient();
        var first = await CreateServerMessageAsync(client, "owner", "first unread");
        await CreateServerMessageAsync(client, "member", "own message is read by definition");
        var second = await CreateServerMessageAsync(client, "owner", "second unread");

        client.AuthorizeWith(await client.LoginAsync("member"));
        var spaces = await client.GetFromJsonAsync<List<SpaceResponse>>(SpacesPath());
        Assert.Equal(2, Assert.Single(spaces!).UnreadCount);
        var servers = await client.GetFromJsonAsync<List<ServerMemberResponse>>(
            "/api/servers/me");
        Assert.Equal(2, Assert.Single(servers!).UnreadCount);

        var advanced = await MarkServerReadAsync(client, second.Id);
        Assert.True(advanced.Advanced);
        Assert.Equal(ArcaneLinkApiFactory.ServerId, advanced.ServerId);
        Assert.Equal(second.Id, advanced.LastReadMessageId);
        Assert.Equal(0, advanced.UnreadCount);

        var stale = await MarkServerReadAsync(client, first.Id);
        Assert.False(stale.Advanced);
        Assert.Equal(second.Id, stale.LastReadMessageId);
        Assert.Equal(0, stale.UnreadCount);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.SpaceReadStates.SingleAsync(x =>
            x.UserId == ArcaneLinkApiFactory.MemberUserId &&
            x.SpaceId == ArcaneLinkApiFactory.TextSpaceId);
        Assert.Equal(second.Id, stored.LastReadMessageId);

        var readEvents = realtime.UserEvents
            .Where(x => x.EventName == RealtimeEventNames.SpaceReadStateChanged)
            .ToList();
        var readEvent = Assert.Single(readEvents);
        Assert.Equal(ArcaneLinkApiFactory.MemberUserId, readEvent.UserId);
        var payload = Assert.IsType<SpaceReadStateResponse>(readEvent.Payload);
        Assert.True(payload.Advanced);
        Assert.Equal(0, payload.UnreadCount);
        Assert.DoesNotContain(
            realtime.ServerEvents,
            x => x.EventName == RealtimeEventNames.SpaceReadStateChanged);
    }

    [Fact]
    public async Task ServerMarker_UsesMessageIdAsDeterministicTieBreaker()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var firstCreated = await CreateServerMessageAsync(client, "owner", "same-time one");
        var secondCreated = await CreateServerMessageAsync(client, "owner", "same-time two");
        var sameTime = DateTime.UtcNow.AddMinutes(1);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.SpaceMessages
                .Where(x => x.Id == firstCreated.Id || x.Id == secondCreated.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.CreatedAt, sameTime)
                    .SetProperty(x => x.UpdatedAt, sameTime));
        }

        var orderedIds = new[] { firstCreated.Id, secondCreated.Id }
            .OrderBy(id => id)
            .ToArray();
        client.AuthorizeWith(await client.LoginAsync("member"));
        var feed = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            MessagesPath());
        Assert.Equal(
            orderedIds,
            feed!
                .Where(message => orderedIds.Contains(message.Id))
                .Select(message => message.Id));

        var lower = await MarkServerReadAsync(client, orderedIds[0]);
        Assert.True(lower.Advanced);
        Assert.Equal(1, lower.UnreadCount);

        var higher = await MarkServerReadAsync(client, orderedIds[1]);
        Assert.True(higher.Advanced);
        Assert.Equal(0, higher.UnreadCount);

        var stale = await MarkServerReadAsync(client, orderedIds[0]);
        Assert.False(stale.Advanced);
        Assert.Equal(orderedIds[1], stale.LastReadMessageId);
        Assert.Equal(0, stale.UnreadCount);
    }

    [Fact]
    public async Task ServerMarker_RestoresNullMessageIdAtEqualTimestamp()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateServerMessageAsync(
            client,
            "owner",
            "marker whose referenced message was cleared");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var createdAt = await db.SpaceMessages
                .Where(x => x.Id == message.Id)
                .Select(x => x.CreatedAt)
                .SingleAsync();
            db.SpaceReadStates.Add(new DataBase.Models.MessagesModels.SpaceReadState
            {
                UserId = ArcaneLinkApiFactory.MemberUserId,
                SpaceId = ArcaneLinkApiFactory.TextSpaceId,
                LastReadMessageId = null,
                LastReadMessageCreatedAt = createdAt,
                ReadAt = createdAt,
                UpdatedAt = createdAt
            });
            await db.SaveChangesAsync();
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        var restored = await MarkServerReadAsync(client, message.Id);

        Assert.True(restored.Advanced);
        Assert.Equal(message.Id, restored.LastReadMessageId);
        Assert.Equal(0, restored.UnreadCount);
    }

    [Fact]
    public async Task ServerCounts_UseMembershipFloorAndConcealHiddenOrInvalidTargets()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var oldMessage = await CreateServerMessageAsync(client, "owner", "before membership floor");
        var newMessage = await CreateServerMessageAsync(client, "owner", "after membership floor");
        var floor = DateTime.UtcNow.AddMinutes(5);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.SpaceMessages
                .Where(x => x.Id == oldMessage.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.CreatedAt, floor.AddSeconds(-1))
                    .SetProperty(x => x.UpdatedAt, floor.AddSeconds(-1)));
            await db.SpaceMessages
                .Where(x => x.Id == newMessage.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.CreatedAt, floor.AddSeconds(1))
                    .SetProperty(x => x.UpdatedAt, floor.AddSeconds(1)));
            await db.ServerMembers
                .Where(x => x.Id == ArcaneLinkApiFactory.MemberMemberId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.JoinedAt, floor));
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        Assert.Equal(
            1,
            Assert.Single((await client.GetFromJsonAsync<List<SpaceResponse>>(
                SpacesPath()))!).UnreadCount);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using var outsiderResponse = await client.PutAsJsonAsync(
            ReadStatePath(),
            new MarkSpaceReadRequest { ThroughMessageId = newMessage.Id });
        Assert.Equal(HttpStatusCode.NotFound, outsiderResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var createSpaceResponse = await client.PostAsJsonAsync(
            SpacesPath(),
            new CreateSpaceRequest { TypeCode = "text_room", Title = "other" });
        createSpaceResponse.EnsureSuccessStatusCode();
        var otherSpace = (await createSpaceResponse.Content
            .ReadFromJsonAsync<SpaceResponse>())!;

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var wrongScopeResponse = await client.PutAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{otherSpace.Id}/messages/read-state",
            new MarkSpaceReadRequest { ThroughMessageId = newMessage.Id });
        Assert.Equal(HttpStatusCode.NotFound, wrongScopeResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var denyResponse = await client.PutAsJsonAsync(
            $"{SpacesPath()}/{ArcaneLinkApiFactory.TextSpaceId}/permission-overrides",
            new UpsertSpacePermissionOverrideRequest
            {
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                PermissionId = SpacePermissionIds.ViewSpace,
                Deny = true
            });
        denyResponse.EnsureSuccessStatusCode();

        client.AuthorizeWith(await client.LoginAsync("member"));
        Assert.DoesNotContain(
            (await client.GetFromJsonAsync<List<SpaceResponse>>(SpacesPath()))!,
            space => space.Id == ArcaneLinkApiFactory.TextSpaceId);
        Assert.Equal(
            0,
            Assert.Single((await client.GetFromJsonAsync<List<ServerMemberResponse>>(
                "/api/servers/me"))!).UnreadCount);
        using var hiddenResponse = await client.PutAsJsonAsync(
            ReadStatePath(),
            new MarkSpaceReadRequest { ThroughMessageId = newMessage.Id });
        Assert.Equal(HttpStatusCode.NotFound, hiddenResponse.StatusCode);
    }

    [Fact]
    public async Task DeletedMessage_CannotBecomeAReadTarget()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateServerMessageAsync(client, "owner", "deleted target");

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var deleteResponse = await client.DeleteAsync(
            $"{MessagesPath()}/{message.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("member"));
        Assert.DoesNotContain(
            (await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
                MessagesPath()))!,
            candidate => candidate.Id == message.Id);
        using var markResponse = await client.PutAsJsonAsync(
            ReadStatePath(),
            new MarkSpaceReadRequest { ThroughMessageId = message.Id });
        Assert.Equal(HttpStatusCode.NotFound, markResponse.StatusCode);
    }

    [Fact]
    public async Task PrivateCountsAndMarker_RequireActiveMembershipAndExcludeOwnMessages()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var createSpaceResponse = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                Title = "Unread private room"
            });
        createSpaceResponse.EnsureSuccessStatusCode();
        var space = (await createSpaceResponse.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>())!;
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
        var first = await CreateMessageAsync(client, messagesPath, "private one");
        var second = await CreateMessageAsync(client, messagesPath, "private two");

        client.AuthorizeWith(await client.LoginAsync("member"));
        await CreateMessageAsync(client, messagesPath, "private own message");
        var privateSpaces = await client.GetFromJsonAsync<List<PrivateSpaceResponse>>(
            "/api/private-spaces");
        Assert.Equal(2, Assert.Single(privateSpaces!).UnreadCount);

        using var markResponse = await client.PutAsJsonAsync(
            $"{messagesPath}/read-state",
            new MarkSpaceReadRequest { ThroughMessageId = first.Id });
        markResponse.EnsureSuccessStatusCode();
        var readState = (await markResponse.Content
            .ReadFromJsonAsync<SpaceReadStateResponse>())!;
        Assert.Null(readState.ServerId);
        Assert.Equal(1, readState.UnreadCount);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using var outsiderResponse = await client.PutAsJsonAsync(
            $"{messagesPath}/read-state",
            new MarkSpaceReadRequest { ThroughMessageId = second.Id });
        Assert.Equal(HttpStatusCode.NotFound, outsiderResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var leaveResponse = await client.DeleteAsync(
            $"/api/private-spaces/{space.SpaceId}/members/me");
        Assert.Equal(HttpStatusCode.NoContent, leaveResponse.StatusCode);
        using var inactiveResponse = await client.PutAsJsonAsync(
            $"{messagesPath}/read-state",
            new MarkSpaceReadRequest { ThroughMessageId = second.Id });
        Assert.Equal(HttpStatusCode.NotFound, inactiveResponse.StatusCode);
    }

    [Fact]
    public async Task MarkAllPrivateRead_NotifiesWhenMentionNotificationsBecomeRead()
    {
        var realtime = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(realtime);
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var createSpaceResponse = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                MemberUserIds =
                [
                    ArcaneLinkApiFactory.MemberUserId,
                    ArcaneLinkApiFactory.OutsiderUserId
                ]
            });
        createSpaceResponse.EnsureSuccessStatusCode();
        var space = (await createSpaceResponse.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>())!;

        client.AuthorizeWith(await client.LoginAsync("member"));
        var message = await CreateMessageAsync(
            client,
            $"/api/private-spaces/{space.SpaceId}/messages",
            "mention notification");
        var notificationId = Guid.NewGuid();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.UserNotifications.Add(new UserNotification
            {
                Id = notificationId,
                UserId = ArcaneLinkApiFactory.OwnerUserId,
                ActorUserId = ArcaneLinkApiFactory.MemberUserId,
                SpaceId = space.SpaceId,
                MessageId = message.Id,
                Kind = "mention",
                Title = "Mention",
                Body = "Mention body",
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        realtime.UserEvents.Clear();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var markAllResponse = await client.PutAsync(
            "/api/private-spaces/read-state/all",
            null);
        markAllResponse.EnsureSuccessStatusCode();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.NotNull((await db.UserNotifications
                .SingleAsync(notification => notification.Id == notificationId))
                .ReadAt);
        }
        Assert.Contains(
            realtime.UserEvents,
            item =>
                item.UserId == ArcaneLinkApiFactory.OwnerUserId &&
                item.EventName ==
                RealtimeEventNames.UserNotificationsChanged);
    }

    private static ArcaneLinkApiFactory CreateFactory(
        RecordingRealtimeNotificationService realtime)
    {
        return new ArcaneLinkApiFactory(services =>
        {
            services.RemoveAll<IRealtimeNotificationService>();
            services.AddSingleton<IRealtimeNotificationService>(realtime);
        });
    }

    private static async Task<SpaceMessageResponse> CreateServerMessageAsync(
        HttpClient client,
        string login,
        string body)
    {
        client.AuthorizeWith(await client.LoginAsync(login));
        return await CreateMessageAsync(client, MessagesPath(), body);
    }

    private static async Task<SpaceMessageResponse> CreateMessageAsync(
        HttpClient client,
        string messagesPath,
        string body)
    {
        using var response = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest { Body = body });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
    }

    private static async Task<SpaceReadStateResponse> MarkServerReadAsync(
        HttpClient client,
        Guid messageId)
    {
        using var response = await client.PutAsJsonAsync(
            ReadStatePath(),
            new MarkSpaceReadRequest { ThroughMessageId = messageId });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SpaceReadStateResponse>())!;
    }

    private static string SpacesPath() =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces";

    private static string MessagesPath() =>
        $"{SpacesPath()}/{ArcaneLinkApiFactory.TextSpaceId}/messages";

    private static string ReadStatePath() => $"{MessagesPath()}/read-state";

    private sealed class RecordingRealtimeNotificationService
        : IRealtimeNotificationService
    {
        public ConcurrentQueue<UserEvent> UserEvents { get; } = new();
        public ConcurrentQueue<ServerEvent> ServerEvents { get; } = new();

        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            this.UserEvents.Enqueue(new UserEvent(userId, eventName, payload));
            return Task.CompletedTask;
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            foreach (var userId in userIds.Distinct())
            {
                this.UserEvents.Enqueue(new UserEvent(userId, eventName, payload));
            }

            return Task.CompletedTask;
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            this.ServerEvents.Enqueue(new ServerEvent(serverId, eventName, payload));
            return Task.CompletedTask;
        }
    }

    private sealed record UserEvent(Guid UserId, string EventName, object? Payload);
    private sealed record ServerEvent(Guid ServerId, string EventName, object? Payload);
}
