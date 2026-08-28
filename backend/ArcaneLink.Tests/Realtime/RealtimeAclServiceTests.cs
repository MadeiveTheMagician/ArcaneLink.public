using System.Text.Json;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.PrivateSpaces;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace ArcaneLink.Tests.Realtime;

public sealed class RealtimeAclServiceTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly ArcaneLinkApiFactory _factory;

    public RealtimeAclServiceTests(ArcaneLinkApiFactory factory)
    {
        this._factory = factory;
    }

    [Fact]
    public async Task ServerMessageNotification_UsesOnlyActiveViewAuthorizedAudience_AndIsBestEffort()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<
            ArcaneLink.DataBase._Data.AppDbContext>();
        var authorization = new MutableSpaceAuthorizationService
        {
            FilteredUserIds = [ArcaneLinkApiFactory.MemberUserId]
        };
        authorization.SetPermission(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            "VIEW_TEXT_SPACES",
            true);
        authorization.SetPermission(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            "READ_MESSAGE_HISTORY",
            true);
        var audience = new ServerSpaceRealtimeAudienceService(
            db,
            authorization,
            new ServerSpaceRealtimeAudienceCache());
        var realtime = new RecordingRealtimeNotificationService
        {
            ThrowOnUsers = true
        };
        var notifier = new SpaceMessageNotifier(
            realtime,
            audience,
            new SpaceMessageAccessService(db, authorization),
            NullLogger<SpaceMessageNotifier>.Instance);

        await notifier.NotifyMessagesChangedAsync(
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            Guid.NewGuid(),
            CancellationToken.None);

        Assert.Equal(SpaceAction.View, authorization.LastFilterAction);
        Assert.Equal(
            [ArcaneLinkApiFactory.MemberUserId],
            authorization.LastFilterCandidates);
        Assert.DoesNotContain(ArcaneLinkApiFactory.OutsiderUserId, authorization.LastFilterCandidates);

        realtime.ThrowOnUsers = false;
        await notifier.NotifyMessagesChangedAsync(
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            Guid.NewGuid(),
            CancellationToken.None);

        var delivery = Assert.Single(realtime.UserBatchNotifications);
        Assert.Equal([ArcaneLinkApiFactory.MemberUserId], delivery.UserIds);
        Assert.Equal(RealtimeEventNames.SpaceMessagesChanged, delivery.EventName);
        Assert.Empty(realtime.ServerNotifications);

        authorization.SetPermission(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            "READ_MESSAGE_HISTORY",
            false);
        await notifier.NotifyMessagesChangedAsync(
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            Guid.NewGuid(),
            CancellationToken.None);
        Assert.Single(realtime.UserBatchNotifications);

        authorization.ThrowOnFilter = true;
        await notifier.NotifyMessagesChangedAsync(
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            Guid.NewGuid(),
            CancellationToken.None);
    }

    [Fact]
    public async Task SpaceChangeNotification_DoesNotExposeChangedSpaceId()
    {
        using var scope = this._factory.Services.CreateScope();
        var realtime = new RecordingRealtimeNotificationService();
        var authorization = new MutableSpaceAuthorizationService();
        var voiceConnections = new VoiceConnectionService(
            scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>(),
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var audience = new ServerSpaceRealtimeAudienceService(
            scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>(),
            authorization,
            new ServerSpaceRealtimeAudienceCache());
        var reconciliation = new ServerVoiceAccessReconciliationService(
            voiceConnections,
            realtime,
            audience,
            NullLogger<ServerVoiceAccessReconciliationService>.Instance);
        var notifier = new SpaceRealtimeNotifier(
            realtime,
            reconciliation,
            NullLogger<SpaceRealtimeNotifier>.Instance);

        await notifier.NotifySpacesChangedAsync(
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            CancellationToken.None);

        Assert.Equal(2, realtime.ServerNotifications.Count);
        foreach (var notification in realtime.ServerNotifications)
        {
            Assert.Equal(ArcaneLinkApiFactory.ServerId, notification.ServerId);
            Assert.NotNull(notification.Payload);
            Assert.Null(notification.Payload!.GetType().GetProperty("spaceId"));
            Assert.Null(notification.Payload.GetType().GetProperty("SpaceId"));
            Assert.NotNull(notification.Payload.GetType().GetProperty("serverId"));
        }
    }

    [Fact]
    public async Task ServerVoice_RechecksConnectForStateAndBothSignalParticipants()
    {
        using var scope = this._factory.Services.CreateScope();
        var authorization = new MutableSpaceAuthorizationService();
        var service = new VoiceConnectionService(
            scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>(),
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var serverId = ArcaneLinkApiFactory.ServerId;
        var spaceId = Guid.NewGuid();
        var senderConnectionId = $"voice-sender-{Guid.NewGuid():N}";
        var targetConnectionId = $"voice-target-{Guid.NewGuid():N}";
        var defaultState = new VoiceStateUpdate(false, false, false, false);

        authorization.SetCapabilities(
            ArcaneLinkApiFactory.OwnerUserId,
            serverId,
            spaceId,
            connect: true);
        authorization.SetCapabilities(
            ArcaneLinkApiFactory.MemberUserId,
            serverId,
            spaceId,
            connect: false);

        try
        {
            Assert.Null(await service.JoinAsync(
                targetConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                spaceId,
                defaultState));
            authorization.SetCapabilities(
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                spaceId,
                connect: true);

            var sender = await service.JoinAsync(
                senderConnectionId,
                ArcaneLinkApiFactory.OwnerUserId,
                serverId,
                spaceId,
                defaultState);
            var target = await service.JoinAsync(
                targetConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                spaceId,
                defaultState);
            Assert.NotNull(sender);
            Assert.NotNull(target);

            Assert.NotNull(await service.UpdateStateAsync(
                senderConnectionId,
                spaceId,
                new VoiceStateUpdate(true, false, false, false)));
            Assert.NotNull(await service.GetSignalRouteAsync(
                senderConnectionId,
                ArcaneLinkApiFactory.OwnerUserId,
                spaceId,
                target!.ParticipantId));

            authorization.SetCapabilities(
                ArcaneLinkApiFactory.OwnerUserId,
                serverId,
                spaceId,
                connect: false);
            Assert.Null(await service.UpdateStateAsync(
                senderConnectionId,
                spaceId,
                new VoiceStateUpdate(false, false, true, false)));
            Assert.Null(await service.GetSignalRouteAsync(
                senderConnectionId,
                ArcaneLinkApiFactory.OwnerUserId,
                spaceId,
                target.ParticipantId));

            authorization.SetCapabilities(
                ArcaneLinkApiFactory.OwnerUserId,
                serverId,
                spaceId,
                connect: true);
            authorization.SetCapabilities(
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                spaceId,
                connect: false);
            Assert.Null(await service.GetSignalRouteAsync(
                senderConnectionId,
                ArcaneLinkApiFactory.OwnerUserId,
                spaceId,
                target.ParticipantId));
        }
        finally
        {
            await service.DisconnectAsync(senderConnectionId);
            await service.DisconnectAsync(targetConnectionId);
        }
    }

    [Fact]
    public async Task ServerVoiceMove_RequiresActorManageOnBothSpaces_AndParticipantConnectOnTarget()
    {
        using var scope = this._factory.Services.CreateScope();
        var authorization = new MutableSpaceAuthorizationService();
        var service = new VoiceConnectionService(
            scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>(),
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var serverId = ArcaneLinkApiFactory.ServerId;
        var sourceSpaceId = Guid.NewGuid();
        var targetSpaceId = Guid.NewGuid();
        var connectionId = $"voice-move-{Guid.NewGuid():N}";

        authorization.SetCapabilities(
            ArcaneLinkApiFactory.MemberUserId,
            serverId,
            sourceSpaceId,
            connect: true);
        authorization.SetCapabilities(
            ArcaneLinkApiFactory.OwnerUserId,
            serverId,
            sourceSpaceId,
            manage: true);

        try
        {
            var joined = await service.JoinAsync(
                connectionId,
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                sourceSpaceId,
                new VoiceStateUpdate(false, false, false, false));
            Assert.NotNull(joined);

            Assert.Null(await service.MoveParticipantAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                serverId,
                sourceSpaceId,
                targetSpaceId,
                joined!.ParticipantId));

            authorization.SetCapabilities(
                ArcaneLinkApiFactory.OwnerUserId,
                serverId,
                targetSpaceId,
                manage: true);
            Assert.Null(await service.MoveParticipantAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                serverId,
                sourceSpaceId,
                targetSpaceId,
                joined.ParticipantId));

            authorization.SetCapabilities(
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                targetSpaceId,
                connect: true);
            authorization.SetPermission(
                ArcaneLinkApiFactory.OwnerUserId,
                serverId,
                targetSpaceId,
                "MOVE_VOICE_MEMBERS",
                false);
            Assert.Null(await service.MoveParticipantAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                serverId,
                sourceSpaceId,
                targetSpaceId,
                joined.ParticipantId));
            authorization.SetPermission(
                ArcaneLinkApiFactory.OwnerUserId,
                serverId,
                targetSpaceId,
                "MOVE_VOICE_MEMBERS",
                true);
            var moved = await service.MoveParticipantAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                serverId,
                sourceSpaceId,
                targetSpaceId,
                joined.ParticipantId);

            Assert.NotNull(moved);
            Assert.Equal(sourceSpaceId, moved!.PreviousConnection.SpaceId);
            Assert.Equal(targetSpaceId, moved.MovedConnection.SpaceId);
        }
        finally
        {
            await service.DisconnectAsync(connectionId);
        }
    }

    [Fact]
    public async Task ServerVoiceMediaPermissions_SanitizeJoinUpdateAndLeaseRefresh()
    {
        using var scope = this._factory.Services.CreateScope();
        var authorization = new MutableSpaceAuthorizationService();
        var service = new VoiceConnectionService(
            scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>(),
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var serverId = ArcaneLinkApiFactory.ServerId;
        var spaceId = Guid.NewGuid();
        var connectionId = $"voice-media-acl-{Guid.NewGuid():N}";
        var userId = ArcaneLinkApiFactory.MemberUserId;

        authorization.SetCapabilities(userId, serverId, spaceId, connect: true);
        authorization.SetPermission(userId, serverId, spaceId, "SPEAK_IN_VOICE", false);
        authorization.SetPermission(userId, serverId, spaceId, "USE_VIDEO", false);
        authorization.SetPermission(userId, serverId, spaceId, "SHARE_SCREEN", false);

        try
        {
            Assert.NotNull(await service.JoinAsync(
                connectionId,
                userId,
                serverId,
                spaceId,
                new VoiceStateUpdate(false, false, true, true)));

            using (var deniedRoster = await GetSingleVoiceParticipantAsync(
                       service,
                       serverId,
                       spaceId))
            {
                Assert.True(deniedRoster.RootElement.GetProperty("isMuted").GetBoolean());
                Assert.False(deniedRoster.RootElement.GetProperty("isCameraEnabled").GetBoolean());
                Assert.False(deniedRoster.RootElement.GetProperty("isScreenSharing").GetBoolean());
                Assert.False(deniedRoster.RootElement.GetProperty("canSpeak").GetBoolean());
                Assert.False(deniedRoster.RootElement.GetProperty("canUseVideo").GetBoolean());
                Assert.False(deniedRoster.RootElement.GetProperty("canShareScreen").GetBoolean());
            }

            authorization.SetPermission(userId, serverId, spaceId, "SPEAK_IN_VOICE", true);
            authorization.SetPermission(userId, serverId, spaceId, "USE_VIDEO", true);
            authorization.SetPermission(userId, serverId, spaceId, "SHARE_SCREEN", true);
            var update = await service.UpdateStateAsync(
                connectionId,
                spaceId,
                new VoiceStateUpdate(false, false, true, true));
            Assert.NotNull(update);
            Assert.False(update!.State.IsMuted);
            Assert.True(update.State.IsCameraEnabled);
            Assert.True(update.State.IsScreenSharing);

            authorization.SetPermission(userId, serverId, spaceId, "SPEAK_IN_VOICE", false);
            authorization.SetPermission(userId, serverId, spaceId, "USE_VIDEO", false);
            authorization.SetPermission(userId, serverId, spaceId, "SHARE_SCREEN", false);
            var lease = await service.RenewAccessLeaseAsync(
                connectionId,
                userId,
                serverId,
                spaceId,
                VoiceChannelScopes.Server);
            Assert.True(lease.IsActive);
            Assert.True(lease.StateChanged);

            using var refreshedRoster = await GetSingleVoiceParticipantAsync(
                service,
                serverId,
                spaceId);
            Assert.True(refreshedRoster.RootElement.GetProperty("isMuted").GetBoolean());
            Assert.False(refreshedRoster.RootElement.GetProperty("isCameraEnabled").GetBoolean());
            Assert.False(refreshedRoster.RootElement.GetProperty("isScreenSharing").GetBoolean());
        }
        finally
        {
            await service.DisconnectAsync(connectionId);
        }
    }

    [Fact]
    public async Task VoiceStateUpdate_RejectsAStaleParticipantGenerationOnTheSameConnection()
    {
        using var scope = this._factory.Services.CreateScope();
        var authorization = new MutableSpaceAuthorizationService();
        var service = new VoiceConnectionService(
            scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>(),
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var serverId = ArcaneLinkApiFactory.ServerId;
        var spaceId = Guid.NewGuid();
        var connectionId = $"voice-state-generation-{Guid.NewGuid():N}";
        var userId = ArcaneLinkApiFactory.MemberUserId;

        authorization.SetCapabilities(userId, serverId, spaceId, connect: true);
        authorization.SetPermission(userId, serverId, spaceId, "USE_VIDEO", true);
        authorization.SetPermission(userId, serverId, spaceId, "SHARE_SCREEN", true);

        try
        {
            var previous = Assert.IsType<VoiceJoinResult>(await service.JoinAsync(
                connectionId,
                userId,
                serverId,
                spaceId,
                new VoiceStateUpdate(false, false, false, false)));
            var current = Assert.IsType<VoiceJoinResult>(await service.JoinAsync(
                connectionId,
                userId,
                serverId,
                spaceId,
                new VoiceStateUpdate(false, false, false, false)));
            Assert.NotEqual(previous.ParticipantId, current.ParticipantId);

            Assert.Null(await service.UpdateStateAsync(
                connectionId,
                spaceId,
                new VoiceStateUpdate(false, false, true, true),
                previous.ParticipantId));
            Assert.NotNull(await service.UpdateStateAsync(
                connectionId,
                spaceId,
                new VoiceStateUpdate(false, false, true, true),
                current.ParticipantId));

            using var roster = await GetSingleVoiceParticipantAsync(
                service,
                serverId,
                spaceId);
            Assert.Equal(
                current.ParticipantId,
                roster.RootElement.GetProperty("participantId").GetGuid());
            Assert.True(roster.RootElement.GetProperty("isCameraEnabled").GetBoolean());
            Assert.True(roster.RootElement.GetProperty("isScreenSharing").GetBoolean());
        }
        finally
        {
            await service.DisconnectAsync(connectionId);
        }
    }

    [Fact]
    public async Task ServerVoiceModeration_UsesFieldSpecificAndDisconnectPermissions()
    {
        using var scope = this._factory.Services.CreateScope();
        var authorization = new MutableSpaceAuthorizationService();
        var service = new VoiceConnectionService(
            scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>(),
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var serverId = ArcaneLinkApiFactory.ServerId;
        var spaceId = Guid.NewGuid();
        var connectionId = $"voice-moderation-acl-{Guid.NewGuid():N}";
        var actorUserId = ArcaneLinkApiFactory.OwnerUserId;
        var targetUserId = ArcaneLinkApiFactory.MemberUserId;

        authorization.SetCapabilities(targetUserId, serverId, spaceId, connect: true);
        authorization.SetCapabilities(actorUserId, serverId, spaceId, manage: true);

        try
        {
            var joined = await service.JoinAsync(
                connectionId,
                targetUserId,
                serverId,
                spaceId,
                new VoiceStateUpdate(false, false, false, false));
            Assert.NotNull(joined);

            authorization.SetPermission(
                actorUserId,
                serverId,
                spaceId,
                "DEAFEN_VOICE_MEMBERS",
                false);
            Assert.Null(await service.UpdateParticipantModerationAsync(
                actorUserId,
                serverId,
                spaceId,
                joined!.ParticipantId,
                isServerMuted: true,
                isServerDeafened: true));

            Assert.NotNull(await service.UpdateParticipantModerationAsync(
                actorUserId,
                serverId,
                spaceId,
                joined.ParticipantId,
                isServerMuted: true,
                isServerDeafened: null));

            authorization.SetPermission(
                actorUserId,
                serverId,
                spaceId,
                "DISCONNECT_VOICE_MEMBERS",
                false);
            Assert.Null(await service.DisconnectParticipantAsync(
                actorUserId,
                serverId,
                spaceId,
                joined.ParticipantId));

            authorization.SetPermission(
                actorUserId,
                serverId,
                spaceId,
                "DISCONNECT_VOICE_MEMBERS",
                true);
            Assert.NotNull(await service.DisconnectParticipantAsync(
                actorUserId,
                serverId,
                spaceId,
                joined.ParticipantId));
            Assert.Null(await service.UpdateStateAsync(
                connectionId,
                spaceId,
                new VoiceStateUpdate(false, false, false, false)));
        }
        finally
        {
            await service.DisconnectAsync(connectionId);
        }
    }

    [Fact]
    public async Task ServerVoiceReconciliation_RemovesRevokedConnect_IsIdempotent_AndLeavesPrivateVoiceUntouched()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var authorization = new MutableSpaceAuthorizationService();
        var service = new VoiceConnectionService(
            db,
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var serverId = ArcaneLinkApiFactory.ServerId;
        var serverSpaceId = Guid.NewGuid();
        var privateSpaceId = Guid.NewGuid();
        var serverConnectionId = $"voice-reconcile-server-{Guid.NewGuid():N}";
        var privateConnectionId = $"voice-reconcile-private-{Guid.NewGuid():N}";
        var now = DateTime.UtcNow;
        var privateSpace = new Space
        {
            Id = privateSpaceId,
            ServerId = null,
            TypeId = SpaceIds.TypeVoiceRoom,
            CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            Title = "private-reconciliation-test",
            Position = 0,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.Spaces.Add(privateSpace);
        db.PrivateSpaces.Add(new PrivateSpace
        {
            SpaceId = privateSpaceId,
            CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            OwnerUserId = ArcaneLinkApiFactory.OwnerUserId,
            Kind = PrivateSpaceKindCodes.Group,
            Title = privateSpace.Title,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.PrivateSpaceMembers.Add(new PrivateSpaceMember
        {
            Id = Guid.NewGuid(),
            SpaceId = privateSpaceId,
            UserId = ArcaneLinkApiFactory.OwnerUserId,
            StatusId = PrivateSpaceIds.MemberStatusActive,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();

        authorization.SetCapabilities(
            ArcaneLinkApiFactory.MemberUserId,
            serverId,
            serverSpaceId,
            view: true,
            connect: true);

        try
        {
            Assert.NotNull(await service.JoinAsync(
                serverConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                serverSpaceId,
                new VoiceStateUpdate(false, false, false, false)));
            Assert.NotNull(await service.JoinPrivateSpaceAsync(
                privateConnectionId,
                ArcaneLinkApiFactory.OwnerUserId,
                privateSpaceId,
                new VoiceStateUpdate(false, false, false, false)));

            authorization.SetCapabilities(
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                serverSpaceId,
                view: true,
                connect: false);

            Assert.True(await service.CanViewVoiceChannelAsync(
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                serverSpaceId));
            Assert.False(await service.CanUseVoiceChannelAsync(
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                serverSpaceId));

            var first = await service.ReconcileServerAccessAsync(serverId);
            var removed = Assert.Single(first.RemovedConnections);
            Assert.Equal(ArcaneLinkApiFactory.MemberUserId, removed.UserId);
            Assert.Equal([serverSpaceId], first.AffectedSpaceIds);
            Assert.Null(await service.UpdateStateAsync(
                serverConnectionId,
                serverSpaceId,
                new VoiceStateUpdate(true, false, false, false)));

            var rosterJson = JsonSerializer.Serialize(
                await service.GetChannelStatePayloadAsync(
                    serverId,
                    serverSpaceId,
                    VoiceChannelScopes.Server));
            Assert.DoesNotContain(
                ArcaneLinkApiFactory.MemberUserId.ToString(),
                rosterJson,
                StringComparison.OrdinalIgnoreCase);

            var second = await service.ReconcileServerAccessAsync(serverId);
            Assert.Empty(second.RemovedConnections);
            Assert.Empty(second.AffectedSpaceIds);
            Assert.NotNull(await service.UpdateStateAsync(
                privateConnectionId,
                privateSpaceId,
                new VoiceStateUpdate(true, false, false, false)));
        }
        finally
        {
            await service.DisconnectAsync(serverConnectionId);
            await service.DisconnectAsync(privateConnectionId);
            db.Spaces.Remove(privateSpace);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task ServerVoiceAccessReconciliation_NotifiesOnlyRevokedConnectionGeneration_AndOnlyViewAudienceOnce()
    {
        using var scope = this._factory.Services.CreateScope();
        var authorization = new MutableSpaceAuthorizationService
        {
            FilteredUserIds =
            [
                ArcaneLinkApiFactory.OwnerUserId,
                ArcaneLinkApiFactory.MemberUserId
            ]
        };
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var realtime = new RecordingRealtimeNotificationService();
        var service = new VoiceConnectionService(
            db,
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var audience = new ServerSpaceRealtimeAudienceService(
            db,
            authorization,
            new ServerSpaceRealtimeAudienceCache());
        var reconciliation = new ServerVoiceAccessReconciliationService(
            service,
            realtime,
            audience,
            NullLogger<ServerVoiceAccessReconciliationService>.Instance);
        var serverId = ArcaneLinkApiFactory.ServerId;
        var spaceId = Guid.NewGuid();
        var connectionId = $"voice-reconcile-event-{Guid.NewGuid():N}";

        authorization.SetCapabilities(
            ArcaneLinkApiFactory.MemberUserId,
            serverId,
            spaceId,
            view: true,
            connect: true);
        authorization.SetCapabilities(
            ArcaneLinkApiFactory.OwnerUserId,
            serverId,
            spaceId,
            view: true);

        try
        {
            Assert.NotNull(await service.JoinAsync(
                connectionId,
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                spaceId,
                new VoiceStateUpdate(false, false, false, false)));
            authorization.SetCapabilities(
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                spaceId,
                view: false,
                connect: false);

            await reconciliation.ReconcileServerBestEffortAsync(serverId);
            await reconciliation.ReconcileServerBestEffortAsync(serverId);

            var revoked = Assert.Single(realtime.ConnectionNotifications);
            Assert.Equal(connectionId, revoked.ConnectionId);
            Assert.Equal(RealtimeEventNames.VoiceAccessRevoked, revoked.EventName);
            Assert.Equal(
                serverId,
                Assert.IsType<Guid>(revoked.Payload?.GetType().GetProperty("ServerId")?.GetValue(revoked.Payload)));
            Assert.Equal(
                spaceId,
                Assert.IsType<Guid>(revoked.Payload?.GetType().GetProperty("SpaceId")?.GetValue(revoked.Payload)));
            Assert.NotEqual(
                Guid.Empty,
                Assert.IsType<Guid>(revoked.Payload?.GetType().GetProperty("ParticipantId")?.GetValue(revoked.Payload)));
            Assert.Empty(realtime.UserNotifications);

            var roster = Assert.Single(realtime.UserBatchNotifications);
            Assert.Equal([ArcaneLinkApiFactory.OwnerUserId], roster.UserIds);
            Assert.Equal("VoiceChannelStateChanged", roster.EventName);
            Assert.Equal(SpaceAction.View, authorization.LastFilterAction);
            Assert.DoesNotContain(
                ArcaneLinkApiFactory.MemberUserId.ToString(),
                JsonSerializer.Serialize(roster.Payload),
                StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            await service.DisconnectAsync(connectionId);
        }
    }

    [Fact]
    public async Task VoiceAccessLease_RenewsExactServerAndPrivateSessions_ThenFailsClosed()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var authorization = new MutableSpaceAuthorizationService();
        var service = new VoiceConnectionService(
            db,
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var serverId = ArcaneLinkApiFactory.ServerId;
        var serverSpaceId = Guid.NewGuid();
        var serverConnectionId = $"voice-lease-server-{Guid.NewGuid():N}";
        var privateConnectionId = $"voice-lease-private-{Guid.NewGuid():N}";
        var seeded = await SeedPrivateVoiceSpaceAsync(db);

        authorization.SetCapabilities(
            ArcaneLinkApiFactory.MemberUserId,
            serverId,
            serverSpaceId,
            view: true,
            connect: true);

        try
        {
            Assert.NotNull(await service.JoinAsync(
                serverConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                serverSpaceId,
                new VoiceStateUpdate(false, false, false, false)));

            var wrongChannel = await service.RenewAccessLeaseAsync(
                serverConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                Guid.NewGuid(),
                VoiceChannelScopes.Server);
            Assert.False(wrongChannel.IsActive);
            Assert.Null(wrongChannel.RemovedConnection);
            Assert.NotNull(await service.UpdateStateAsync(
                serverConnectionId,
                serverSpaceId,
                new VoiceStateUpdate(true, false, false, false)));

            var activeServerLease = await service.RenewAccessLeaseAsync(
                serverConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                serverSpaceId,
                VoiceChannelScopes.Server);
            Assert.True(activeServerLease.IsActive);
            Assert.Null(activeServerLease.RemovedConnection);

            authorization.SetCapabilities(
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                serverSpaceId,
                view: true,
                connect: false);
            var deniedServerLease = await service.RenewAccessLeaseAsync(
                serverConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                serverSpaceId,
                VoiceChannelScopes.Server);
            Assert.False(deniedServerLease.IsActive);
            Assert.Equal(
                serverConnectionId,
                deniedServerLease.RemovedConnection?.ConnectionId);
            var repeatedServerLease = await service.RenewAccessLeaseAsync(
                serverConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                serverId,
                serverSpaceId,
                VoiceChannelScopes.Server);
            Assert.False(repeatedServerLease.IsActive);
            Assert.Null(repeatedServerLease.RemovedConnection);

            Assert.NotNull(await service.JoinPrivateSpaceAsync(
                privateConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                seeded.Space.Id,
                new VoiceStateUpdate(false, false, false, false)));
            var activePrivateLease = await service.RenewAccessLeaseAsync(
                privateConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                null,
                seeded.Space.Id,
                VoiceChannelScopes.Private);
            Assert.True(activePrivateLease.IsActive);

            seeded.Member.StatusId = PrivateSpaceIds.MemberStatusRemoved;
            seeded.Member.LeftAt = DateTime.UtcNow;
            seeded.Member.UpdatedAt = seeded.Member.LeftAt.Value;
            await db.SaveChangesAsync();
            var deniedPrivateLease = await service.RenewAccessLeaseAsync(
                privateConnectionId,
                ArcaneLinkApiFactory.MemberUserId,
                null,
                seeded.Space.Id,
                VoiceChannelScopes.Private);
            Assert.False(deniedPrivateLease.IsActive);
            Assert.Equal(
                privateConnectionId,
                deniedPrivateLease.RemovedConnection?.ConnectionId);
            Assert.Null(await service.UpdateStateAsync(
                privateConnectionId,
                seeded.Space.Id,
                new VoiceStateUpdate(true, false, false, false)));
        }
        finally
        {
            await service.DisconnectAsync(serverConnectionId);
            await service.DisconnectAsync(privateConnectionId);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateMembershipRemoval_EvictsVoice_NotifiesTeardown_AndRefreshesRosterOnce()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var authorization = new MutableSpaceAuthorizationService();
        var realtime = new RecordingRealtimeNotificationService();
        var voiceConnections = new VoiceConnectionService(
            db,
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var audience = new ServerSpaceRealtimeAudienceService(
            db,
            authorization,
            new ServerSpaceRealtimeAudienceCache());
        var messageNotifier = new SpaceMessageNotifier(
            realtime,
            audience,
            new SpaceMessageAccessService(db, authorization),
            NullLogger<SpaceMessageNotifier>.Instance);
        var notifier = new PrivateSpaceRealtimeNotifier(
            db,
            realtime,
            messageNotifier,
            NullLogger<PrivateSpaceRealtimeNotifier>.Instance);
        var voiceAccess = new PrivateVoiceAccessReconciliationService(
            db,
            voiceConnections,
            realtime,
            NullLogger<PrivateVoiceAccessReconciliationService>.Instance);
        var memberships = new PrivateSpaceMembershipService(
            db,
            new PrivateSpaceAccessService(db),
            new PrivateSpaceActivityService(db),
            new PrivateSpaceHistoryService(
                db,
                notifier,
                scope.ServiceProvider.GetRequiredService<IUserNotificationService>(),
                TimeProvider.System),
            notifier,
            voiceAccess,
            scope.ServiceProvider.GetRequiredService<IUserPresencePolicyService>(),
            scope.ServiceProvider.GetRequiredService<IUserPresenceCoordinator>(),
            scope.ServiceProvider.GetRequiredService<IDirectMessagePrivacyService>(),
            scope.ServiceProvider.GetRequiredService<IUserNotificationService>());
        var connectionId = $"private-voice-remove-{Guid.NewGuid():N}";
        var serverConnectionId = $"server-voice-private-remove-{Guid.NewGuid():N}";
        var serverSpaceId = Guid.NewGuid();
        authorization.SetCapabilities(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            serverSpaceId,
            view: true,
            connect: true);

        try
        {
            Assert.NotNull(await voiceConnections.JoinAsync(
                serverConnectionId,
                ArcaneLinkApiFactory.OwnerUserId,
                ArcaneLinkApiFactory.ServerId,
                serverSpaceId,
                new VoiceStateUpdate(false, false, false, false)));
            Assert.NotNull(await voiceConnections.JoinPrivateSpaceAsync(
                connectionId,
                ArcaneLinkApiFactory.MemberUserId,
                seeded.Space.Id,
                new VoiceStateUpdate(false, false, false, false)));

            Assert.True(await memberships.RemoveMemberAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                seeded.Space.Id,
                seeded.Member.Id));

            Assert.Null(await voiceConnections.UpdateStateAsync(
                connectionId,
                seeded.Space.Id,
                new VoiceStateUpdate(true, false, false, false)));
            Assert.False(await voiceConnections.CanUsePrivateVoiceChannelAsync(
                ArcaneLinkApiFactory.MemberUserId,
                seeded.Space.Id));
            Assert.NotNull(await voiceConnections.UpdateStateAsync(
                serverConnectionId,
                serverSpaceId,
                new VoiceStateUpdate(true, false, false, false)));

            var teardown = Assert.Single(
                realtime.UserNotifications,
                notification => notification.EventName == RealtimeEventNames.VoiceConnectionReplaced);
            Assert.Equal(ArcaneLinkApiFactory.MemberUserId, teardown.UserId);
            Assert.Equal(
                seeded.Space.Id,
                Assert.IsType<Guid>(teardown.Payload?.GetType().GetProperty("SpaceId")?.GetValue(teardown.Payload)));
            Assert.Equal(
                VoiceChannelScopes.Private,
                teardown.Payload?.GetType().GetProperty("ChannelScope")?.GetValue(teardown.Payload));
            Assert.NotEqual(
                Guid.Empty,
                Assert.IsType<Guid>(teardown.Payload?.GetType().GetProperty("ParticipantId")?.GetValue(teardown.Payload)));

            var roster = Assert.Single(
                realtime.UserBatchNotifications,
                notification => notification.EventName == "VoiceChannelStateChanged");
            Assert.Equal([ArcaneLinkApiFactory.OwnerUserId], roster.UserIds);
            Assert.DoesNotContain(
                ArcaneLinkApiFactory.MemberUserId.ToString(),
                JsonSerializer.Serialize(roster.Payload),
                StringComparison.OrdinalIgnoreCase);

            var spacesChanged = Assert.Single(
                realtime.UserBatchNotifications,
                notification => notification.EventName == RealtimeEventNames.PrivateSpacesChanged);
            Assert.Equal(
                [ArcaneLinkApiFactory.OwnerUserId, ArcaneLinkApiFactory.MemberUserId],
                spacesChanged.UserIds.Order().ToList());

            var notificationCount = realtime.UserNotifications.Count;
            var batchCount = realtime.UserBatchNotifications.Count;
            await voiceAccess.RevokeMemberBestEffortAsync(
                seeded.Space.Id,
                ArcaneLinkApiFactory.MemberUserId);
            Assert.Equal(notificationCount, realtime.UserNotifications.Count);
            Assert.Equal(batchCount, realtime.UserBatchNotifications.Count);
            Assert.False(await memberships.RemoveMemberAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                seeded.Space.Id,
                seeded.Member.Id));
        }
        finally
        {
            await voiceConnections.DisconnectAsync(connectionId);
            await voiceConnections.DisconnectAsync(serverConnectionId);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateMembershipLeave_RemainsCommittedAndVoiceClosed_WhenRealtimeFails()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var authorization = new MutableSpaceAuthorizationService();
        var realtime = new RecordingRealtimeNotificationService
        {
            ThrowOnUser = true,
            ThrowOnUsers = true
        };
        var voiceConnections = new VoiceConnectionService(
            db,
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var audience = new ServerSpaceRealtimeAudienceService(
            db,
            authorization,
            new ServerSpaceRealtimeAudienceCache());
        var notifier = new PrivateSpaceRealtimeNotifier(
            db,
            realtime,
            new SpaceMessageNotifier(
                realtime,
                audience,
                new SpaceMessageAccessService(db, authorization),
                NullLogger<SpaceMessageNotifier>.Instance),
            NullLogger<PrivateSpaceRealtimeNotifier>.Instance);
        var memberships = new PrivateSpaceMembershipService(
            db,
            new PrivateSpaceAccessService(db),
            new PrivateSpaceActivityService(db),
            new PrivateSpaceHistoryService(
                db,
                notifier,
                scope.ServiceProvider.GetRequiredService<IUserNotificationService>(),
                TimeProvider.System),
            notifier,
            new PrivateVoiceAccessReconciliationService(
                db,
                voiceConnections,
                realtime,
                NullLogger<PrivateVoiceAccessReconciliationService>.Instance),
            scope.ServiceProvider.GetRequiredService<IUserPresencePolicyService>(),
            scope.ServiceProvider.GetRequiredService<IUserPresenceCoordinator>(),
            scope.ServiceProvider.GetRequiredService<IDirectMessagePrivacyService>(),
            scope.ServiceProvider.GetRequiredService<IUserNotificationService>());
        var connectionId = $"private-voice-leave-{Guid.NewGuid():N}";

        try
        {
            Assert.NotNull(await voiceConnections.JoinPrivateSpaceAsync(
                connectionId,
                ArcaneLinkApiFactory.MemberUserId,
                seeded.Space.Id,
                new VoiceStateUpdate(false, false, false, false)));

            Assert.True(await memberships.LeaveAsync(
                ArcaneLinkApiFactory.MemberUserId,
                seeded.Space.Id));
            Assert.Null(await voiceConnections.UpdateStateAsync(
                connectionId,
                seeded.Space.Id,
                new VoiceStateUpdate(true, false, false, false)));
            Assert.Equal(
                PrivateSpaceIds.MemberStatusLeft,
                seeded.Member.StatusId);
            Assert.False(await memberships.LeaveAsync(
                ArcaneLinkApiFactory.MemberUserId,
                seeded.Space.Id));
        }
        finally
        {
            await voiceConnections.DisconnectAsync(connectionId);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task RoleAccessChanges_NotifyClientsToReloadEffectiveSpaces()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var authorization = new MutableSpaceAuthorizationService();
        var realtime = new RecordingRealtimeNotificationService();
        var voiceConnections = new VoiceConnectionService(
            db,
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var audience = new ServerSpaceRealtimeAudienceService(
            db,
            authorization,
            new ServerSpaceRealtimeAudienceCache());
        var reconciliation = new ServerVoiceAccessReconciliationService(
            voiceConnections,
            realtime,
            audience,
            NullLogger<ServerVoiceAccessReconciliationService>.Instance);
        var roles = new ServerRoleService(
            db,
            realtime,
            new ServerGovernanceAccessService(db),
            authorization,
            reconciliation,
            NullLogger<ServerRoleService>.Instance);

        var createResult = await roles.CreateRoleAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            new CreateServerRoleRequest { Title = $"acl-refresh-{Guid.NewGuid():N}" });
        Assert.Equal(CreateServerRoleStatus.Success, createResult.Status);
        var role = Assert.IsType<ServerRoleResponse>(createResult.Role);

        realtime.ServerNotifications.Clear();
        var updateResult = await roles.UpdateRolePermissionsAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            role.Id,
            new UpdateServerRolePermissionsRequest
            {
                PermissionCodes = ["manage_invites"]
            });
        Assert.Equal(UpdateServerRoleStatus.Success, updateResult.Status);
        AssertEffectiveSpacesChanged(realtime.ServerNotifications);

        realtime.ServerNotifications.Clear();
        var assignment = await roles.AssignRoleAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.MemberMemberId,
            new AssignServerRoleRequest { RoleId = role.Id });
        Assert.NotNull(assignment);
        AssertEffectiveSpacesChanged(realtime.ServerNotifications);

        realtime.ServerNotifications.Clear();
        Assert.True(await roles.RevokeMemberRoleAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            assignment!.Id));
        AssertEffectiveSpacesChanged(realtime.ServerNotifications);
    }

    private static void AssertEffectiveSpacesChanged(
        IReadOnlyList<ServerNotification> notifications)
    {
        var changed = Assert.Single(
            notifications,
            notification => notification.EventName == RealtimeEventNames.ServerSpacesChanged);
        Assert.Equal(ArcaneLinkApiFactory.ServerId, changed.ServerId);
        Assert.NotNull(changed.Payload?.GetType().GetProperty("serverId"));
        Assert.Null(changed.Payload?.GetType().GetProperty("spaceId"));
    }

    private static async Task<JsonDocument> GetSingleVoiceParticipantAsync(
        IVoiceConnectionService service,
        Guid serverId,
        Guid spaceId)
    {
        var payload = await service.GetChannelStatePayloadAsync(
            serverId,
            spaceId,
            VoiceChannelScopes.Server);
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(payload));
        var participant = Assert.Single(
            document.RootElement.GetProperty("participants").EnumerateArray());
        return JsonDocument.Parse(participant.GetRawText());
    }

    [Fact]
    public async Task PrivateCall_FirstAcceptStopsGroupRinging_AndDuplicateAcceptDoesNotReplaceParticipant()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var now = DateTime.UtcNow;
        var thirdMember = new PrivateSpaceMember
        {
            Id = Guid.NewGuid(),
            SpaceId = seeded.Space.Id,
            UserId = ArcaneLinkApiFactory.OutsiderUserId,
            StatusId = PrivateSpaceIds.MemberStatusActive,
            JoinedAt = now,
            AddedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.PrivateSpaceMembers.Add(thirdMember);
        await db.SaveChangesAsync();
        var service = new VoiceConnectionService(
            db,
            new MutableSpaceAuthorizationService(),
            NullLogger<VoiceConnectionService>.Instance);
        var callerConnection = $"call-caller-{Guid.NewGuid():N}";
        var calleeConnection = $"call-callee-{Guid.NewGuid():N}";
        var duplicateConnection = $"call-duplicate-{Guid.NewGuid():N}";

        try
        {
            var started = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    callerConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            Assert.Equal(PrivateCallPhases.Ringing, started.Call.Phase);
            Assert.Equal(2, started.Call.RingingUserIds.Count);

            var acceptResults = await Task.WhenAll(
                service.AcceptPrivateCallAsync(
                    calleeConnection,
                    ArcaneLinkApiFactory.MemberUserId,
                    seeded.Space.Id,
                    started.CallId,
                    new VoiceStateUpdate(false, false, false, false)),
                service.AcceptPrivateCallAsync(
                    duplicateConnection,
                    ArcaneLinkApiFactory.MemberUserId,
                    seeded.Space.Id,
                    started.CallId,
                    new VoiceStateUpdate(false, false, false, false)));
            var accepted = Assert.Single(acceptResults, result => result != null)!;
            Assert.Equal(PrivateCallPhases.Active, accepted.Call.Phase);
            Assert.Empty(accepted.Call.RingingUserIds);

            var rosterJson = JsonSerializer.Serialize(
                await service.GetChannelStatePayloadAsync(
                    null,
                    seeded.Space.Id,
                    VoiceChannelScopes.Private));
            Assert.Contains(accepted.ParticipantId.ToString(), rosterJson, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            await service.DisconnectAsync(callerConnection);
            await service.DisconnectAsync(calleeConnection);
            await service.DisconnectAsync(duplicateConnection);
            await service.SynchronizePrivateCallAsync(seeded.Space.Id);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateCall_DeclineEndsGeneration_AndNextStartGetsFreshCallId()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var service = new VoiceConnectionService(
            db,
            new MutableSpaceAuthorizationService(),
            NullLogger<VoiceConnectionService>.Instance);
        var firstConnection = $"call-first-{Guid.NewGuid():N}";
        var secondConnection = $"call-second-{Guid.NewGuid():N}";

        try
        {
            var first = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    firstConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            var declined = Assert.IsType<PrivateCallTransitionResult>(
                await service.DeclinePrivateCallAsync(
                    ArcaneLinkApiFactory.MemberUserId,
                    seeded.Space.Id,
                    first.CallId));
            Assert.Equal(PrivateCallPhases.Ended, declined.Call.Phase);
            Assert.Null(await service.GetPrivateCallStateAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                seeded.Space.Id));

            var second = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    secondConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            Assert.NotEqual(first.CallId, second.CallId);
        }
        finally
        {
            await service.DisconnectAsync(firstConnection);
            await service.DisconnectAsync(secondConnection);
            await service.SynchronizePrivateCallAsync(seeded.Space.Id);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateCall_LegacyRejoinRequiresPreviousParticipation_AndNeverCreatesGeneration()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var service = new VoiceConnectionService(
            db,
            new MutableSpaceAuthorizationService(),
            NullLogger<VoiceConnectionService>.Instance);
        var callerConnection = $"call-owner-{Guid.NewGuid():N}";
        var reconnectConnection = $"call-owner-rejoin-{Guid.NewGuid():N}";

        try
        {
            Assert.Null(await service.RejoinPrivateCallAsync(
                reconnectConnection,
                ArcaneLinkApiFactory.OwnerUserId,
                seeded.Space.Id,
                new VoiceStateUpdate(false, false, false, false)));
            var started = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    callerConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            Assert.Null(await service.RejoinPrivateCallAsync(
                reconnectConnection,
                ArcaneLinkApiFactory.MemberUserId,
                seeded.Space.Id,
                new VoiceStateUpdate(false, false, false, false)));
            var rejoined = Assert.IsType<PrivateCallJoinResult>(
                await service.RejoinPrivateCallAsync(
                    reconnectConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            Assert.Equal(started.CallId, rejoined.CallId);
            Assert.Empty(rejoined.IncomingUserIds);
        }
        finally
        {
            await service.DisconnectAsync(callerConnection);
            await service.DisconnectAsync(reconnectConnection);
            await service.SynchronizePrivateCallAsync(seeded.Space.Id);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateCall_DirectBlockPreventsRingingInitiation()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var privateSpace = await db.PrivateSpaces.FindAsync(seeded.Space.Id);
        Assert.NotNull(privateSpace);
        privateSpace.Kind = PrivateSpaceKindCodes.Direct;
        privateSpace.DirectUserLowId = ArcaneLinkApiFactory.OwnerUserId.CompareTo(
            ArcaneLinkApiFactory.MemberUserId) < 0
            ? ArcaneLinkApiFactory.OwnerUserId
            : ArcaneLinkApiFactory.MemberUserId;
        privateSpace.DirectUserHighId = privateSpace.DirectUserLowId ==
                                        ArcaneLinkApiFactory.OwnerUserId
            ? ArcaneLinkApiFactory.MemberUserId
            : ArcaneLinkApiFactory.OwnerUserId;
        var block = new ArcaneLink.DataBase.Models.UsersModels.UserDirectMessageBlock
        {
            UserId = ArcaneLinkApiFactory.MemberUserId,
            BlockedUserId = ArcaneLinkApiFactory.OwnerUserId,
            CreatedAt = DateTime.UtcNow
        };
        db.UserDirectMessageBlocks.Add(block);
        await db.SaveChangesAsync();
        var service = new VoiceConnectionService(
            db,
            new MutableSpaceAuthorizationService(),
            NullLogger<VoiceConnectionService>.Instance,
            directMessagePrivacy: scope.ServiceProvider
                .GetRequiredService<IDirectMessagePrivacyService>());
        var connectionId = $"blocked-call-{Guid.NewGuid():N}";

        try
        {
            Assert.Null(await service.StartPrivateCallAsync(
                connectionId,
                ArcaneLinkApiFactory.OwnerUserId,
                seeded.Space.Id,
                new VoiceStateUpdate(false, false, false, false)));
            Assert.Null(await service.GetPrivateCallStateAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                seeded.Space.Id));
        }
        finally
        {
            await service.DisconnectAsync(connectionId);
            db.UserDirectMessageBlocks.Remove(block);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateCall_DirectBlockAfterStartTerminatesGenerationAndLease()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var privateSpace = await db.PrivateSpaces.FindAsync(seeded.Space.Id);
        Assert.NotNull(privateSpace);
        privateSpace.Kind = PrivateSpaceKindCodes.Direct;
        privateSpace.DirectUserLowId = ArcaneLinkApiFactory.OwnerUserId.CompareTo(
            ArcaneLinkApiFactory.MemberUserId) < 0
            ? ArcaneLinkApiFactory.OwnerUserId
            : ArcaneLinkApiFactory.MemberUserId;
        privateSpace.DirectUserHighId = privateSpace.DirectUserLowId ==
                                        ArcaneLinkApiFactory.OwnerUserId
            ? ArcaneLinkApiFactory.MemberUserId
            : ArcaneLinkApiFactory.OwnerUserId;
        await db.SaveChangesAsync();
        var privacy = scope.ServiceProvider.GetRequiredService<IDirectMessagePrivacyService>();
        var service = new VoiceConnectionService(
            db,
            new MutableSpaceAuthorizationService(),
            NullLogger<VoiceConnectionService>.Instance,
            directMessagePrivacy: privacy);
        var connectionId = $"blocked-active-call-{Guid.NewGuid():N}";
        ArcaneLink.DataBase.Models.UsersModels.UserDirectMessageBlock? block = null;

        try
        {
            var started = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    connectionId,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            block = new ArcaneLink.DataBase.Models.UsersModels.UserDirectMessageBlock
            {
                UserId = ArcaneLinkApiFactory.MemberUserId,
                BlockedUserId = ArcaneLinkApiFactory.OwnerUserId,
                CreatedAt = DateTime.UtcNow
            };
            db.UserDirectMessageBlocks.Add(block);
            await db.SaveChangesAsync();

            Assert.Null(await service.AcceptPrivateCallAsync(
                $"blocked-accept-{Guid.NewGuid():N}",
                ArcaneLinkApiFactory.MemberUserId,
                seeded.Space.Id,
                started.CallId,
                new VoiceStateUpdate(false, false, false, false)));
            var transition = Assert.IsType<PrivateCallTransitionResult>(
                await service.ReconcilePrivateCallPrivacyAsync(seeded.Space.Id));
            Assert.Equal(PrivateCallPhases.Ended, transition.Call.Phase);
            Assert.Equal("privacy_changed", transition.Call.EndReason);
            var lease = await service.RenewAccessLeaseAsync(
                connectionId,
                ArcaneLinkApiFactory.OwnerUserId,
                null,
                seeded.Space.Id,
                VoiceChannelScopes.Private);
            Assert.False(lease.IsActive);
            Assert.Null(await service.GetPrivateCallStateAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                seeded.Space.Id));
        }
        finally
        {
            await service.DisconnectAsync(connectionId);
            if (block != null)
            {
                db.UserDirectMessageBlocks.Remove(block);
            }
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateCall_ConcurrentStartsCreateOneGenerationAndOneRingingDelivery()
    {
        using var firstScope = this._factory.Services.CreateScope();
        using var secondScope = this._factory.Services.CreateScope();
        var firstDb = firstScope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var secondDb = secondScope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(firstDb);
        var firstService = new VoiceConnectionService(
            firstDb,
            new MutableSpaceAuthorizationService(),
            NullLogger<VoiceConnectionService>.Instance);
        var secondService = new VoiceConnectionService(
            secondDb,
            new MutableSpaceAuthorizationService(),
            NullLogger<VoiceConnectionService>.Instance);
        var firstConnection = $"concurrent-call-a-{Guid.NewGuid():N}";
        var secondConnection = $"concurrent-call-b-{Guid.NewGuid():N}";

        try
        {
            var starts = await Task.WhenAll(
                firstService.StartPrivateCallAsync(
                    firstConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)),
                secondService.StartPrivateCallAsync(
                    secondConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            var successful = Assert.Single(starts, result => result != null)!;
            Assert.Equal([ArcaneLinkApiFactory.MemberUserId], successful.IncomingUserIds);
            var current = Assert.IsType<PrivateCallState>(
                await firstService.GetPrivateCallStateAsync(
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id));
            Assert.Equal(successful.CallId, current.CallId);
        }
        finally
        {
            await firstService.DisconnectAsync(firstConnection);
            await firstService.DisconnectAsync(secondConnection);
            await firstService.SynchronizePrivateCallAsync(seeded.Space.Id);
            firstDb.Spaces.Remove(seeded.Space);
            await firstDb.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateCall_ActiveCallSurvivesCallerLeave_AndEndsAfterLastParticipant()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var service = new VoiceConnectionService(
            db,
            new MutableSpaceAuthorizationService(),
            NullLogger<VoiceConnectionService>.Instance);
        var callerConnection = $"active-caller-{Guid.NewGuid():N}";
        var calleeConnection = $"active-callee-{Guid.NewGuid():N}";
        var nextConnection = $"active-next-{Guid.NewGuid():N}";

        try
        {
            var started = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    callerConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            Assert.NotNull(await service.AcceptPrivateCallAsync(
                calleeConnection,
                ArcaneLinkApiFactory.MemberUserId,
                seeded.Space.Id,
                started.CallId,
                new VoiceStateUpdate(false, false, false, false)));

            await service.DisconnectAsync(callerConnection);
            var afterCallerLeft = Assert.IsType<PrivateCallTransitionResult>(
                await service.SynchronizePrivateCallAsync(seeded.Space.Id));
            Assert.Equal(PrivateCallPhases.Active, afterCallerLeft.Call.Phase);
            Assert.Equal(
                [ArcaneLinkApiFactory.MemberUserId],
                afterCallerLeft.Call.ParticipantUserIds);

            await service.DisconnectAsync(calleeConnection);
            var ended = Assert.IsType<PrivateCallTransitionResult>(
                await service.SynchronizePrivateCallAsync(seeded.Space.Id));
            Assert.Equal(PrivateCallPhases.Ended, ended.Call.Phase);
            Assert.Null(await service.GetPrivateCallStateAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                seeded.Space.Id));

            var next = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    nextConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            Assert.NotEqual(started.CallId, next.CallId);
        }
        finally
        {
            await service.DisconnectAsync(callerConnection);
            await service.DisconnectAsync(calleeConnection);
            await service.DisconnectAsync(nextConnection);
            await service.SynchronizePrivateCallAsync(seeded.Space.Id);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateCall_SwitchingAllParticipantsToServerVoiceEndsGeneration_AndCanSwitchBack()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var authorization = new MutableSpaceAuthorizationService();
        var service = new VoiceConnectionService(
            db,
            authorization,
            NullLogger<VoiceConnectionService>.Instance);
        var ownerConnection = $"switch-owner-{Guid.NewGuid():N}";
        var memberConnection = $"switch-member-{Guid.NewGuid():N}";
        var serverSpaceId = Guid.NewGuid();
        var defaultState = new VoiceStateUpdate(false, false, false, false);

        authorization.SetCapabilities(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            serverSpaceId,
            connect: true);
        authorization.SetCapabilities(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            serverSpaceId,
            connect: true);
        try
        {
            var started = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    ownerConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    defaultState));
            Assert.NotNull(await service.AcceptPrivateCallAsync(
                memberConnection,
                ArcaneLinkApiFactory.MemberUserId,
                seeded.Space.Id,
                started.CallId,
                defaultState));

            var ownerServerJoin = Assert.IsType<VoiceJoinResult>(
                await service.JoinAsync(
                    ownerConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    ArcaneLinkApiFactory.ServerId,
                    serverSpaceId,
                    defaultState));
            Assert.Contains(
                ownerServerJoin.RemovedConnections.Concat(
                    ownerServerJoin.ReplacedConnections),
                connection => connection.SpaceId == seeded.Space.Id &&
                              connection.ChannelScope == VoiceChannelScopes.Private);
            var afterOwnerSwitch = Assert.IsType<PrivateCallTransitionResult>(
                await service.SynchronizePrivateCallAsync(
                    seeded.Space.Id,
                    "participant_moved"));
            Assert.Equal(PrivateCallPhases.Active, afterOwnerSwitch.Call.Phase);
            Assert.Equal(
                [ArcaneLinkApiFactory.MemberUserId],
                afterOwnerSwitch.Call.ParticipantUserIds);

            var memberServerJoin = Assert.IsType<VoiceJoinResult>(
                await service.JoinAsync(
                    memberConnection,
                    ArcaneLinkApiFactory.MemberUserId,
                    ArcaneLinkApiFactory.ServerId,
                    serverSpaceId,
                    defaultState));
            Assert.Contains(
                memberServerJoin.RemovedConnections.Concat(
                    memberServerJoin.ReplacedConnections),
                connection => connection.SpaceId == seeded.Space.Id &&
                              connection.ChannelScope == VoiceChannelScopes.Private);
            var ended = Assert.IsType<PrivateCallTransitionResult>(
                await service.SynchronizePrivateCallAsync(
                    seeded.Space.Id,
                    "participant_moved"));
            Assert.Equal(PrivateCallPhases.Ended, ended.Call.Phase);
            Assert.Equal("participant_moved", ended.Call.EndReason);
            Assert.Null(await service.GetPrivateCallStateAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                seeded.Space.Id));
            var privateRoster = await service.GetChannelStatePayloadAsync(
                null,
                seeded.Space.Id,
                VoiceChannelScopes.Private);
            using var rosterDocument = JsonDocument.Parse(
                JsonSerializer.Serialize(privateRoster));
            Assert.Empty(
                rosterDocument.RootElement
                    .GetProperty("participants")
                    .EnumerateArray());

            var restarted = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    ownerConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    defaultState));
            Assert.NotEqual(started.CallId, restarted.CallId);
            Assert.Contains(
                restarted.Voice.RemovedConnections.Concat(
                    restarted.Voice.ReplacedConnections),
                connection => connection.SpaceId == serverSpaceId &&
                              connection.ChannelScope == VoiceChannelScopes.Server);
        }
        finally
        {
            await service.DisconnectAsync(ownerConnection);
            await service.DisconnectAsync(memberConnection);
            await service.SynchronizePrivateCallAsync(seeded.Space.Id);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateCall_GroupDeclinesEndOnlyAfterLastRingingMember()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var now = DateTime.UtcNow;
        db.PrivateSpaceMembers.Add(new PrivateSpaceMember
        {
            Id = Guid.NewGuid(),
            SpaceId = seeded.Space.Id,
            UserId = ArcaneLinkApiFactory.OutsiderUserId,
            StatusId = PrivateSpaceIds.MemberStatusActive,
            JoinedAt = now,
            AddedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();
        var service = new VoiceConnectionService(
            db,
            new MutableSpaceAuthorizationService(),
            NullLogger<VoiceConnectionService>.Instance);
        var callerConnection = $"decline-group-{Guid.NewGuid():N}";

        try
        {
            var started = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    callerConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            var firstDecline = Assert.IsType<PrivateCallTransitionResult>(
                await service.DeclinePrivateCallAsync(
                    ArcaneLinkApiFactory.MemberUserId,
                    seeded.Space.Id,
                    started.CallId));
            Assert.Equal(PrivateCallPhases.Ringing, firstDecline.Call.Phase);
            Assert.Equal(
                [ArcaneLinkApiFactory.OutsiderUserId],
                firstDecline.Call.RingingUserIds);

            var lastDecline = Assert.IsType<PrivateCallTransitionResult>(
                await service.DeclinePrivateCallAsync(
                    ArcaneLinkApiFactory.OutsiderUserId,
                    seeded.Space.Id,
                    started.CallId));
            Assert.Equal(PrivateCallPhases.Ended, lastDecline.Call.Phase);
            using var roster = JsonDocument.Parse(JsonSerializer.Serialize(
                await service.GetChannelStatePayloadAsync(
                    null,
                    seeded.Space.Id,
                    VoiceChannelScopes.Private)));
            Assert.Empty(roster.RootElement.GetProperty("participants").EnumerateArray());
        }
        finally
        {
            await service.DisconnectAsync(callerConnection);
            await service.SynchronizePrivateCallAsync(seeded.Space.Id);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task PrivateCall_RemovingUnjoinedInviteePrunesRingingAndEndsUnavailableCall()
    {
        using var scope = this._factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ArcaneLink.DataBase._Data.AppDbContext>();
        var seeded = await SeedPrivateVoiceSpaceAsync(db);
        var service = new VoiceConnectionService(
            db,
            new MutableSpaceAuthorizationService(),
            NullLogger<VoiceConnectionService>.Instance);
        var callerConnection = $"removed-invitee-{Guid.NewGuid():N}";

        try
        {
            var started = Assert.IsType<PrivateCallJoinResult>(
                await service.StartPrivateCallAsync(
                    callerConnection,
                    ArcaneLinkApiFactory.OwnerUserId,
                    seeded.Space.Id,
                    new VoiceStateUpdate(false, false, false, false)));
            seeded.Member.StatusId = PrivateSpaceIds.MemberStatusRemoved;
            seeded.Member.LeftAt = DateTime.UtcNow;
            seeded.Member.UpdatedAt = seeded.Member.LeftAt.Value;
            await db.SaveChangesAsync();

            var ended = Assert.IsType<PrivateCallTransitionResult>(
                await service.SynchronizePrivateCallAsync(
                    seeded.Space.Id,
                    "membership_changed"));
            Assert.Equal(PrivateCallPhases.Ended, ended.Call.Phase);
            Assert.True(ended.Call.Revision > started.Call.Revision);
            Assert.Empty(ended.Call.RingingUserIds);
            Assert.Null(await service.GetPrivateCallStateAsync(
                ArcaneLinkApiFactory.OwnerUserId,
                seeded.Space.Id));
        }
        finally
        {
            await service.DisconnectAsync(callerConnection);
            await service.SynchronizePrivateCallAsync(seeded.Space.Id);
            db.Spaces.Remove(seeded.Space);
            await db.SaveChangesAsync();
        }
    }

    private static async Task<SeededPrivateVoiceSpace> SeedPrivateVoiceSpaceAsync(
        ArcaneLink.DataBase._Data.AppDbContext db)
    {
        var now = DateTime.UtcNow;
        var space = new Space
        {
            Id = Guid.NewGuid(),
            ServerId = null,
            TypeId = SpaceIds.TypeVoiceRoom,
            CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            Title = $"private-voice-{Guid.NewGuid():N}",
            Position = 0,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var ownerMember = new PrivateSpaceMember
        {
            Id = Guid.NewGuid(),
            SpaceId = space.Id,
            UserId = ArcaneLinkApiFactory.OwnerUserId,
            StatusId = PrivateSpaceIds.MemberStatusActive,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
        var member = new PrivateSpaceMember
        {
            Id = Guid.NewGuid(),
            SpaceId = space.Id,
            UserId = ArcaneLinkApiFactory.MemberUserId,
            StatusId = PrivateSpaceIds.MemberStatusActive,
            JoinedAt = now,
            AddedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Spaces.Add(space);
        db.PrivateSpaces.Add(new PrivateSpace
        {
            SpaceId = space.Id,
            CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            OwnerUserId = ArcaneLinkApiFactory.OwnerUserId,
            Kind = PrivateSpaceKindCodes.Group,
            Title = space.Title,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.PrivateSpaceMembers.AddRange(ownerMember, member);
        await db.SaveChangesAsync();

        return new SeededPrivateVoiceSpace(space, member);
    }

    private sealed class MutableSpaceAuthorizationService : ISpaceAuthorizationService
    {
        private readonly Dictionary<(Guid UserId, Guid ServerId, Guid SpaceId), SpaceAccessCapabilities>
            _capabilities = [];
        private readonly Dictionary<(Guid UserId, Guid ServerId, Guid SpaceId, string PermissionCode), bool>
            _permissions = [];

        public IReadOnlyList<Guid> FilteredUserIds { get; set; } = [];
        public bool ThrowOnFilter { get; set; }
        public IReadOnlyList<Guid> LastFilterCandidates { get; private set; } = [];
        public SpaceAction? LastFilterAction { get; private set; }

        public void SetCapabilities(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            bool view = true,
            bool connect = false,
            bool manage = false)
        {
            this._capabilities[(userId, serverId, spaceId)] = new SpaceAccessCapabilities(
                CanView: view,
                CanSendMessages: false,
                CanConnectVoice: connect,
                CanManage: manage);
            this.SetPermission(userId, serverId, spaceId, "VIEW_VOICE_SPACES", view);
            this.SetPermission(userId, serverId, spaceId, "CONNECT_VOICE", connect);
            this.SetPermission(userId, serverId, spaceId, "SPEAK_IN_VOICE", connect);
            this.SetPermission(userId, serverId, spaceId, "USE_VIDEO", connect);
            this.SetPermission(userId, serverId, spaceId, "SHARE_SCREEN", connect);
            this.SetPermission(userId, serverId, spaceId, "MUTE_VOICE_MEMBERS", manage);
            this.SetPermission(userId, serverId, spaceId, "DEAFEN_VOICE_MEMBERS", manage);
            this.SetPermission(userId, serverId, spaceId, "MOVE_VOICE_MEMBERS", manage);
            this.SetPermission(userId, serverId, spaceId, "DISCONNECT_VOICE_MEMBERS", manage);
        }

        public void SetPermission(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            string permissionCode,
            bool isAllowed)
        {
            this._permissions[(userId, serverId, spaceId, permissionCode)] = isAllowed;
        }

        public Task<SpaceAuthorizationSnapshot?> GetSnapshotAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            var capabilities = this._capabilities
                .Where(item => item.Key.UserId == userId && item.Key.ServerId == serverId)
                .ToDictionary(item => item.Key.SpaceId, item => item.Value);
            return Task.FromResult<SpaceAuthorizationSnapshot?>(
                new SpaceAuthorizationSnapshot(capabilities));
        }

        public Task<SpaceAccessCapabilities?> GetCapabilitiesAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(
                this._capabilities.GetValueOrDefault((userId, serverId, spaceId)));
        }

        public Task<bool> IsAllowedAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            SpaceAuthorizationRequirement requirement,
            CancellationToken cancellationToken = default)
        {
            var allowed = this._permissions.GetValueOrDefault(
                (userId, serverId, spaceId, requirement.PermissionCode));
            if (!allowed)
            {
                return Task.FromResult(false);
            }

            return Task.FromResult(
                (requirement.DependencyCodes ?? []).All(dependency =>
                    this._permissions.GetValueOrDefault(
                        (userId, serverId, spaceId, dependency))));
        }

        public async Task<IReadOnlyList<Guid>?> GetAllowedSpaceIdsAsync(
            Guid userId,
            Guid serverId,
            SpaceAction action,
            CancellationToken cancellationToken = default)
        {
            var snapshot = await this.GetSnapshotAsync(userId, serverId, cancellationToken);
            return snapshot?.GetAllowedSpaceIds(action);
        }

        public Task<IReadOnlyList<Guid>> FilterAuthorizedUserIdsAsync(
            Guid serverId,
            Guid spaceId,
            IEnumerable<Guid> userIds,
            SpaceAction action,
            CancellationToken cancellationToken = default)
        {
            if (this.ThrowOnFilter)
            {
                throw new InvalidOperationException("Injected audience resolution failure.");
            }

            this.LastFilterCandidates = userIds.Distinct().ToList();
            this.LastFilterAction = action;
            IReadOnlyList<Guid> filtered = this.LastFilterCandidates
                .Where(this.FilteredUserIds.Contains)
                .ToList();
            return Task.FromResult(filtered);
        }

        public void InvalidateServer(Guid serverId)
        {
        }
    }

    private sealed class RecordingRealtimeNotificationService : IRealtimeNotificationService
    {
        public bool ThrowOnUser { get; set; }
        public bool ThrowOnUsers { get; set; }
        public List<ConnectionNotification> ConnectionNotifications { get; } = [];
        public List<UserNotification> UserNotifications { get; } = [];
        public List<UserBatchNotification> UserBatchNotifications { get; } = [];
        public List<ServerNotification> ServerNotifications { get; } = [];

        public Task NotifyConnectionAsync(
            string connectionId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            this.ConnectionNotifications.Add(new ConnectionNotification(
                connectionId,
                eventName,
                payload));
            return Task.CompletedTask;
        }

        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            if (this.ThrowOnUser)
            {
                throw new InvalidOperationException("Injected user delivery failure.");
            }

            this.UserNotifications.Add(new UserNotification(userId, eventName, payload));
            return Task.CompletedTask;
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            if (this.ThrowOnUsers)
            {
                throw new InvalidOperationException("Injected batch delivery failure.");
            }

            this.UserBatchNotifications.Add(new UserBatchNotification(
                userIds.Distinct().ToList(),
                eventName,
                payload));
            return Task.CompletedTask;
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            this.ServerNotifications.Add(new ServerNotification(serverId, eventName, payload));
            return Task.CompletedTask;
        }
    }

    private sealed record UserBatchNotification(
        IReadOnlyList<Guid> UserIds,
        string EventName,
        object? Payload);

    private sealed record ConnectionNotification(
        string ConnectionId,
        string EventName,
        object? Payload);

    private sealed record UserNotification(
        Guid UserId,
        string EventName,
        object? Payload);

    private sealed record ServerNotification(
        Guid ServerId,
        string EventName,
        object? Payload);

    private sealed record SeededPrivateVoiceSpace(
        Space Space,
        PrivateSpaceMember Member);
}
