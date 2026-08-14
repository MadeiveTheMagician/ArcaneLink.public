using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Notifications;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Notifications;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ArcaneLink.Tests.Notifications;

public sealed class NotificationIntegrationTests
{
    [Theory]
    [InlineData(2000)]
    [InlineData(2001)]
    [InlineData(4000)]
    public async Task MentionAtMessageLengthBoundary_CreatesSafePreviewAtomically(int messageLength)
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var body = BuildMentionBody(messageLength);
        using var createResponse = await client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = body });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
        var message = await createResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>();

        Assert.NotNull(message);
        Assert.Equal(messageLength, message.Body?.Length);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var notifications = await GetNotificationsAsync(client);
        var mention = Assert.Single(
            notifications,
            notification => notification.MessageId == message.Id);

        Assert.Equal("mention", mention.Kind);
        Assert.NotNull(mention.Detail);
        Assert.Equal(240, mention.Detail.Length);
        Assert.StartsWith("@member ", mention.Detail);
        Assert.EndsWith("…", mention.Detail);

        var messages = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(MessagesPath());
        Assert.Single(messages ?? [], candidate => candidate.Id == message.Id);
    }

    [Fact]
    public async Task AcceptDirectInvite_MarksItsNotificationReadInTheSameOperation()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var invite = await CreateDirectInviteAsync(client);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var beforeAccept = Assert.Single(
            await GetNotificationsAsync(client),
            notification => notification.InviteId == invite.Id);
        Assert.Null(beforeAccept.ReadAt);

        using var acceptResponse = await client.PostAsync(
            $"/api/server-invites/{invite.Id}/accept",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(acceptResponse);

        var afterAccept = Assert.Single(
            await GetNotificationsAsync(client),
            notification => notification.InviteId == invite.Id);
        Assert.NotNull(afterAccept.ReadAt);

        var activeInvites = await client.GetFromJsonAsync<List<ServerInviteResponse>>(
            "/api/server-invites/me");
        Assert.DoesNotContain(activeInvites ?? [], candidate => candidate.Id == invite.Id);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storedInvite = await db.ServerInvites
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == invite.Id);
        var outsiderMember = await db.ServerMembers
            .AsNoTracking()
            .SingleAsync(candidate =>
                candidate.ServerId == ArcaneLinkApiFactory.ServerId &&
                candidate.UserId == ArcaneLinkApiFactory.OutsiderUserId);

        Assert.Equal(1, storedInvite.UsedCount);
        Assert.Equal(ServerMemberStatusIds.Active, outsiderMember.StatusId);
        Assert.Equal(
            1,
            await db.ServerInviteUsages.CountAsync(usage =>
                usage.InviteId == invite.Id &&
                usage.UserId == ArcaneLinkApiFactory.OutsiderUserId));
    }

    [Fact]
    public async Task DeclineDirectInvite_MarksNotificationReadWithoutJoiningServer()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var invite = await CreateDirectInviteAsync(client);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var beforeDecline = Assert.Single(
            await GetNotificationsAsync(client),
            notification => notification.InviteId == invite.Id);
        Assert.Null(beforeDecline.ReadAt);

        using var declineResponse = await client.PostAsync(
            $"/api/server-invites/{invite.Id}/decline",
            null);
        Assert.Equal(HttpStatusCode.NoContent, declineResponse.StatusCode);

        var afterDecline = Assert.Single(
            await GetNotificationsAsync(client),
            notification => notification.InviteId == invite.Id);
        Assert.NotNull(afterDecline.ReadAt);

        var activeInvites = await client.GetFromJsonAsync<List<ServerInviteResponse>>(
            "/api/server-invites/me");
        Assert.DoesNotContain(activeInvites ?? [], candidate => candidate.Id == invite.Id);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storedInvite = await db.ServerInvites
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == invite.Id);

        Assert.NotNull(storedInvite.RevokedAt);
        Assert.Equal(
            ArcaneLinkApiFactory.OutsiderUserId,
            storedInvite.RevokedByUserId);
        Assert.False(await db.ServerMembers.AnyAsync(candidate =>
            candidate.ServerId == ArcaneLinkApiFactory.ServerId &&
            candidate.UserId == ArcaneLinkApiFactory.OutsiderUserId &&
            candidate.StatusId == ServerMemberStatusIds.Active));
    }

    [Fact]
    public async Task RepeatedDirectInvite_ReturnsExistingInviteWithoutDuplicateNotification()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();

        var first = await CreateDirectInviteAsync(client);
        var second = await CreateDirectInviteAsync(client);
        Assert.Equal(first.Id, second.Id);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var inviteNotifications = (await GetNotificationsAsync(client))
            .Where(notification => notification.InviteId == first.Id)
            .ToList();
        Assert.Single(inviteNotifications);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(
            1,
            await db.ServerInvites.CountAsync(candidate =>
                candidate.ServerId == ArcaneLinkApiFactory.ServerId &&
                candidate.CreatedByUserId == ArcaneLinkApiFactory.OwnerUserId &&
                candidate.TargetUserId == ArcaneLinkApiFactory.OutsiderUserId &&
                candidate.RevokedAt == null));
    }

    [Fact]
    public async Task RealtimeFailure_DoesNotTurnCommittedNotificationOperationsIntoHttpErrors()
    {
        using var baseFactory = new ArcaneLinkApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IRealtimeNotificationService>();
                services.AddScoped<IRealtimeNotificationService, ThrowingRealtimeNotificationService>();
            });
        });
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var messageResponse = await client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "@member realtime failure" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(messageResponse);
        var message = await messageResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>();
        Assert.NotNull(message);

        var invite = await CreateDirectInviteAsync(client);
        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using var acceptResponse = await client.PostAsync(
            $"/api/server-invites/{invite.Id}/accept",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(acceptResponse);

        var inviteNotification = Assert.Single(
            await GetNotificationsAsync(client),
            notification => notification.InviteId == invite.Id);
        Assert.NotNull(inviteNotification.ReadAt);

        client.AuthorizeWith(await client.LoginAsync("member"));
        Assert.Single(
            await GetNotificationsAsync(client),
            notification => notification.MessageId == message.Id);
    }

    [Fact]
    public async Task NotificationWriteFailure_DoesNotPartiallyCommitMessageOrDirectInvite()
    {
        using var baseFactory = new ArcaneLinkApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IUserNotificationService>();
                services.AddScoped<IUserNotificationService, ThrowingNotificationWriteService>();
            });
        });
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        const string failedMessageBody = "@member notification write failure";

        using var messageResponse = await client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = failedMessageBody });
        Assert.Equal(HttpStatusCode.InternalServerError, messageResponse.StatusCode);

        using var inviteResponse = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
            new CreateServerInviteRequest
            {
                KindCode = "direct",
                TargetUserId = ArcaneLinkApiFactory.OutsiderUserId
            });
        Assert.Equal(HttpStatusCode.InternalServerError, inviteResponse.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.SpaceMessages
            .AsNoTracking()
            .AnyAsync(message => message.Body == failedMessageBody));
        Assert.False(await db.ServerInvites
            .AsNoTracking()
            .AnyAsync(invite =>
                invite.ServerId == ArcaneLinkApiFactory.ServerId &&
                invite.TargetUserId == ArcaneLinkApiFactory.OutsiderUserId));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task InviteReadStagingFailure_RollsBackAcceptAndDeclineLifecycle(
        bool accept)
    {
        using var baseFactory = new ArcaneLinkApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IUserNotificationService>();
                services.AddScoped<UserNotificationService>();
                services.AddScoped<
                    IUserNotificationService,
                    ThrowingInviteReadNotificationService>();
            });
        });
        using var client = factory.CreateClient();
        var invite = await CreateDirectInviteAsync(client);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var path = accept
            ? $"/api/server-invites/{invite.Id}/accept"
            : $"/api/server-invites/{invite.Id}/decline";
        using var response = await client.PostAsync(path, null);
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        var notification = Assert.Single(
            await GetNotificationsAsync(client),
            candidate => candidate.InviteId == invite.Id);
        Assert.Null(notification.ReadAt);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storedInvite = await db.ServerInvites
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == invite.Id);

        Assert.Equal(0, storedInvite.UsedCount);
        Assert.Null(storedInvite.RevokedAt);
        Assert.Null(storedInvite.RevokedByUserId);
        Assert.False(await db.ServerInviteUsages
            .AsNoTracking()
            .AnyAsync(usage => usage.InviteId == invite.Id));
        Assert.False(await db.ServerMembers
            .AsNoTracking()
            .AnyAsync(member =>
                member.ServerId == ArcaneLinkApiFactory.ServerId &&
                member.UserId == ArcaneLinkApiFactory.OutsiderUserId &&
                member.StatusId == ServerMemberStatusIds.Active));
    }

    private static async Task<ServerInviteResponse> CreateDirectInviteAsync(HttpClient client)
    {
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
            new CreateServerInviteRequest
            {
                KindCode = "direct",
                TargetUserId = ArcaneLinkApiFactory.OutsiderUserId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);

        return (await response.Content.ReadFromJsonAsync<ServerInviteResponse>())!;
    }

    private static async Task<IReadOnlyList<UserNotificationResponse>> GetNotificationsAsync(
        HttpClient client)
    {
        return await client.GetFromJsonAsync<List<UserNotificationResponse>>(
            "/api/notifications") ?? [];
    }

    private static string BuildMentionBody(int messageLength)
    {
        const string mention = "@member ";
        return mention + new string('x', messageLength - mention.Length);
    }

    private static string MessagesPath()
    {
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/messages";
    }

    private sealed class ThrowingRealtimeNotificationService : IRealtimeNotificationService
    {
        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return ShouldFail(eventName)
                ? Task.FromException(new InvalidOperationException(
                    "Injected realtime delivery failure."))
                : Task.CompletedTask;
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return ShouldFail(eventName)
                ? Task.FromException(new InvalidOperationException(
                    "Injected realtime delivery failure."))
                : Task.CompletedTask;
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return ShouldFail(eventName)
                ? Task.FromException(new InvalidOperationException(
                    "Injected realtime delivery failure."))
                : Task.CompletedTask;
        }

        private static bool ShouldFail(string eventName)
        {
            return eventName is
                RealtimeEventNames.UserNotificationsChanged or
                RealtimeEventNames.SpaceMessagesChanged or
                RealtimeEventNames.PrivateMessageReceived or
                RealtimeEventNames.ServerGovernanceChanged or
                RealtimeEventNames.ServerInviteReceived or
                RealtimeEventNames.ServerInviteAccepted or
                RealtimeEventNames.UserServersChanged or
                RealtimeEventNames.ServerMembersChanged;
        }
    }

    private sealed class ThrowingNotificationWriteService : IUserNotificationService
    {
        public Task<IReadOnlyList<UserNotificationResponse>> GetAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<IReadOnlyList<UserNotificationResponse>>([]);
        }

        public Task<bool> MarkReadAsync(
            Guid userId,
            Guid notificationId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(false);
        }

        public Task MarkAllReadAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task<bool> StageInviteReadAsync(
            Guid userId,
            Guid inviteId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(false);
        }

        public Task StageDirectInviteAsync(
            Guid targetUserId,
            Guid actorUserId,
            Guid serverId,
            Guid inviteId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromException(
                new InvalidOperationException("Injected notification write failure."));
        }

        public Task StagePrivateSpaceInviteAsync(
            Guid targetUserId,
            Guid actorUserId,
            Guid spaceId,
            string spaceTitle,
            CancellationToken cancellationToken = default)
        {
            return Task.FromException(
                new InvalidOperationException("Injected notification write failure."));
        }

        public Task<IReadOnlyList<Guid>> StageMentionsAsync(
            Guid actorUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            string body,
            CancellationToken cancellationToken = default)
        {
            return Task.FromException<IReadOnlyList<Guid>>(
                new InvalidOperationException("Injected notification write failure."));
        }

        public Task<IReadOnlyList<Guid>> StageResolvedMentionsAsync(
            Guid actorUserId,
            Guid? serverId,
            Guid spaceId,
            string spaceTitle,
            Guid messageId,
            string? body,
            IReadOnlyCollection<Guid> recipientUserIds,
            CancellationToken cancellationToken = default)
        {
            return Task.FromException<IReadOnlyList<Guid>>(
                new InvalidOperationException("Injected notification write failure."));
        }

        public Task NotifyChangedAsync(
            IReadOnlyCollection<Guid> userIds,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task CreateSystemAsync(
            Guid userId,
            string title,
            string body,
            string? detail = null,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }

    private sealed class ThrowingInviteReadNotificationService
        : IUserNotificationService
    {
        private readonly UserNotificationService _inner;

        public ThrowingInviteReadNotificationService(
            UserNotificationService inner)
        {
            _inner = inner;
        }

        public Task<IReadOnlyList<UserNotificationResponse>> GetAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            return _inner.GetAsync(userId, cancellationToken);
        }

        public Task<bool> MarkReadAsync(
            Guid userId,
            Guid notificationId,
            CancellationToken cancellationToken = default)
        {
            return _inner.MarkReadAsync(userId, notificationId, cancellationToken);
        }

        public Task MarkAllReadAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            return _inner.MarkAllReadAsync(userId, cancellationToken);
        }

        public Task<bool> StageInviteReadAsync(
            Guid userId,
            Guid inviteId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromException<bool>(
                new InvalidOperationException("Injected invite read staging failure."));
        }

        public Task StageDirectInviteAsync(
            Guid targetUserId,
            Guid actorUserId,
            Guid serverId,
            Guid inviteId,
            CancellationToken cancellationToken = default)
        {
            return _inner.StageDirectInviteAsync(
                targetUserId,
                actorUserId,
                serverId,
                inviteId,
                cancellationToken);
        }

        public Task StagePrivateSpaceInviteAsync(
            Guid targetUserId,
            Guid actorUserId,
            Guid spaceId,
            string spaceTitle,
            CancellationToken cancellationToken = default)
        {
            return _inner.StagePrivateSpaceInviteAsync(
                targetUserId,
                actorUserId,
                spaceId,
                spaceTitle,
                cancellationToken);
        }

        public Task<IReadOnlyList<Guid>> StageMentionsAsync(
            Guid actorUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            string body,
            CancellationToken cancellationToken = default)
        {
            return _inner.StageMentionsAsync(
                actorUserId,
                serverId,
                spaceId,
                messageId,
                body,
                cancellationToken);
        }

        public Task<IReadOnlyList<Guid>> StageResolvedMentionsAsync(
            Guid actorUserId,
            Guid? serverId,
            Guid spaceId,
            string spaceTitle,
            Guid messageId,
            string? body,
            IReadOnlyCollection<Guid> recipientUserIds,
            CancellationToken cancellationToken = default)
        {
            return _inner.StageResolvedMentionsAsync(
                actorUserId,
                serverId,
                spaceId,
                spaceTitle,
                messageId,
                body,
                recipientUserIds,
                cancellationToken);
        }

        public Task NotifyChangedAsync(
            IReadOnlyCollection<Guid> userIds,
            CancellationToken cancellationToken = default)
        {
            return _inner.NotifyChangedAsync(userIds, cancellationToken);
        }

        public Task CreateSystemAsync(
            Guid userId,
            string title,
            string body,
            string? detail = null,
            CancellationToken cancellationToken = default)
        {
            return _inner.CreateSystemAsync(
                userId,
                title,
                body,
                detail,
                cancellationToken);
        }
    }
}
