using System.Collections.Concurrent;
using System.Net.Http.Json;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ArcaneLink.Tests.Realtime;

public sealed class UserPresenceCoordinatorTests
{
    private static readonly DateTimeOffset Start = new(
        2026,
        7,
        21,
        12,
        0,
        0,
        TimeSpan.Zero);

    [Fact]
    public async Task AutomaticMultiTab_AnnouncesOnlyFirstAndLastConnection()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "connection-1");
        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "connection-2");

        var online = Assert.Single(notifications.PresenceDeliveries);
        AssertPresence(
            online,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Online,
            Start.UtcDateTime,
            Start.UtcDateTime,
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.MemberUserId);
        Assert.Equal(
            Start.UtcDateTime,
            await GetLastSeenAtAsync(factory, ArcaneLinkApiFactory.OwnerUserId));

        await DisconnectAsync(registry, coordinator, "connection-1");
        Assert.Single(notifications.PresenceDeliveries);

        await DisconnectAsync(registry, coordinator, "connection-2");
        timeProvider.Advance(TimeSpan.FromSeconds(19));
        Assert.Single(notifications.PresenceDeliveries);

        timeProvider.Advance(TimeSpan.FromSeconds(1));
        await notifications.WaitForPresenceCountAsync(2);

        var offline = notifications.PresenceDeliveries[1];
        AssertPresence(
            offline,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Offline,
            Start.AddSeconds(20).UtcDateTime,
            Start.AddSeconds(20).UtcDateTime,
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.MemberUserId);
        Assert.Equal(
            Start.AddSeconds(20).UtcDateTime,
            await GetLastSeenAtAsync(factory, ArcaneLinkApiFactory.OwnerUserId));
    }

    [Fact]
    public async Task ReconnectWithinGrace_CancelsOfflineWithoutDuplicateOnline()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "connection-1");
        await DisconnectAsync(registry, coordinator, "connection-1");
        timeProvider.Advance(TimeSpan.FromSeconds(10));

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "connection-2");
        timeProvider.Advance(TimeSpan.FromSeconds(20));
        await Task.Yield();

        Assert.Single(notifications.PresenceDeliveries);
        Assert.Equal(
            Start.UtcDateTime,
            await GetLastSeenAtAsync(factory, ArcaneLinkApiFactory.OwnerUserId));

        await DisconnectAsync(registry, coordinator, "connection-2");
        timeProvider.Advance(TimeSpan.FromSeconds(20));
        await notifications.WaitForPresenceCountAsync(2);

        Assert.Equal(
            PresenceStatusCodes.Offline,
            notifications.PresenceDeliveries[1].Payload.PresenceStatus);
        Assert.Equal(
            Start.AddSeconds(50).UtcDateTime,
            await GetLastSeenAtAsync(factory, ArcaneLinkApiFactory.OwnerUserId));
    }

    [Fact]
    public async Task InvisibleConnections_DoNotWriteLastSeenOrBroadcastTiming()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var previousLastSeenAt = Start.AddDays(-2).UtcDateTime;
        await SetPresenceAsync(
            factory,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceVisibilityCodes.Everyone,
            showLastSeen: true,
            PresenceModeCodes.Invisible,
            previousLastSeenAt);
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "invisible-connection");
        await DisconnectAsync(registry, coordinator, "invisible-connection");
        timeProvider.Advance(TimeSpan.FromMinutes(1));
        await Task.Yield();

        Assert.Empty(notifications.PresenceDeliveries);
        Assert.Equal(
            previousLastSeenAt,
            await GetLastSeenAtAsync(factory, ArcaneLinkApiFactory.OwnerUserId));
    }

    [Fact]
    public async Task SettingsTransitions_CleanupOldAudienceAndRemainMonotonic()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();
        var everyoneAutomatic = new UserPresenceConfiguration(
            PresenceVisibilityCodes.Everyone,
            ShowLastSeen: true,
            PresenceModeCodes.Automatic);

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "settings-connection");

        var nobodyAutomatic = new UserPresenceConfiguration(
            PresenceVisibilityCodes.Nobody,
            ShowLastSeen: false,
            PresenceModeCodes.Automatic);
        await SetPresenceAsync(
            factory,
            ArcaneLinkApiFactory.OwnerUserId,
            nobodyAutomatic.Visibility,
            nobodyAutomatic.ShowLastSeen,
            nobodyAutomatic.Mode);
        await coordinator.SettingsChangedAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            everyoneAutomatic,
            nobodyAutomatic);

        Assert.Equal(3, notifications.PresenceDeliveries.Count);
        var cleanup = notifications.PresenceDeliveries[1];
        AssertPresence(
            cleanup,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Offline,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(1),
            ArcaneLinkApiFactory.MemberUserId);
        var hiddenLastSeen = notifications.PresenceDeliveries[2];
        AssertPresence(
            hiddenLastSeen,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Online,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(1),
            ArcaneLinkApiFactory.OwnerUserId);
        Assert.Equal(
            Start.UtcDateTime,
            await GetLastSeenAtAsync(factory, ArcaneLinkApiFactory.OwnerUserId));

        timeProvider.SetUtcNow(Start.AddMinutes(-1));
        var nobodyInvisible = nobodyAutomatic with
        {
            Mode = PresenceModeCodes.Invisible
        };
        await SetPresenceAsync(
            factory,
            ArcaneLinkApiFactory.OwnerUserId,
            nobodyInvisible.Visibility,
            nobodyInvisible.ShowLastSeen,
            nobodyInvisible.Mode);
        await coordinator.SettingsChangedAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            nobodyAutomatic,
            nobodyInvisible);

        var invisible = notifications.PresenceDeliveries[3];
        AssertPresence(
            invisible,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Offline,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(2),
            ArcaneLinkApiFactory.OwnerUserId);
        Assert.Equal(
            Start.UtcDateTime.AddTicks(2),
            await GetLastSeenAtAsync(factory, ArcaneLinkApiFactory.OwnerUserId));

        await SetPresenceAsync(
            factory,
            ArcaneLinkApiFactory.OwnerUserId,
            nobodyAutomatic.Visibility,
            nobodyAutomatic.ShowLastSeen,
            nobodyAutomatic.Mode);
        await coordinator.SettingsChangedAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            nobodyInvisible,
            nobodyAutomatic);

        var visibleAgain = notifications.PresenceDeliveries[4];
        AssertPresence(
            visibleAgain,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Online,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(3),
            ArcaneLinkApiFactory.OwnerUserId);
        Assert.Equal(
            Start.UtcDateTime.AddTicks(3),
            await GetLastSeenAtAsync(factory, ArcaneLinkApiFactory.OwnerUserId));
    }

    [Fact]
    public async Task StaleSettingsCallback_UsesAuthoritativeConfiguration_AndCannotExpandAudience()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "stale-settings-connection");

        var authoritativeNobody = new UserPresenceConfiguration(
            PresenceVisibilityCodes.Nobody,
            ShowLastSeen: false,
            PresenceModeCodes.Automatic);
        var staleEveryone = new UserPresenceConfiguration(
            PresenceVisibilityCodes.Everyone,
            ShowLastSeen: true,
            PresenceModeCodes.Automatic);
        await SetPresenceAsync(
            factory,
            ArcaneLinkApiFactory.OwnerUserId,
            authoritativeNobody.Visibility,
            authoritativeNobody.ShowLastSeen,
            authoritativeNobody.Mode);

        await coordinator.SettingsChangedAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            authoritativeNobody,
            staleEveryone);

        Assert.Equal(3, notifications.PresenceDeliveries.Count);
        AssertPresence(
            notifications.PresenceDeliveries[1],
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Offline,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(1),
            ArcaneLinkApiFactory.MemberUserId);
        AssertPresence(
            notifications.PresenceDeliveries[2],
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Online,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(1),
            ArcaneLinkApiFactory.OwnerUserId);

        await coordinator.SettingsChangedAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            staleEveryone,
            staleEveryone);

        Assert.Equal(3, notifications.PresenceDeliveries.Count);
        Assert.DoesNotContain(
            notifications.PresenceDeliveries.Skip(1),
            delivery =>
                delivery.Payload.PresenceStatus == PresenceStatusCodes.Online &&
                delivery.RecipientUserIds.Contains(ArcaneLinkApiFactory.MemberUserId));
    }

    [Fact]
    public async Task RestrictiveCommit_WaitsForInFlightPublish_ThenCleansExpandedAudience()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new BlockingPresenceRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();
        var nobody = new UserPresenceConfiguration(
            PresenceVisibilityCodes.Nobody,
            ShowLastSeen: false,
            PresenceModeCodes.Automatic);
        var everyone = new UserPresenceConfiguration(
            PresenceVisibilityCodes.Everyone,
            ShowLastSeen: true,
            PresenceModeCodes.Automatic);
        await SetPresenceAsync(
            factory,
            ArcaneLinkApiFactory.OwnerUserId,
            nobody.Visibility,
            nobody.ShowLastSeen,
            nobody.Mode);
        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "commit-ordering-connection");

        await SetPresenceAsync(
            factory,
            ArcaneLinkApiFactory.OwnerUserId,
            everyone.Visibility,
            everyone.ShowLastSeen,
            everyone.Mode);
        notifications.BlockNextPresenceDelivery();
        var expandingPublish = coordinator.SettingsChangedAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            nobody,
            everyone);
        await notifications.WaitUntilPresenceDeliveryBlockedAsync();

        var restrictiveCommit = coordinator.ExecuteMutationAsync(
            [ArcaneLinkApiFactory.OwnerUserId],
            _ => SetPresenceAsync(
                factory,
                ArcaneLinkApiFactory.OwnerUserId,
                nobody.Visibility,
                nobody.ShowLastSeen,
                nobody.Mode));
        var completedBeforePublish = await Task.WhenAny(
            restrictiveCommit,
            Task.Delay(TimeSpan.FromMilliseconds(100)));
        Assert.NotSame(restrictiveCommit, completedBeforePublish);

        notifications.ReleaseBlockedPresenceDelivery();
        await expandingPublish;
        await restrictiveCommit;
        await coordinator.SettingsChangedAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            everyone,
            nobody);

        Assert.Equal(4, notifications.PresenceDeliveries.Count);
        AssertPresence(
            notifications.PresenceDeliveries[2],
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Offline,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(2),
            ArcaneLinkApiFactory.MemberUserId);
        AssertPresence(
            notifications.PresenceDeliveries[3],
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Online,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(2),
            ArcaneLinkApiFactory.OwnerUserId);
    }

    [Fact]
    public async Task PresencePublish_FailFirst_RetriesOnceAndDelivers()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new FailFirstPresenceRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "fail-first-connection");

        Assert.Equal(2, notifications.PresenceAttempts);
        var delivery = Assert.Single(notifications.PresenceDeliveries);
        AssertPresence(
            delivery,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Online,
            Start.UtcDateTime,
            Start.UtcDateTime,
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.MemberUserId);
    }

    [Fact]
    public async Task AudienceResolutionFailure_IsRetriedInBackground()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        var failure = new FailOnceCounter();
        using var factory = CreateFactory(
            timeProvider,
            notifications,
            services =>
            {
                services.RemoveAll<IUserPresenceAudienceService>();
                services.AddScoped<IUserPresenceAudienceService>(provider =>
                    new FailOncePresenceAudienceService(
                        new UserPresenceAudienceService(
                            provider.GetRequiredService<AppDbContext>()),
                        failure));
            });
        _ = factory.CreateClient();
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "audience-resolution-retry-connection");
        Assert.Empty(notifications.PresenceDeliveries);

        timeProvider.Advance(TimeSpan.FromMilliseconds(100));
        await notifications.WaitForPresenceCountAsync(1);

        Assert.Equal(1, failure.Failures);
        AssertPresence(
            notifications.PresenceDeliveries[0],
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Online,
            Start.AddMilliseconds(100).UtcDateTime,
            Start.AddMilliseconds(100).UtcDateTime,
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.MemberUserId);
    }

    [Fact]
    public async Task PrivacyCleanup_FailsTwice_BackgroundRetryKeepsAndCleansRecipient()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new FailNextPresenceRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        await AddFriendshipAsync(
            factory,
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.OutsiderUserId);
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "cleanup-background-retry-connection");
        notifications.FailNextPresenceAttempts(2);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var friends = scope.ServiceProvider.GetRequiredService<IFriendService>();
            Assert.True(await friends.RemoveFriendAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                ArcaneLinkApiFactory.OutsiderUserId));
        }

        Assert.Single(notifications.PresenceDeliveries);
        Assert.Equal(2, notifications.FailedPresenceAttempts);

        timeProvider.Advance(TimeSpan.FromMilliseconds(100));
        await notifications.WaitForPresenceCountAsync(2);

        AssertPresence(
            notifications.PresenceDeliveries[1],
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Offline,
            lastSeenAt: null,
            changedAt: Start.AddMilliseconds(100).UtcDateTime,
            ArcaneLinkApiFactory.OutsiderUserId);
    }

    [Fact]
    public async Task RemoveFriend_RefreshesStoredAudience_AndCleansRemovedRecipient()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        await AddFriendshipAsync(
            factory,
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.OutsiderUserId);
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "unfriend-connection");
        Assert.Contains(
            ArcaneLinkApiFactory.OutsiderUserId,
            notifications.PresenceDeliveries[0].RecipientUserIds);

        await using var scope = factory.Services.CreateAsyncScope();
        var friends = scope.ServiceProvider.GetRequiredService<IFriendService>();
        Assert.True(await friends.RemoveFriendAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.OutsiderUserId));

        var cleanup = Assert.Single(notifications.PresenceDeliveries.Skip(1));
        AssertPresence(
            cleanup,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Offline,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(1),
            ArcaneLinkApiFactory.OutsiderUserId);
    }

    [Fact]
    public async Task LeaveServer_RefreshesStoredAudience_AndCleansFormerCoMember()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "server-leave-audience-connection");

        await using var scope = factory.Services.CreateAsyncScope();
        var members = scope.ServiceProvider.GetRequiredService<IServerMemberService>();
        Assert.True(await members.LeaveServerAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId));

        var cleanup = Assert.Single(notifications.PresenceDeliveries.Skip(1));
        AssertPresence(
            cleanup,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Offline,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(1),
            ArcaneLinkApiFactory.MemberUserId);
    }

    [Fact]
    public async Task DeleteServer_RefreshesStoredAudience_AndCleansFormerCoMember()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "server-delete-audience-connection");

        await using var scope = factory.Services.CreateAsyncScope();
        var servers = scope.ServiceProvider.GetRequiredService<IServerCommandService>();
        Assert.True(await servers.DeleteServerAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId));

        var cleanup = Assert.Single(notifications.PresenceDeliveries.Skip(1));
        AssertPresence(
            cleanup,
            ArcaneLinkApiFactory.OwnerUserId,
            PresenceStatusCodes.Offline,
            lastSeenAt: null,
            changedAt: Start.UtcDateTime.AddTicks(1),
            ArcaneLinkApiFactory.MemberUserId);
    }

    [Fact]
    public async Task TopologyMutation_ConcurrentJoinResolvesRosterAfterPriorCommit()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();
        var topologyKey = UserPresenceTopologyKey.Server(Guid.NewGuid());
        var ownerUserId = Guid.NewGuid();
        var firstJoinerUserId = Guid.NewGuid();
        var secondJoinerUserId = Guid.NewGuid();
        var rosterLock = new object();
        var activeUserIds = new HashSet<Guid> { ownerUserId };
        var firstMutationEntered = new TaskCompletionSource(
            TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseFirstMutation = new TaskCompletionSource(
            TaskCreationOptions.RunContinuationsAsynchronously);

        IReadOnlyCollection<Guid> SnapshotRoster()
        {
            lock (rosterLock)
            {
                return activeUserIds.ToArray();
            }
        }

        var firstJoin = coordinator.ExecuteTopologyMutationAsync(
            topologyKey,
            [firstJoinerUserId],
            _ => Task.FromResult(SnapshotRoster()),
            async token =>
            {
                firstMutationEntered.TrySetResult();
                await releaseFirstMutation.Task.WaitAsync(token);
                lock (rosterLock)
                {
                    activeUserIds.Add(firstJoinerUserId);
                }
            });
        await firstMutationEntered.Task.WaitAsync(TimeSpan.FromSeconds(2));

        IReadOnlyCollection<Guid>? secondJoinBefore = null;
        var secondResolveCount = 0;
        var secondJoin = coordinator.ExecuteTopologyMutationAsync(
            topologyKey,
            [secondJoinerUserId],
            _ =>
            {
                var snapshot = SnapshotRoster();
                if (Interlocked.Increment(ref secondResolveCount) == 1)
                {
                    secondJoinBefore = snapshot;
                }

                return Task.FromResult(snapshot);
            },
            _ =>
            {
                lock (rosterLock)
                {
                    activeUserIds.Add(secondJoinerUserId);
                }

                return Task.CompletedTask;
            });

        Assert.Null(secondJoinBefore);
        Assert.False(secondJoin.IsCompleted);
        releaseFirstMutation.TrySetResult();

        await firstJoin.WaitAsync(TimeSpan.FromSeconds(2));
        var secondSubjects = await secondJoin.WaitAsync(TimeSpan.FromSeconds(2));

        Assert.NotNull(secondJoinBefore);
        Assert.Contains(firstJoinerUserId, secondJoinBefore);
        Assert.Contains(ownerUserId, secondSubjects);
        Assert.Contains(firstJoinerUserId, secondSubjects);
        Assert.Contains(secondJoinerUserId, secondSubjects);
    }

    [Fact]
    public async Task TopologyMutation_DeleteRacingJoinIncludesNewcomerInCleanupUnion()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();
        var topologyKey = UserPresenceTopologyKey.Server(Guid.NewGuid());
        var ownerUserId = Guid.NewGuid();
        var joiningUserId = Guid.NewGuid();
        var rosterLock = new object();
        var activeUserIds = new HashSet<Guid> { ownerUserId };
        var joinMutationEntered = new TaskCompletionSource(
            TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseJoinMutation = new TaskCompletionSource(
            TaskCreationOptions.RunContinuationsAsynchronously);

        IReadOnlyCollection<Guid> SnapshotRoster()
        {
            lock (rosterLock)
            {
                return activeUserIds.ToArray();
            }
        }

        var join = coordinator.ExecuteTopologyMutationAsync(
            topologyKey,
            [joiningUserId],
            _ => Task.FromResult(SnapshotRoster()),
            async token =>
            {
                joinMutationEntered.TrySetResult();
                await releaseJoinMutation.Task.WaitAsync(token);
                lock (rosterLock)
                {
                    activeUserIds.Add(joiningUserId);
                }
            });
        await joinMutationEntered.Task.WaitAsync(TimeSpan.FromSeconds(2));

        IReadOnlyCollection<Guid>? deleteBefore = null;
        var deleteResolveCount = 0;
        var delete = coordinator.ExecuteTopologyMutationAsync(
            topologyKey,
            [ownerUserId],
            _ =>
            {
                var snapshot = SnapshotRoster();
                if (Interlocked.Increment(ref deleteResolveCount) == 1)
                {
                    deleteBefore = snapshot;
                }

                return Task.FromResult(snapshot);
            },
            _ =>
            {
                lock (rosterLock)
                {
                    activeUserIds.Clear();
                }

                return Task.CompletedTask;
            });

        Assert.Null(deleteBefore);
        Assert.False(delete.IsCompleted);
        releaseJoinMutation.TrySetResult();

        await join.WaitAsync(TimeSpan.FromSeconds(2));
        var cleanupSubjects = await delete.WaitAsync(TimeSpan.FromSeconds(2));

        Assert.NotNull(deleteBefore);
        Assert.Contains(joiningUserId, deleteBefore);
        Assert.Contains(ownerUserId, cleanupSubjects);
        Assert.Contains(joiningUserId, cleanupSubjects);
        Assert.Empty(SnapshotRoster());
    }

    [Fact]
    public async Task MovedConnection_SchedulesPreviousUserOffline()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new RecordingRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        _ = factory.CreateClient();
        var registry = factory.Services.GetRequiredService<RealtimeConnectionRegistry>();
        var coordinator = factory.Services.GetRequiredService<IUserPresenceCoordinator>();

        await ConnectAsync(
            registry,
            coordinator,
            ArcaneLinkApiFactory.OwnerUserId,
            "moved-connection");
        var movedRegistration = registry.Register(
            ArcaneLinkApiFactory.MemberUserId,
            "moved-connection");
        Assert.True(movedRegistration.PreviousUserLostLastConnection);

        await coordinator.ConnectionRegisteredAsync(movedRegistration);
        Assert.Equal(2, notifications.PresenceDeliveries.Count);

        timeProvider.Advance(TimeSpan.FromSeconds(20));
        await notifications.WaitForPresenceCountAsync(3);

        Assert.Equal(
            ArcaneLinkApiFactory.MemberUserId,
            notifications.PresenceDeliveries[1].Payload.UserId);
        Assert.Equal(
            PresenceStatusCodes.Online,
            notifications.PresenceDeliveries[1].Payload.PresenceStatus);
        Assert.Equal(
            ArcaneLinkApiFactory.OwnerUserId,
            notifications.PresenceDeliveries[2].Payload.UserId);
        Assert.Equal(
            PresenceStatusCodes.Offline,
            notifications.PresenceDeliveries[2].Payload.PresenceStatus);
    }

    [Fact]
    public async Task PresenceRealtimeFailure_DoesNotFailCommittedSettingsRequest()
    {
        var timeProvider = new ManualTimeProvider(Start);
        var notifications = new ThrowingPresenceRealtimeNotificationService();
        using var factory = CreateFactory(timeProvider, notifications);
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var response = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                PresenceVisibility = PresenceVisibilityCodes.Friends
            });

        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(
            PresenceVisibilityCodes.Friends,
            await db.UserProfileSettings
                .Where(settings =>
                    settings.UserId == ArcaneLinkApiFactory.OwnerUserId)
                .Select(settings => settings.PresenceVisibility)
                .SingleAsync());
    }

    [Fact]
    public async Task Login_DoesNotUpdateLastSeen()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var previousLastSeenAt = Start.AddDays(-1).UtcDateTime;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(
                item => item.Id == ArcaneLinkApiFactory.MemberUserId);
            user.LastSeenAt = previousLastSeenAt;
            await db.SaveChangesAsync();
        }

        _ = await client.LoginAsync("member");

        Assert.Equal(
            previousLastSeenAt,
            await GetLastSeenAtAsync(factory, ArcaneLinkApiFactory.MemberUserId));
    }

    private static ArcaneLinkApiFactory CreateFactory(
        TimeProvider timeProvider,
        IRealtimeNotificationService realtime,
        Action<IServiceCollection>? configureServices = null)
    {
        return new ArcaneLinkApiFactory(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.RemoveAll<IRealtimeNotificationService>();
            services.AddSingleton(timeProvider);
            services.AddSingleton(realtime);
            services.Configure<RealtimePresenceOptions>(options =>
                options.DisconnectGraceSeconds = 20);
            configureServices?.Invoke(services);
        });
    }

    private static async Task ConnectAsync(
        RealtimeConnectionRegistry registry,
        IUserPresenceCoordinator coordinator,
        Guid userId,
        string connectionId)
    {
        var registration = registry.Register(userId, connectionId);
        await coordinator.ConnectionRegisteredAsync(registration);
    }

    private static async Task DisconnectAsync(
        RealtimeConnectionRegistry registry,
        IUserPresenceCoordinator coordinator,
        string connectionId)
    {
        var unregistration = registry.Unregister(connectionId);
        Assert.True(unregistration.HasValue);
        await coordinator.ConnectionUnregisteredAsync(unregistration.Value);
    }

    private static async Task<DateTime?> GetLastSeenAtAsync(
        ArcaneLinkApiFactory factory,
        Guid userId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Users
            .Where(user => user.Id == userId)
            .Select(user => user.LastSeenAt)
            .SingleAsync();
    }

    private static async Task SetPresenceAsync(
        ArcaneLinkApiFactory factory,
        Guid userId,
        string visibility,
        bool showLastSeen,
        string mode,
        DateTime? lastSeenAt = null)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(item => item.Id == userId);
        var settings = await db.UserProfileSettings.SingleAsync(
            item => item.UserId == userId);
        settings.PresenceVisibility = visibility;
        settings.ShowLastSeen = showLastSeen;
        settings.PresenceMode = mode;
        if (lastSeenAt.HasValue)
        {
            user.LastSeenAt = lastSeenAt;
        }

        await db.SaveChangesAsync();
    }

    private static async Task AddFriendshipAsync(
        ArcaneLinkApiFactory factory,
        Guid firstUserId,
        Guid secondUserId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var requestId = Guid.NewGuid();
        db.FriendRequests.Add(new FriendRequest
        {
            Id = requestId,
            FromUserId = firstUserId,
            ToUserId = secondUserId,
            StatusId = FriendRequestStatusIds.Accepted,
            CreatedAt = now,
            UpdatedAt = now,
            RespondedAt = now
        });
        db.UserFriends.AddRange(
            new UserFriend
            {
                UserId = firstUserId,
                FriendUserId = secondUserId,
                CreatedByRequestId = requestId,
                CreatedAt = now
            },
            new UserFriend
            {
                UserId = secondUserId,
                FriendUserId = firstUserId,
                CreatedByRequestId = requestId,
                CreatedAt = now
            });
        await db.SaveChangesAsync();
    }

    private static void AssertPresence(
        PresenceDelivery delivery,
        Guid userId,
        string status,
        DateTime? lastSeenAt,
        DateTime changedAt,
        params Guid[] recipients)
    {
        Assert.Equal(
            recipients.Order(),
            delivery.RecipientUserIds.Order());
        Assert.Equal(userId, delivery.Payload.UserId);
        Assert.Equal(status, delivery.Payload.PresenceStatus);
        Assert.Equal(lastSeenAt, delivery.Payload.LastSeenAt);
        Assert.Equal(changedAt, delivery.Payload.ChangedAt);
    }

    private sealed record PresenceDelivery(
        IReadOnlyList<Guid> RecipientUserIds,
        UserPresenceChanged Payload);

    private sealed class RecordingRealtimeNotificationService
        : IRealtimeNotificationService
    {
        private readonly ConcurrentQueue<PresenceDelivery> _presenceDeliveries = [];
        private readonly SemaphoreSlim _deliverySignal = new(0);

        public IReadOnlyList<PresenceDelivery> PresenceDeliveries =>
            this._presenceDeliveries.ToArray();

        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return this.RecordAsync([userId], eventName, payload);
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return this.RecordAsync(userIds.ToArray(), eventName, payload);
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public async Task WaitForPresenceCountAsync(int expectedCount)
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            while (this._presenceDeliveries.Count < expectedCount)
            {
                await this._deliverySignal.WaitAsync(timeout.Token);
            }
        }

        private Task RecordAsync(
            IReadOnlyList<Guid> userIds,
            string eventName,
            object? payload)
        {
            if (eventName == RealtimeEventNames.UserPresenceChanged &&
                payload is UserPresenceChanged presence)
            {
                this._presenceDeliveries.Enqueue(new PresenceDelivery(userIds, presence));
                this._deliverySignal.Release();
            }

            return Task.CompletedTask;
        }
    }

    private sealed class ThrowingPresenceRealtimeNotificationService
        : IRealtimeNotificationService
    {
        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return ShouldFail(eventName);
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return ShouldFail(eventName);
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        private static Task ShouldFail(string eventName)
        {
            return eventName is
                RealtimeEventNames.UserProfileSettingsChanged or
                RealtimeEventNames.UserPresenceChanged
                    ? Task.FromException(
                        new InvalidOperationException("Injected realtime failure."))
                    : Task.CompletedTask;
        }
    }

    private sealed class FailFirstPresenceRealtimeNotificationService
        : IRealtimeNotificationService
    {
        private readonly ConcurrentQueue<PresenceDelivery> _presenceDeliveries = [];
        private int _presenceAttempts;

        public int PresenceAttempts => Volatile.Read(ref this._presenceAttempts);
        public IReadOnlyList<PresenceDelivery> PresenceDeliveries =>
            this._presenceDeliveries.ToArray();

        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return this.NotifyUsersAsync(
                [userId],
                eventName,
                payload,
                cancellationToken);
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            if (eventName != RealtimeEventNames.UserPresenceChanged ||
                payload is not UserPresenceChanged presence)
            {
                return Task.CompletedTask;
            }

            if (Interlocked.Increment(ref this._presenceAttempts) == 1)
            {
                return Task.FromException(
                    new InvalidOperationException("Injected first-attempt failure."));
            }

            this._presenceDeliveries.Enqueue(
                new PresenceDelivery(userIds.ToArray(), presence));
            return Task.CompletedTask;
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }

    private sealed class FailNextPresenceRealtimeNotificationService
        : IRealtimeNotificationService
    {
        private readonly ConcurrentQueue<PresenceDelivery> _presenceDeliveries = [];
        private readonly SemaphoreSlim _deliverySignal = new(0);
        private int _remainingFailures;
        private int _failedPresenceAttempts;

        public IReadOnlyList<PresenceDelivery> PresenceDeliveries =>
            this._presenceDeliveries.ToArray();
        public int FailedPresenceAttempts =>
            Volatile.Read(ref this._failedPresenceAttempts);

        public void FailNextPresenceAttempts(int count)
        {
            Volatile.Write(ref this._remainingFailures, count);
        }

        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return this.NotifyUsersAsync(
                [userId],
                eventName,
                payload,
                cancellationToken);
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            if (eventName != RealtimeEventNames.UserPresenceChanged ||
                payload is not UserPresenceChanged presence)
            {
                return Task.CompletedTask;
            }

            if (Interlocked.Decrement(ref this._remainingFailures) >= 0)
            {
                Interlocked.Increment(ref this._failedPresenceAttempts);
                return Task.FromException(
                    new InvalidOperationException("Injected presence failure."));
            }

            this._presenceDeliveries.Enqueue(
                new PresenceDelivery(userIds.ToArray(), presence));
            this._deliverySignal.Release();
            return Task.CompletedTask;
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public async Task WaitForPresenceCountAsync(int expectedCount)
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            while (this._presenceDeliveries.Count < expectedCount)
            {
                await this._deliverySignal.WaitAsync(timeout.Token);
            }
        }
    }

    private sealed class BlockingPresenceRealtimeNotificationService
        : IRealtimeNotificationService
    {
        private readonly ConcurrentQueue<PresenceDelivery> _presenceDeliveries = [];
        private TaskCompletionSource? _blockedSignal;
        private TaskCompletionSource? _releaseSignal;
        private int _shouldBlock;

        public IReadOnlyList<PresenceDelivery> PresenceDeliveries =>
            this._presenceDeliveries.ToArray();

        public void BlockNextPresenceDelivery()
        {
            this._blockedSignal = new TaskCompletionSource(
                TaskCreationOptions.RunContinuationsAsynchronously);
            this._releaseSignal = new TaskCompletionSource(
                TaskCreationOptions.RunContinuationsAsynchronously);
            Volatile.Write(ref this._shouldBlock, 1);
        }

        public async Task WaitUntilPresenceDeliveryBlockedAsync()
        {
            var signal = this._blockedSignal ?? throw new InvalidOperationException(
                "No presence delivery was configured to block.");
            await signal.Task.WaitAsync(TimeSpan.FromSeconds(2));
        }

        public void ReleaseBlockedPresenceDelivery()
        {
            (this._releaseSignal ?? throw new InvalidOperationException(
                "No presence delivery is blocked."))
                .TrySetResult();
        }

        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return this.NotifyUsersAsync(
                [userId],
                eventName,
                payload,
                cancellationToken);
        }

        public async Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            if (eventName != RealtimeEventNames.UserPresenceChanged ||
                payload is not UserPresenceChanged presence)
            {
                return;
            }

            if (Interlocked.Exchange(ref this._shouldBlock, 0) == 1)
            {
                this._blockedSignal?.TrySetResult();
                var release = this._releaseSignal ?? throw new InvalidOperationException(
                    "Blocked presence delivery has no release signal.");
                await release.Task.WaitAsync(cancellationToken);
            }

            this._presenceDeliveries.Enqueue(
                new PresenceDelivery(userIds.ToArray(), presence));
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }

    private sealed class FailOnceCounter
    {
        private int _failures;

        public int Failures => Volatile.Read(ref this._failures);

        public bool TryFail()
        {
            return Interlocked.CompareExchange(ref this._failures, 1, 0) == 0;
        }
    }

    private sealed class FailOncePresenceAudienceService(
        IUserPresenceAudienceService inner,
        FailOnceCounter failure) : IUserPresenceAudienceService
    {
        public Task<UserPresenceAudienceSnapshot> ResolveAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            return failure.TryFail()
                ? Task.FromException<UserPresenceAudienceSnapshot>(
                    new InvalidOperationException(
                        "Injected presence audience resolution failure."))
                : inner.ResolveAsync(userId, cancellationToken);
        }
    }
}
