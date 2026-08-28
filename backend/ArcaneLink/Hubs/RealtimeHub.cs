using System.Security.Claims;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Observability;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Spaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Hubs
{
    [Authorize]
    public class RealtimeHub : Hub
    {
        private static readonly HashSet<string> AllowedVoiceSignalKinds = new(StringComparer.OrdinalIgnoreCase)
        {
            "offer",
            "answer",
            "ice",
            "renegotiate-offer",
            "renegotiate-answer"
        };
        private const int MaxVoiceSignalPayloadLength = 128 * 1024;

        private readonly AppDbContext _db;
        private readonly IVoiceConnectionService _voiceConnections;
        private readonly IRealtimeNotificationService _realtime;
        private readonly ServerSpaceRealtimeAudienceService _audience;
        private readonly RealtimeConnectionRegistry _connections;
        private readonly IUserPresenceCoordinator _presenceCoordinator;
        private readonly ILogger<RealtimeHub> _logger;

        public RealtimeHub(
            AppDbContext db,
            IVoiceConnectionService voiceConnections,
            IRealtimeNotificationService realtime,
            ServerSpaceRealtimeAudienceService audience,
            RealtimeConnectionRegistry connections,
            IUserPresenceCoordinator presenceCoordinator,
            ILogger<RealtimeHub> logger)
        {
            this._db = db;
            this._voiceConnections = voiceConnections;
            this._realtime = realtime;
            this._audience = audience;
            this._connections = connections;
            this._presenceCoordinator = presenceCoordinator;
            this._logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                var userId = this.GetCurrentUserId();
                if (userId != null)
                {
                    await this.Groups.AddToGroupAsync(
                        this.Context.ConnectionId,
                        RealtimeGroups.User(userId.Value));

                    var serverIds = await this._db.ServerMembers
                        .AsNoTracking()
                        .Where(
                            x => x.UserId == userId.Value &&
                                 x.StatusId == ServerMemberStatusIds.Active &&
                                 x.BannedAt == null &&
                                 x.Server.DeletedAt == null &&
                                 x.User.DeletedAt == null &&
                                 x.User.StatusId == UserStatusIds.Active)
                        .Select(x => x.ServerId)
                        .ToListAsync(this.Context.ConnectionAborted);

                    foreach (var serverId in serverIds)
                    {
                        await this.Groups.AddToGroupAsync(
                            this.Context.ConnectionId,
                            RealtimeGroups.Server(serverId));
                    }

                    var registration = this._connections.Register(
                        userId.Value,
                        this.Context.ConnectionId);
                    await this._presenceCoordinator.ConnectionRegisteredAsync(
                        registration,
                        CancellationToken.None);

                    var incomingCalls = await this._voiceConnections
                        .GetIncomingPrivateCallsAsync(
                            userId.Value,
                            CancellationToken.None);
                    foreach (var incomingCall in incomingCalls)
                    {
                        await this.Clients.Caller.SendAsync(
                            RealtimeEventNames.IncomingPrivateCall,
                            incomingCall,
                            CancellationToken.None);
                    }
                }

                this._logger.LogInformation(
                    ObservabilityEventIds.SignalRConnectionOpened,
                    "SignalR connection opened. ConnectionId={ConnectionId} UserId={UserId}",
                    this.Context.ConnectionId,
                    userId);

                await base.OnConnectedAsync();
            }
            catch (OperationCanceledException) when (this.Context.ConnectionAborted.IsCancellationRequested)
            {
                await this.UnregisterPresenceAsync();
                this._logger.LogDebug(
                    "Realtime connection setup canceled because the client disconnected. ConnectionId={ConnectionId}",
                    this.Context.ConnectionId);
            }
            catch
            {
                await this.UnregisterPresenceAsync();
                throw;
            }
        }

        public async Task JoinServer(Guid serverId)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            if (!await this.IsActiveServerMemberAsync(
                    userId.Value,
                    serverId,
                    this.Context.ConnectionAborted))
            {
                await this.Groups.RemoveFromGroupAsync(
                    this.Context.ConnectionId,
                    RealtimeGroups.Server(serverId));
                return;
            }

            await this.Groups.AddToGroupAsync(
                this.Context.ConnectionId,
                RealtimeGroups.Server(serverId));

            if (!await this.IsActiveServerMemberAsync(
                    userId.Value,
                    serverId,
                    this.Context.ConnectionAborted))
            {
                await this.Groups.RemoveFromGroupAsync(
                    this.Context.ConnectionId,
                    RealtimeGroups.Server(serverId));
            }
        }

        public async Task LeaveServer(Guid serverId)
        {
            await this.Groups.RemoveFromGroupAsync(
                this.Context.ConnectionId,
                RealtimeGroups.Server(serverId));
        }

        public async Task<Guid?> JoinVoiceChannel(
            Guid serverId,
            Guid spaceId,
            bool isMuted = false,
            bool isDeafened = false,
            bool isCameraEnabled = false,
            bool isScreenSharing = false)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                ArcaneLinkDiagnostics.VoiceJoinFailedCounter.Add(1);
                this._logger.LogWarning(
                    ObservabilityEventIds.VoiceJoinFailed,
                    "Voice join rejected. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                    this.Context.ConnectionId,
                    userId,
                    serverId,
                    spaceId);
                return null;
            }

            this._logger.LogInformation(
                ObservabilityEventIds.VoiceJoinStarted,
                "Voice join started. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId} IsMuted={IsMuted} IsDeafened={IsDeafened} IsCameraEnabled={IsCameraEnabled} IsScreenSharing={IsScreenSharing}",
                this.Context.ConnectionId,
                userId,
                serverId,
                spaceId,
                isMuted,
                isDeafened,
                isCameraEnabled,
                isScreenSharing);

            var result = await this._voiceConnections.JoinAsync(
                this.Context.ConnectionId,
                userId.Value,
                serverId,
                spaceId,
                new VoiceStateUpdate(
                    isMuted,
                    isDeafened,
                    isCameraEnabled,
                    isScreenSharing),
                this.Context.ConnectionAborted);

            if (result == null)
            {
                ArcaneLinkDiagnostics.VoiceJoinFailedCounter.Add(1);
                this._logger.LogWarning(
                    ObservabilityEventIds.VoiceJoinFailed,
                    "Voice join failed. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                    this.Context.ConnectionId,
                    userId,
                    serverId,
                    spaceId);
                return null;
            }

            await this.SynchronizeRemovedPrivateCallsAsync(
                result.RemovedConnections.Concat(result.ReplacedConnections),
                result.SpaceId,
                "participant_moved");
            await this.NotifyVoiceConnectionsReplacedBestEffortAsync(
                result.ReplacedConnections);
            await this.BroadcastVoiceJoinStatesBestEffortAsync(result);
            try
            {
                await this.JoinServer(serverId);
            }
            catch (Exception exception)
            {
                this._logger.LogWarning(
                    exception,
                    "Server group join failed after committed voice join. ConnectionId={ConnectionId} ServerId={ServerId} SpaceId={SpaceId}",
                    this.Context.ConnectionId,
                    serverId,
                    spaceId);
            }
            this._logger.LogInformation(
                ObservabilityEventIds.VoiceJoinSucceeded,
                "Voice join succeeded. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId} ReplacedConnections={ReplacedConnectionCount} RemovedConnections={RemovedConnectionCount}",
                this.Context.ConnectionId,
                userId,
                serverId,
                spaceId,
                result.ParticipantId,
                result.ReplacedConnections.Count,
                result.RemovedConnections.Count);
            return result.ParticipantId;
        }

        public async Task<Guid?> JoinPrivateVoiceChannel(
            Guid spaceId,
            bool isMuted = false,
            bool isDeafened = false,
            bool isCameraEnabled = false,
            bool isScreenSharing = false)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                ArcaneLinkDiagnostics.VoiceJoinFailedCounter.Add(1);
                this._logger.LogWarning(
                    ObservabilityEventIds.VoiceJoinFailed,
                    "Private voice join rejected. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId}",
                    this.Context.ConnectionId,
                    userId,
                    spaceId);
                return null;
            }

            this._logger.LogInformation(
                ObservabilityEventIds.VoiceJoinStarted,
                "Private voice join started. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId} IsMuted={IsMuted} IsDeafened={IsDeafened} IsCameraEnabled={IsCameraEnabled} IsScreenSharing={IsScreenSharing}",
                this.Context.ConnectionId,
                userId,
                spaceId,
                isMuted,
                isDeafened,
                isCameraEnabled,
                isScreenSharing);

            if (await this.ReconcilePrivateCallPrivacyAndBroadcastAsync(spaceId))
            {
                return null;
            }

            var result = await this._voiceConnections.RejoinPrivateCallAsync(
                this.Context.ConnectionId,
                userId.Value,
                spaceId,
                new VoiceStateUpdate(
                    isMuted,
                    isDeafened,
                    isCameraEnabled,
                    isScreenSharing),
                this.Context.ConnectionAborted);
            if (result == null)
            {
                await this.ReconcilePrivateCallPrivacyAndBroadcastAsync(spaceId);
                return null;
            }

            await this.HandlePrivateVoiceJoinAsync(result.Voice);
            var synchronized = await this._voiceConnections.SynchronizePrivateCallAsync(
                spaceId,
                cancellationToken: CancellationToken.None);
            if (synchronized != null)
            {
                await this.BroadcastPrivateCallTransitionAsync(synchronized);
            }
            return result.ParticipantId;
        }

        public async Task<PrivateCallJoinResult?> StartPrivateCall(
            Guid spaceId,
            bool isMuted = false,
            bool isDeafened = false,
            bool isCameraEnabled = false,
            bool isScreenSharing = false)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return null;
            }

            var result = await this._voiceConnections.StartPrivateCallAsync(
                this.Context.ConnectionId,
                userId.Value,
                spaceId,
                new VoiceStateUpdate(
                    isMuted,
                    isDeafened,
                    isCameraEnabled,
                    isScreenSharing),
                this.Context.ConnectionAborted);

            if (result == null)
            {
                ArcaneLinkDiagnostics.VoiceJoinFailedCounter.Add(1);
                this._logger.LogWarning(
                    ObservabilityEventIds.VoiceJoinFailed,
                    "Private voice join failed. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId}",
                    this.Context.ConnectionId,
                    userId,
                    spaceId);
                return null;
            }

            await this.HandlePrivateVoiceJoinAsync(result.Voice);
            await this.BroadcastPrivateCallTransitionAsync(
                new PrivateCallTransitionResult(result.Call, result.IncomingUserIds));
            return result;
        }

        public async Task<PrivateCallJoinResult?> AcceptPrivateCall(
            Guid spaceId,
            Guid callId,
            bool isMuted = false,
            bool isDeafened = false,
            bool isCameraEnabled = false,
            bool isScreenSharing = false)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return null;
            }

            if (await this.ReconcilePrivateCallPrivacyAndBroadcastAsync(spaceId))
            {
                return null;
            }

            var result = await this._voiceConnections.AcceptPrivateCallAsync(
                this.Context.ConnectionId,
                userId.Value,
                spaceId,
                callId,
                new VoiceStateUpdate(
                    isMuted,
                    isDeafened,
                    isCameraEnabled,
                    isScreenSharing),
                this.Context.ConnectionAborted);
            if (result == null)
            {
                await this.ReconcilePrivateCallPrivacyAndBroadcastAsync(spaceId);
                return null;
            }

            await this.HandlePrivateVoiceJoinAsync(result.Voice);
            await this.BroadcastPrivateCallTransitionAsync(
                new PrivateCallTransitionResult(result.Call, []));
            return result;
        }

        public async Task<bool> DeclinePrivateCall(Guid spaceId, Guid callId)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return false;
            }

            var result = await this._voiceConnections.DeclinePrivateCallAsync(
                userId.Value,
                spaceId,
                callId,
                this.Context.ConnectionAborted);
            if (result == null)
            {
                return false;
            }

            await this.BroadcastPrivateCallTransitionAsync(result);
            if (result.Call.Phase == PrivateCallPhases.Ended)
            {
                await this.BroadcastPrivateVoiceStateAsync(spaceId);
            }
            return true;
        }

        public async Task<bool> CancelPrivateCall(Guid spaceId, Guid callId)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return false;
            }

            var result = await this._voiceConnections.CancelPrivateCallAsync(
                userId.Value,
                spaceId,
                callId,
                this.Context.ConnectionAborted);
            if (result == null)
            {
                return false;
            }

            await this.BroadcastPrivateCallTransitionAsync(
                result,
                CancellationToken.None);
            await this.BroadcastPrivateVoiceStateAsync(
                spaceId,
                CancellationToken.None);
            return true;
        }

        public Task<PrivateCallState?> GetPrivateCallState(Guid spaceId)
        {
            var userId = this.GetCurrentUserId();
            return userId == null
                ? Task.FromResult<PrivateCallState?>(null)
                : this._voiceConnections.GetPrivateCallStateAsync(
                    userId.Value,
                    spaceId,
                    this.Context.ConnectionAborted);
        }

        public Task<IReadOnlyList<PrivateCallState>> GetIncomingPrivateCalls()
        {
            var userId = this.GetCurrentUserId();
            return userId == null
                ? Task.FromResult<IReadOnlyList<PrivateCallState>>([])
                : this._voiceConnections.GetIncomingPrivateCallsAsync(
                    userId.Value,
                    this.Context.ConnectionAborted);
        }

        private async Task HandlePrivateVoiceJoinAsync(VoiceJoinResult result)
        {
            await this.SynchronizeRemovedPrivateCallsAsync(
                result.RemovedConnections.Concat(result.ReplacedConnections),
                result.SpaceId,
                "participant_moved");
            await this.NotifyVoiceConnectionsReplacedBestEffortAsync(
                result.ReplacedConnections);
            await this.BroadcastVoiceJoinStatesBestEffortAsync(result);
            this._logger.LogInformation(
                ObservabilityEventIds.VoiceJoinSucceeded,
                "Private voice join succeeded. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId} ParticipantId={ParticipantId} ReplacedConnections={ReplacedConnectionCount} RemovedConnections={RemovedConnectionCount}",
                this.Context.ConnectionId,
                result.UserId,
                result.SpaceId,
                result.ParticipantId,
                result.ReplacedConnections.Count,
                result.RemovedConnections.Count);
        }

        public async Task LeaveVoiceChannel(Guid spaceId)
        {
            var removed = await this._voiceConnections.LeaveAsync(
                this.Context.ConnectionId,
                spaceId,
                this.Context.ConnectionAborted);

            if (removed != null)
            {
                await this.SynchronizeRemovedPrivateCallsAsync(
                    [removed],
                    retainedSpaceId: null,
                    endReason: "participant_left");
                try
                {
                    await this.BroadcastVoiceStateAsync(
                        removed.ServerId,
                        removed.SpaceId,
                        removed.ChannelScope,
                        CancellationToken.None);
                }
                catch (Exception exception)
                {
                    this._logger.LogWarning(
                        exception,
                        "Voice roster broadcast failed after committed leave. ServerId={ServerId} SpaceId={SpaceId} ChannelScope={ChannelScope}",
                        removed.ServerId,
                        removed.SpaceId,
                        removed.ChannelScope);
                }
                this._logger.LogInformation(
                    ObservabilityEventIds.VoiceLeaveCompleted,
                    "Voice leave completed. ConnectionId={ConnectionId} ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId}",
                    this.Context.ConnectionId,
                    removed.ServerId,
                    removed.SpaceId,
                    removed.ParticipantId);

            }
        }

        public async Task<bool> UpdateVoiceState(
            Guid spaceId,
            bool isMuted,
            bool isDeafened,
            bool isCameraEnabled = false,
            bool isScreenSharing = false,
            Guid? participantId = null)
        {
            var result = await this._voiceConnections.UpdateStateAsync(
                this.Context.ConnectionId,
                spaceId,
                new VoiceStateUpdate(
                    isMuted,
                    isDeafened,
                    isCameraEnabled,
                    isScreenSharing),
                participantId,
                this.Context.ConnectionAborted);

            if (result != null)
            {
                await this.BroadcastVoiceStateAsync(
                    result.Connection.ServerId,
                    result.Connection.SpaceId,
                    result.Connection.ChannelScope);
            }
            return result != null;
        }

        public async Task MoveVoiceParticipant(
            Guid serverId,
            Guid sourceSpaceId,
            Guid targetSpaceId,
            Guid participantId)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            var result = await this._voiceConnections.MoveParticipantAsync(
                userId.Value,
                serverId,
                sourceSpaceId,
                targetSpaceId,
                participantId,
                this.Context.ConnectionAborted);

            if (result == null)
            {
                return;
            }

            var targetTitle = await this._db.Spaces
                .AsNoTracking()
                .Where(x =>
                    x.Id == targetSpaceId &&
                    x.ServerId == serverId &&
                    x.TypeId == SpaceIds.TypeVoiceRoom &&
                    x.DeletedAt == null)
                .Select(x => x.Title)
                .FirstOrDefaultAsync(this.Context.ConnectionAborted);
            if (string.IsNullOrWhiteSpace(targetTitle))
            {
                return;
            }

            await this.Clients.Client(result.MovedConnection.ConnectionId).SendAsync(
                "VoiceParticipantMoved",
                new
                {
                    result.MovedConnection.ServerId,
                    result.PreviousConnection.SpaceId,
                    targetSpaceId = result.MovedConnection.SpaceId,
                    title = targetTitle,
                    result.MovedConnection.ParticipantId
                },
                this.Context.ConnectionAborted);

            await this.BroadcastVoiceStateAsync(
                result.PreviousConnection.ServerId,
                result.PreviousConnection.SpaceId,
                result.PreviousConnection.ChannelScope);
            await this.BroadcastVoiceStateAsync(
                result.MovedConnection.ServerId,
                result.MovedConnection.SpaceId,
                result.MovedConnection.ChannelScope);
        }

        public async Task<bool> UpdateVoiceParticipantModeration(
            Guid serverId,
            Guid spaceId,
            Guid participantId,
            bool? isServerMuted,
            bool? isServerDeafened)
        {
            var actorUserId = this.GetCurrentUserId();
            if (actorUserId == null)
            {
                return false;
            }

            var result = await this._voiceConnections.UpdateParticipantModerationAsync(
                actorUserId.Value,
                serverId,
                spaceId,
                participantId,
                isServerMuted,
                isServerDeafened,
                this.Context.ConnectionAborted);
            if (result == null)
            {
                return false;
            }

            await this.BroadcastVoiceStateAsync(
                result.Connection.ServerId,
                result.Connection.SpaceId,
                result.Connection.ChannelScope);
            return true;
        }

        public async Task<bool> DisconnectVoiceParticipant(
            Guid serverId,
            Guid spaceId,
            Guid participantId)
        {
            var actorUserId = this.GetCurrentUserId();
            if (actorUserId == null)
            {
                return false;
            }

            var removed = await this._voiceConnections.DisconnectParticipantAsync(
                actorUserId.Value,
                serverId,
                spaceId,
                participantId,
                this.Context.ConnectionAborted);
            if (removed == null)
            {
                return false;
            }

            try
            {
                await this.Clients.Client(removed.ConnectionId).SendAsync(
                    RealtimeEventNames.VoiceAccessRevoked,
                    new
                    {
                        serverId,
                        spaceId,
                        participantId,
                        reason = "disconnected_by_moderator"
                    },
                    CancellationToken.None);
            }
            catch (Exception exception)
            {
                this._logger.LogWarning(
                    exception,
                    "Voice disconnect notification failed after participant removal. ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId}",
                    serverId,
                    spaceId,
                    participantId);
            }

            try
            {
                await this.BroadcastVoiceStateAsync(
                    removed.ServerId,
                    removed.SpaceId,
                    removed.ChannelScope,
                    CancellationToken.None);
            }
            catch (Exception exception)
            {
                this._logger.LogWarning(
                    exception,
                    "Voice roster broadcast failed after participant disconnect. ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId}",
                    serverId,
                    spaceId,
                    participantId);
            }
            return true;
        }

        public async Task SendVoiceSignal(Guid spaceId, Guid targetParticipantId, string kind, string payload)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                this._logger.LogDebug(
                    "Voice signal ignored because user is missing. ConnectionId={ConnectionId} SpaceId={SpaceId} TargetUserId={TargetUserId} Kind={Kind}",
                    this.Context.ConnectionId,
                    spaceId,
                    targetParticipantId,
                    kind);
                return;
            }

            if (!AllowedVoiceSignalKinds.Contains(kind) ||
                string.IsNullOrWhiteSpace(payload) ||
                payload.Length > MaxVoiceSignalPayloadLength)
            {
                this._logger.LogWarning(
                    "Voice signal rejected. ConnectionId={ConnectionId} SpaceId={SpaceId} TargetParticipantId={TargetParticipantId} Kind={Kind} PayloadLength={PayloadLength}",
                    this.Context.ConnectionId,
                    spaceId,
                    targetParticipantId,
                    kind,
                    payload?.Length ?? 0);
                return;
            }

            var route = await this._voiceConnections.GetSignalRouteAsync(
                this.Context.ConnectionId,
                userId.Value,
                spaceId,
                targetParticipantId,
                this.Context.ConnectionAborted);

            if (route == null)
            {
                return;
            }

            if (targetParticipantId == route.Sender.ParticipantId)
            {
                this._logger.LogDebug(
                    "Voice signal ignored because target is sender. ConnectionId={ConnectionId} UserId={UserId} ParticipantId={ParticipantId} SpaceId={SpaceId} Kind={Kind}",
                    this.Context.ConnectionId,
                    route.Sender.UserId,
                    route.Sender.ParticipantId,
                    spaceId,
                    kind);
                return;
            }

            this._logger.LogInformation(
                "Voice signal routed. SpaceId={SpaceId} FromUserId={FromUserId} FromParticipantId={FromParticipantId} TargetParticipantId={TargetParticipantId} Kind={Kind} PayloadLength={PayloadLength} TargetConnections={TargetConnectionCount}",
                spaceId,
                route.Sender.UserId,
                route.Sender.ParticipantId,
                targetParticipantId,
                kind,
                payload.Length,
                route.TargetConnectionIds.Count);

            foreach (var connectionId in route.TargetConnectionIds)
            {
                await this.Clients.Client(connectionId).SendAsync(
                    "VoiceSignal",
                    new
                    {
                        spaceId,
                        fromUserId = route.Sender.UserId,
                        fromParticipantId = route.Sender.ParticipantId,
                        kind,
                        payload
                    },
                    this.Context.ConnectionAborted);
            }
        }

        public async Task GetVoiceChannelState(Guid serverId, Guid spaceId)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null ||
                !await this._voiceConnections.CanViewVoiceChannelAsync(
                    userId.Value,
                    serverId,
                    spaceId,
                    CancellationToken.None))
            {
                this._logger.LogWarning(
                    "Voice state request rejected. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                    this.Context.ConnectionId,
                    userId,
                    serverId,
                    spaceId);
                return;
            }

            this._logger.LogDebug(
                "Voice state requested. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                this.Context.ConnectionId,
                userId,
                serverId,
                spaceId);
            await this.Clients.Caller.SendAsync(
                "VoiceChannelStateChanged",
                await this._voiceConnections.GetChannelStatePayloadAsync(
                    serverId,
                    spaceId,
                    VoiceChannelScopes.Server,
                    CancellationToken.None),
                CancellationToken.None);
        }

        public Task<object?> RenewVoiceChannelAccessLease(
            Guid serverId,
            Guid spaceId)
        {
            return this.RenewVoiceAccessLeaseAsync(
                serverId,
                spaceId,
                VoiceChannelScopes.Server);
        }

        public async Task GetPrivateVoiceChannelState(Guid spaceId)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null ||
                !await this._voiceConnections.CanUsePrivateVoiceChannelAsync(
                    userId.Value,
                    spaceId,
                    CancellationToken.None))
            {
                this._logger.LogWarning(
                    "Private voice state request rejected. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId}",
                    this.Context.ConnectionId,
                    userId,
                    spaceId);
                return;
            }

            this._logger.LogDebug(
                "Private voice state requested. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId}",
                this.Context.ConnectionId,
                userId,
                spaceId);
            await this.Clients.Caller.SendAsync(
                "VoiceChannelStateChanged",
                await this._voiceConnections.GetChannelStatePayloadAsync(
                    null,
                    spaceId,
                    VoiceChannelScopes.Private,
                    CancellationToken.None),
                CancellationToken.None);
        }

        public async Task RefreshCurrentVoiceIdentity()
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            var refreshedConnections = await this._voiceConnections
                .RefreshUserIdentityAsync(
                    userId.Value,
                    this.Context.ConnectionAborted);
            foreach (var channel in refreshedConnections
                         .Select(connection => new
                         {
                             connection.ServerId,
                             connection.SpaceId,
                             connection.ChannelScope
                         })
                         .Distinct())
            {
                await this.BroadcastVoiceStateAsync(
                    channel.ServerId,
                    channel.SpaceId,
                    channel.ChannelScope,
                    CancellationToken.None);
            }
        }

        public Task<object?> RenewPrivateVoiceChannelAccessLease(Guid spaceId)
        {
            return this.RenewVoiceAccessLeaseAsync(
                null,
                spaceId,
                VoiceChannelScopes.Private);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await this.UnregisterPresenceAsync();
            var removed = await this._voiceConnections.DisconnectAsync(
                this.Context.ConnectionId);

            if (removed != null)
            {
                await this.SynchronizeRemovedPrivateCallsAsync(
                    [removed],
                    retainedSpaceId: null,
                    endReason: "connection_lost");
                await this.BroadcastVoiceStateAsync(
                    removed.ServerId,
                    removed.SpaceId,
                    removed.ChannelScope,
                    CancellationToken.None);
            }

            if (exception == null)
            {
                this._logger.LogInformation(
                    ObservabilityEventIds.SignalRConnectionClosed,
                    "SignalR connection closed. ConnectionId={ConnectionId}",
                    this.Context.ConnectionId);
            }
            else
            {
                this._logger.LogWarning(
                    ObservabilityEventIds.SignalRConnectionClosed,
                    exception,
                    "SignalR connection closed with error. ConnectionId={ConnectionId}",
                    this.Context.ConnectionId);
            }

            await base.OnDisconnectedAsync(exception);
        }

        private async Task UnregisterPresenceAsync()
        {
            var unregistration = this._connections.Unregister(this.Context.ConnectionId);
            if (unregistration.HasValue)
            {
                await this._presenceCoordinator.ConnectionUnregisteredAsync(
                    unregistration.Value,
                    CancellationToken.None);
            }
        }

        private async Task BroadcastVoiceStateAsync(
            Guid? serverId,
            Guid spaceId,
            string channelScope = VoiceChannelScopes.Server,
            CancellationToken cancellationToken = default)
        {
            if (channelScope == VoiceChannelScopes.Private)
            {
                await this.BroadcastPrivateVoiceStateAsync(spaceId, cancellationToken);
                return;
            }

            if (serverId == null)
            {
                return;
            }

            var legacyRecipients = await this._audience.GetAuthorizedUserIdsAsync(
                serverId.Value,
                spaceId,
                SpaceAction.View,
                cancellationToken);
            var recipients = new List<Guid>(legacyRecipients.Count);
            foreach (var userId in legacyRecipients)
            {
                if (await this._voiceConnections.CanViewVoiceChannelAsync(
                        userId,
                        serverId.Value,
                        spaceId,
                        cancellationToken))
                {
                    recipients.Add(userId);
                }
            }
            await this._realtime.NotifyUsersAsync(
                recipients,
                "VoiceChannelStateChanged",
                await this._voiceConnections.GetChannelStatePayloadAsync(
                    serverId,
                    spaceId,
                    channelScope,
                    cancellationToken),
                cancellationToken);
        }

        private async Task<object?> RenewVoiceAccessLeaseAsync(
            Guid? serverId,
            Guid spaceId,
            string channelScope)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return null;
            }

            var result = await this._voiceConnections.RenewAccessLeaseAsync(
                this.Context.ConnectionId,
                userId.Value,
                serverId,
                spaceId,
                channelScope,
                this.Context.ConnectionAborted);
            if (!result.IsActive)
            {
                if (result.RemovedConnection != null)
                {
                    try
                    {
                        await this.BroadcastVoiceStateAsync(
                            result.RemovedConnection.ServerId,
                            result.RemovedConnection.SpaceId,
                            result.RemovedConnection.ChannelScope,
                            CancellationToken.None);
                    }
                    catch (Exception exception)
                    {
                        this._logger.LogWarning(
                            exception,
                            "Voice roster broadcast failed after access lease denial. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId} ChannelScope={ChannelScope}",
                            this.Context.ConnectionId,
                            userId,
                            serverId,
                            spaceId,
                            channelScope);
                    }


                    if (result.RemovedConnection.ChannelScope ==
                        VoiceChannelScopes.Private)
                    {
                        var transition = await this._voiceConnections
                            .ReconcilePrivateCallPrivacyAsync(
                                result.RemovedConnection.SpaceId,
                                CancellationToken.None) ??
                            await this._voiceConnections.SynchronizePrivateCallAsync(
                                result.RemovedConnection.SpaceId,
                                "privacy_changed",
                                CancellationToken.None);
                        if (transition != null)
                        {
                            await this.BroadcastPrivateCallTransitionAsync(
                                transition,
                                CancellationToken.None);
                        }
                    }
                }

                return null;
            }

            if (result.StateChanged)
            {
                await this.BroadcastVoiceStateAsync(
                    serverId,
                    spaceId,
                    channelScope,
                    CancellationToken.None);
            }

            return await this._voiceConnections.GetChannelStatePayloadAsync(
                serverId,
                spaceId,
                channelScope,
                this.Context.ConnectionAborted);
        }

        private async Task BroadcastPrivateVoiceStateAsync(
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            var userIds = await this._db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(
                    x => x.SpaceId == spaceId &&
                         x.StatusId == PrivateSpaceIds.MemberStatusActive &&
                         x.PrivateSpace.DeletedAt == null &&
                         x.PrivateSpace.Space.DeletedAt == null &&
                         x.User.DeletedAt == null &&
                         x.User.StatusId == UserStatusIds.Active)
                .Select(x => x.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var payload = await this._voiceConnections.GetChannelStatePayloadAsync(
                null,
                spaceId,
                VoiceChannelScopes.Private,
                cancellationToken);

            foreach (var userId in userIds)
            {
                await this.Clients.Group(RealtimeGroups.User(userId)).SendAsync(
                    "VoiceChannelStateChanged",
                    payload,
                    cancellationToken);
            }
        }

        private async Task BroadcastPrivateCallTransitionAsync(
            PrivateCallTransitionResult transition,
            CancellationToken cancellationToken = default)
        {
            var userIds = await this._db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(member =>
                    member.SpaceId == transition.Call.SpaceId &&
                    member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    member.PrivateSpace.DeletedAt == null &&
                    member.PrivateSpace.Space.DeletedAt == null &&
                    member.User.DeletedAt == null &&
                    member.User.StatusId == UserStatusIds.Active)
                .Select(member => member.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            await this._realtime.NotifyUsersAsync(
                userIds,
                RealtimeEventNames.PrivateCallStateChanged,
                transition.Call,
                cancellationToken);
            if (transition.IncomingUserIds.Count > 0)
            {
                var authorizedIncomingUserIds = transition.IncomingUserIds
                    .Where(userIds.Contains)
                    .ToList();
                await this._realtime.NotifyUsersAsync(
                    authorizedIncomingUserIds,
                    RealtimeEventNames.IncomingPrivateCall,
                    transition.Call,
                    cancellationToken);
            }
        }

        private async Task SynchronizeRemovedPrivateCallsAsync(
            IEnumerable<VoiceConnectionSnapshot> removedConnections,
            Guid? retainedSpaceId,
            string endReason)
        {
            var affectedSpaceIds = removedConnections
                .Where(connection =>
                    connection.ChannelScope == VoiceChannelScopes.Private &&
                    connection.SpaceId != retainedSpaceId)
                .Select(connection => connection.SpaceId)
                .Distinct()
                .ToList();
            if (affectedSpaceIds.Count == 0)
            {
                return;
            }

            // The voice mutation has already committed by the time this helper is
            // called. Reconcile every affected call before any client/group send so
            // request cancellation or a failed notification cannot leave a ghost
            // call generation behind.
            var transitions = new List<PrivateCallTransitionResult>();
            foreach (var affectedSpaceId in affectedSpaceIds)
            {
                var transition = await this._voiceConnections
                    .SynchronizePrivateCallAsync(
                        affectedSpaceId,
                        endReason,
                        CancellationToken.None);
                if (transition != null)
                {
                    transitions.Add(transition);
                }
            }

            foreach (var transition in transitions)
            {
                try
                {
                    await this.BroadcastPrivateCallTransitionAsync(
                        transition,
                        CancellationToken.None);
                }
                catch (Exception exception)
                {
                    this._logger.LogWarning(
                        exception,
                        "Private call transition broadcast failed after voice removal. SpaceId={SpaceId} CallId={CallId} EndReason={EndReason}",
                        transition.Call.SpaceId,
                        transition.Call.CallId,
                        endReason);
                }
            }
        }

        private async Task NotifyVoiceConnectionsReplacedBestEffortAsync(
            IEnumerable<VoiceConnectionSnapshot> replacedConnections)
        {
            foreach (var replaced in replacedConnections)
            {
                try
                {
                    await this.Clients.Client(replaced.ConnectionId).SendAsync(
                        "VoiceConnectionReplaced",
                        new
                        {
                            replaced.ServerId,
                            replaced.SpaceId,
                            replaced.ChannelScope,
                            replaced.ParticipantId
                        },
                        CancellationToken.None);
                }
                catch (Exception exception)
                {
                    this._logger.LogWarning(
                        exception,
                        "Voice replacement notification failed after voice join. ConnectionId={ConnectionId} SpaceId={SpaceId} ParticipantId={ParticipantId}",
                        replaced.ConnectionId,
                        replaced.SpaceId,
                        replaced.ParticipantId);
                }
            }
        }

        private async Task BroadcastVoiceJoinStatesBestEffortAsync(
            VoiceJoinResult result)
        {
            var affectedChannels = result.RemovedConnections
                .Concat(result.ReplacedConnections)
                .Select(connection => (
                    connection.ServerId,
                    connection.SpaceId,
                    connection.ChannelScope))
                .Append((result.ServerId, result.SpaceId, result.ChannelScope))
                .Distinct()
                .ToList();

            foreach (var (serverId, spaceId, channelScope) in affectedChannels)
            {
                try
                {
                    await this.BroadcastVoiceStateAsync(
                        serverId,
                        spaceId,
                        channelScope,
                        CancellationToken.None);
                }
                catch (Exception exception)
                {
                    this._logger.LogWarning(
                        exception,
                        "Voice roster broadcast failed after committed join. ServerId={ServerId} SpaceId={SpaceId} ChannelScope={ChannelScope}",
                        serverId,
                        spaceId,
                        channelScope);
                }
            }
        }

        private async Task<bool> ReconcilePrivateCallPrivacyAndBroadcastAsync(
            Guid spaceId)
        {
            var transition = await this._voiceConnections
                .ReconcilePrivateCallPrivacyAsync(
                    spaceId,
                    CancellationToken.None);
            if (transition == null)
            {
                return false;
            }

            await this.BroadcastPrivateCallTransitionAsync(
                transition,
                CancellationToken.None);
            await this.BroadcastPrivateVoiceStateAsync(
                spaceId,
                CancellationToken.None);
            return true;
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = this.Context.User?.FindFirstValue("userId");
            return Guid.TryParse(userIdValue, out var userId) ? userId : null;
        }

        private Task<bool> IsActiveServerMemberAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return this._db.ServerMembers
                .AsNoTracking()
                .AnyAsync(
                    x => x.ServerId == serverId &&
                         x.UserId == userId &&
                         x.StatusId == ServerMemberStatusIds.Active &&
                         x.BannedAt == null &&
                         x.Server.DeletedAt == null &&
                         x.User.DeletedAt == null &&
                         x.User.StatusId == UserStatusIds.Active,
                    cancellationToken);
        }
    }
}
