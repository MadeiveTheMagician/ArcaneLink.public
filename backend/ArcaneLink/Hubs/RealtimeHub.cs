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
            _db = db;
            _voiceConnections = voiceConnections;
            _realtime = realtime;
            _audience = audience;
            _connections = connections;
            _presenceCoordinator = presenceCoordinator;
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                var userId = GetCurrentUserId();
                if (userId != null)
                {
                    await Groups.AddToGroupAsync(
                        Context.ConnectionId,
                        RealtimeGroups.User(userId.Value));

                    var serverIds = await _db.ServerMembers
                        .AsNoTracking()
                        .Where(
                            x => x.UserId == userId.Value &&
                                 x.StatusId == ServerMemberStatusIds.Active &&
                                 x.BannedAt == null &&
                                 x.Server.DeletedAt == null &&
                                 x.User.DeletedAt == null &&
                                 x.User.StatusId == UserStatusIds.Active)
                        .Select(x => x.ServerId)
                        .ToListAsync(Context.ConnectionAborted);

                    foreach (var serverId in serverIds)
                    {
                        await Groups.AddToGroupAsync(
                            Context.ConnectionId,
                            RealtimeGroups.Server(serverId));
                    }

                    var registration = _connections.Register(
                        userId.Value,
                        Context.ConnectionId);
                    await _presenceCoordinator.ConnectionRegisteredAsync(
                        registration,
                        CancellationToken.None);

                    var incomingCalls = await _voiceConnections
                        .GetIncomingPrivateCallsAsync(
                            userId.Value,
                            CancellationToken.None);
                    foreach (var incomingCall in incomingCalls)
                    {
                        await Clients.Caller.SendAsync(
                            RealtimeEventNames.IncomingPrivateCall,
                            incomingCall,
                            CancellationToken.None);
                    }
                }

                _logger.LogInformation(
                    ObservabilityEventIds.SignalRConnectionOpened,
                    "SignalR connection opened. ConnectionId={ConnectionId} UserId={UserId}",
                    Context.ConnectionId,
                    userId);

                await base.OnConnectedAsync();
            }
            catch (OperationCanceledException) when (Context.ConnectionAborted.IsCancellationRequested)
            {
                await UnregisterPresenceAsync();
                _logger.LogDebug(
                    "Realtime connection setup canceled because the client disconnected. ConnectionId={ConnectionId}",
                    Context.ConnectionId);
            }
            catch
            {
                await UnregisterPresenceAsync();
                throw;
            }
        }

        public async Task JoinServer(Guid serverId)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            if (!await IsActiveServerMemberAsync(
                    userId.Value,
                    serverId,
                    Context.ConnectionAborted))
            {
                await Groups.RemoveFromGroupAsync(
                    Context.ConnectionId,
                    RealtimeGroups.Server(serverId));
                return;
            }

            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                RealtimeGroups.Server(serverId));

            if (!await IsActiveServerMemberAsync(
                    userId.Value,
                    serverId,
                    Context.ConnectionAborted))
            {
                await Groups.RemoveFromGroupAsync(
                    Context.ConnectionId,
                    RealtimeGroups.Server(serverId));
            }
        }

        public async Task LeaveServer(Guid serverId)
        {
            await Groups.RemoveFromGroupAsync(
                Context.ConnectionId,
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
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                ArcaneLinkDiagnostics.VoiceJoinFailedCounter.Add(1);
                _logger.LogWarning(
                    ObservabilityEventIds.VoiceJoinFailed,
                    "Voice join rejected. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                    Context.ConnectionId,
                    userId,
                    serverId,
                    spaceId);
                return null;
            }

            _logger.LogInformation(
                ObservabilityEventIds.VoiceJoinStarted,
                "Voice join started. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId} IsMuted={IsMuted} IsDeafened={IsDeafened} IsCameraEnabled={IsCameraEnabled} IsScreenSharing={IsScreenSharing}",
                Context.ConnectionId,
                userId,
                serverId,
                spaceId,
                isMuted,
                isDeafened,
                isCameraEnabled,
                isScreenSharing);

            var result = await _voiceConnections.JoinAsync(
                Context.ConnectionId,
                userId.Value,
                serverId,
                spaceId,
                new VoiceStateUpdate(
                    isMuted,
                    isDeafened,
                    isCameraEnabled,
                    isScreenSharing),
                Context.ConnectionAborted);

            if (result == null)
            {
                ArcaneLinkDiagnostics.VoiceJoinFailedCounter.Add(1);
                _logger.LogWarning(
                    ObservabilityEventIds.VoiceJoinFailed,
                    "Voice join failed. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                    Context.ConnectionId,
                    userId,
                    serverId,
                    spaceId);
                return null;
            }

            await SynchronizeRemovedPrivateCallsAsync(
                result.RemovedConnections.Concat(result.ReplacedConnections),
                result.SpaceId,
                "participant_moved");
            await NotifyVoiceConnectionsReplacedBestEffortAsync(
                result.ReplacedConnections);
            await BroadcastVoiceJoinStatesBestEffortAsync(result);
            try
            {
                await JoinServer(serverId);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Server group join failed after committed voice join. ConnectionId={ConnectionId} ServerId={ServerId} SpaceId={SpaceId}",
                    Context.ConnectionId,
                    serverId,
                    spaceId);
            }
            _logger.LogInformation(
                ObservabilityEventIds.VoiceJoinSucceeded,
                "Voice join succeeded. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId} ReplacedConnections={ReplacedConnectionCount} RemovedConnections={RemovedConnectionCount}",
                Context.ConnectionId,
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
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                ArcaneLinkDiagnostics.VoiceJoinFailedCounter.Add(1);
                _logger.LogWarning(
                    ObservabilityEventIds.VoiceJoinFailed,
                    "Private voice join rejected. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId}",
                    Context.ConnectionId,
                    userId,
                    spaceId);
                return null;
            }

            _logger.LogInformation(
                ObservabilityEventIds.VoiceJoinStarted,
                "Private voice join started. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId} IsMuted={IsMuted} IsDeafened={IsDeafened} IsCameraEnabled={IsCameraEnabled} IsScreenSharing={IsScreenSharing}",
                Context.ConnectionId,
                userId,
                spaceId,
                isMuted,
                isDeafened,
                isCameraEnabled,
                isScreenSharing);

            if (await ReconcilePrivateCallPrivacyAndBroadcastAsync(spaceId))
            {
                return null;
            }

            var result = await _voiceConnections.RejoinPrivateCallAsync(
                Context.ConnectionId,
                userId.Value,
                spaceId,
                new VoiceStateUpdate(
                    isMuted,
                    isDeafened,
                    isCameraEnabled,
                    isScreenSharing),
                Context.ConnectionAborted);
            if (result == null)
            {
                await ReconcilePrivateCallPrivacyAndBroadcastAsync(spaceId);
                return null;
            }

            await HandlePrivateVoiceJoinAsync(result.Voice);
            var synchronized = await _voiceConnections.SynchronizePrivateCallAsync(
                spaceId,
                cancellationToken: CancellationToken.None);
            if (synchronized != null)
            {
                await BroadcastPrivateCallTransitionAsync(synchronized);
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
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return null;
            }

            var result = await _voiceConnections.StartPrivateCallAsync(
                Context.ConnectionId,
                userId.Value,
                spaceId,
                new VoiceStateUpdate(
                    isMuted,
                    isDeafened,
                    isCameraEnabled,
                    isScreenSharing),
                Context.ConnectionAborted);

            if (result == null)
            {
                ArcaneLinkDiagnostics.VoiceJoinFailedCounter.Add(1);
                _logger.LogWarning(
                    ObservabilityEventIds.VoiceJoinFailed,
                    "Private voice join failed. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId}",
                    Context.ConnectionId,
                    userId,
                    spaceId);
                return null;
            }

            await HandlePrivateVoiceJoinAsync(result.Voice);
            await BroadcastPrivateCallTransitionAsync(
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
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return null;
            }

            if (await ReconcilePrivateCallPrivacyAndBroadcastAsync(spaceId))
            {
                return null;
            }

            var result = await _voiceConnections.AcceptPrivateCallAsync(
                Context.ConnectionId,
                userId.Value,
                spaceId,
                callId,
                new VoiceStateUpdate(
                    isMuted,
                    isDeafened,
                    isCameraEnabled,
                    isScreenSharing),
                Context.ConnectionAborted);
            if (result == null)
            {
                await ReconcilePrivateCallPrivacyAndBroadcastAsync(spaceId);
                return null;
            }

            await HandlePrivateVoiceJoinAsync(result.Voice);
            await BroadcastPrivateCallTransitionAsync(
                new PrivateCallTransitionResult(result.Call, []));
            return result;
        }

        public async Task<bool> DeclinePrivateCall(Guid spaceId, Guid callId)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return false;
            }

            var result = await _voiceConnections.DeclinePrivateCallAsync(
                userId.Value,
                spaceId,
                callId,
                Context.ConnectionAborted);
            if (result == null)
            {
                return false;
            }

            await BroadcastPrivateCallTransitionAsync(result);
            if (result.Call.Phase == PrivateCallPhases.Ended)
            {
                await BroadcastPrivateVoiceStateAsync(spaceId);
            }
            return true;
        }

        public async Task<bool> CancelPrivateCall(Guid spaceId, Guid callId)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return false;
            }

            var result = await _voiceConnections.CancelPrivateCallAsync(
                userId.Value,
                spaceId,
                callId,
                Context.ConnectionAborted);
            if (result == null)
            {
                return false;
            }

            await BroadcastPrivateCallTransitionAsync(
                result,
                CancellationToken.None);
            await BroadcastPrivateVoiceStateAsync(
                spaceId,
                CancellationToken.None);
            return true;
        }

        public Task<PrivateCallState?> GetPrivateCallState(Guid spaceId)
        {
            var userId = GetCurrentUserId();
            return userId == null
                ? Task.FromResult<PrivateCallState?>(null)
                : _voiceConnections.GetPrivateCallStateAsync(
                    userId.Value,
                    spaceId,
                    Context.ConnectionAborted);
        }

        public Task<IReadOnlyList<PrivateCallState>> GetIncomingPrivateCalls()
        {
            var userId = GetCurrentUserId();
            return userId == null
                ? Task.FromResult<IReadOnlyList<PrivateCallState>>([])
                : _voiceConnections.GetIncomingPrivateCallsAsync(
                    userId.Value,
                    Context.ConnectionAborted);
        }

        private async Task HandlePrivateVoiceJoinAsync(VoiceJoinResult result)
        {
            await SynchronizeRemovedPrivateCallsAsync(
                result.RemovedConnections.Concat(result.ReplacedConnections),
                result.SpaceId,
                "participant_moved");
            await NotifyVoiceConnectionsReplacedBestEffortAsync(
                result.ReplacedConnections);
            await BroadcastVoiceJoinStatesBestEffortAsync(result);
            _logger.LogInformation(
                ObservabilityEventIds.VoiceJoinSucceeded,
                "Private voice join succeeded. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId} ParticipantId={ParticipantId} ReplacedConnections={ReplacedConnectionCount} RemovedConnections={RemovedConnectionCount}",
                Context.ConnectionId,
                result.UserId,
                result.SpaceId,
                result.ParticipantId,
                result.ReplacedConnections.Count,
                result.RemovedConnections.Count);
        }

        public async Task LeaveVoiceChannel(Guid spaceId)
        {
            var removed = await _voiceConnections.LeaveAsync(
                Context.ConnectionId,
                spaceId,
                Context.ConnectionAborted);

            if (removed != null)
            {
                await SynchronizeRemovedPrivateCallsAsync(
                    [removed],
                    retainedSpaceId: null,
                    endReason: "participant_left");
                try
                {
                    await BroadcastVoiceStateAsync(
                        removed.ServerId,
                        removed.SpaceId,
                        removed.ChannelScope,
                        CancellationToken.None);
                }
                catch (Exception exception)
                {
                    _logger.LogWarning(
                        exception,
                        "Voice roster broadcast failed after committed leave. ServerId={ServerId} SpaceId={SpaceId} ChannelScope={ChannelScope}",
                        removed.ServerId,
                        removed.SpaceId,
                        removed.ChannelScope);
                }
                _logger.LogInformation(
                    ObservabilityEventIds.VoiceLeaveCompleted,
                    "Voice leave completed. ConnectionId={ConnectionId} ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId}",
                    Context.ConnectionId,
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
            var result = await _voiceConnections.UpdateStateAsync(
                Context.ConnectionId,
                spaceId,
                new VoiceStateUpdate(
                    isMuted,
                    isDeafened,
                    isCameraEnabled,
                    isScreenSharing),
                participantId,
                Context.ConnectionAborted);

            if (result != null)
            {
                await BroadcastVoiceStateAsync(
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
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            var result = await _voiceConnections.MoveParticipantAsync(
                userId.Value,
                serverId,
                sourceSpaceId,
                targetSpaceId,
                participantId,
                Context.ConnectionAborted);

            if (result == null)
            {
                return;
            }

            var targetTitle = await _db.Spaces
                .AsNoTracking()
                .Where(x =>
                    x.Id == targetSpaceId &&
                    x.ServerId == serverId &&
                    x.TypeId == SpaceIds.TypeVoiceRoom &&
                    x.DeletedAt == null)
                .Select(x => x.Title)
                .FirstOrDefaultAsync(Context.ConnectionAborted);
            if (string.IsNullOrWhiteSpace(targetTitle))
            {
                return;
            }

            await Clients.Client(result.MovedConnection.ConnectionId).SendAsync(
                "VoiceParticipantMoved",
                new
                {
                    result.MovedConnection.ServerId,
                    result.PreviousConnection.SpaceId,
                    targetSpaceId = result.MovedConnection.SpaceId,
                    title = targetTitle,
                    result.MovedConnection.ParticipantId
                },
                Context.ConnectionAborted);

            await BroadcastVoiceStateAsync(
                result.PreviousConnection.ServerId,
                result.PreviousConnection.SpaceId,
                result.PreviousConnection.ChannelScope);
            await BroadcastVoiceStateAsync(
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
            var actorUserId = GetCurrentUserId();
            if (actorUserId == null)
            {
                return false;
            }

            var result = await _voiceConnections.UpdateParticipantModerationAsync(
                actorUserId.Value,
                serverId,
                spaceId,
                participantId,
                isServerMuted,
                isServerDeafened,
                Context.ConnectionAborted);
            if (result == null)
            {
                return false;
            }

            await BroadcastVoiceStateAsync(
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
            var actorUserId = GetCurrentUserId();
            if (actorUserId == null)
            {
                return false;
            }

            var removed = await _voiceConnections.DisconnectParticipantAsync(
                actorUserId.Value,
                serverId,
                spaceId,
                participantId,
                Context.ConnectionAborted);
            if (removed == null)
            {
                return false;
            }

            try
            {
                await Clients.Client(removed.ConnectionId).SendAsync(
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
                _logger.LogWarning(
                    exception,
                    "Voice disconnect notification failed after participant removal. ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId}",
                    serverId,
                    spaceId,
                    participantId);
            }

            try
            {
                await BroadcastVoiceStateAsync(
                    removed.ServerId,
                    removed.SpaceId,
                    removed.ChannelScope,
                    CancellationToken.None);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
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
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                _logger.LogDebug(
                    "Voice signal ignored because user is missing. ConnectionId={ConnectionId} SpaceId={SpaceId} TargetUserId={TargetUserId} Kind={Kind}",
                    Context.ConnectionId,
                    spaceId,
                    targetParticipantId,
                    kind);
                return;
            }

            if (!AllowedVoiceSignalKinds.Contains(kind) ||
                string.IsNullOrWhiteSpace(payload) ||
                payload.Length > MaxVoiceSignalPayloadLength)
            {
                _logger.LogWarning(
                    "Voice signal rejected. ConnectionId={ConnectionId} SpaceId={SpaceId} TargetParticipantId={TargetParticipantId} Kind={Kind} PayloadLength={PayloadLength}",
                    Context.ConnectionId,
                    spaceId,
                    targetParticipantId,
                    kind,
                    payload?.Length ?? 0);
                return;
            }

            var route = await _voiceConnections.GetSignalRouteAsync(
                Context.ConnectionId,
                userId.Value,
                spaceId,
                targetParticipantId,
                Context.ConnectionAborted);

            if (route == null)
            {
                return;
            }

            if (targetParticipantId == route.Sender.ParticipantId)
            {
                _logger.LogDebug(
                    "Voice signal ignored because target is sender. ConnectionId={ConnectionId} UserId={UserId} ParticipantId={ParticipantId} SpaceId={SpaceId} Kind={Kind}",
                    Context.ConnectionId,
                    route.Sender.UserId,
                    route.Sender.ParticipantId,
                    spaceId,
                    kind);
                return;
            }

            _logger.LogInformation(
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
                await Clients.Client(connectionId).SendAsync(
                    "VoiceSignal",
                    new
                    {
                        spaceId,
                        fromUserId = route.Sender.UserId,
                        fromParticipantId = route.Sender.ParticipantId,
                        kind,
                        payload
                    },
                    Context.ConnectionAborted);
            }
        }

        public async Task GetVoiceChannelState(Guid serverId, Guid spaceId)
        {
            var userId = GetCurrentUserId();
            if (userId == null ||
                !await _voiceConnections.CanViewVoiceChannelAsync(
                    userId.Value,
                    serverId,
                    spaceId,
                    CancellationToken.None))
            {
                _logger.LogWarning(
                    "Voice state request rejected. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                    Context.ConnectionId,
                    userId,
                    serverId,
                    spaceId);
                return;
            }

            _logger.LogDebug(
                "Voice state requested. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                Context.ConnectionId,
                userId,
                serverId,
                spaceId);
            await Clients.Caller.SendAsync(
                "VoiceChannelStateChanged",
                await _voiceConnections.GetChannelStatePayloadAsync(
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
            return RenewVoiceAccessLeaseAsync(
                serverId,
                spaceId,
                VoiceChannelScopes.Server);
        }

        public async Task GetPrivateVoiceChannelState(Guid spaceId)
        {
            var userId = GetCurrentUserId();
            if (userId == null ||
                !await _voiceConnections.CanUsePrivateVoiceChannelAsync(
                    userId.Value,
                    spaceId,
                    CancellationToken.None))
            {
                _logger.LogWarning(
                    "Private voice state request rejected. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId}",
                    Context.ConnectionId,
                    userId,
                    spaceId);
                return;
            }

            _logger.LogDebug(
                "Private voice state requested. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId}",
                Context.ConnectionId,
                userId,
                spaceId);
            await Clients.Caller.SendAsync(
                "VoiceChannelStateChanged",
                await _voiceConnections.GetChannelStatePayloadAsync(
                    null,
                    spaceId,
                    VoiceChannelScopes.Private,
                    CancellationToken.None),
                CancellationToken.None);
        }

        public async Task RefreshCurrentVoiceIdentity()
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return;
            }

            var refreshedConnections = await _voiceConnections
                .RefreshUserIdentityAsync(
                    userId.Value,
                    Context.ConnectionAborted);
            foreach (var channel in refreshedConnections
                         .Select(connection => new
                         {
                             connection.ServerId,
                             connection.SpaceId,
                             connection.ChannelScope
                         })
                         .Distinct())
            {
                await BroadcastVoiceStateAsync(
                    channel.ServerId,
                    channel.SpaceId,
                    channel.ChannelScope,
                    CancellationToken.None);
            }
        }

        public Task<object?> RenewPrivateVoiceChannelAccessLease(Guid spaceId)
        {
            return RenewVoiceAccessLeaseAsync(
                null,
                spaceId,
                VoiceChannelScopes.Private);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await UnregisterPresenceAsync();
            var removed = await _voiceConnections.DisconnectAsync(
                Context.ConnectionId);

            if (removed != null)
            {
                await SynchronizeRemovedPrivateCallsAsync(
                    [removed],
                    retainedSpaceId: null,
                    endReason: "connection_lost");
                await BroadcastVoiceStateAsync(
                    removed.ServerId,
                    removed.SpaceId,
                    removed.ChannelScope,
                    CancellationToken.None);
            }

            if (exception == null)
            {
                _logger.LogInformation(
                    ObservabilityEventIds.SignalRConnectionClosed,
                    "SignalR connection closed. ConnectionId={ConnectionId}",
                    Context.ConnectionId);
            }
            else
            {
                _logger.LogWarning(
                    ObservabilityEventIds.SignalRConnectionClosed,
                    exception,
                    "SignalR connection closed with error. ConnectionId={ConnectionId}",
                    Context.ConnectionId);
            }

            await base.OnDisconnectedAsync(exception);
        }

        private async Task UnregisterPresenceAsync()
        {
            var unregistration = _connections.Unregister(Context.ConnectionId);
            if (unregistration.HasValue)
            {
                await _presenceCoordinator.ConnectionUnregisteredAsync(
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
                await BroadcastPrivateVoiceStateAsync(spaceId, cancellationToken);
                return;
            }

            if (serverId == null)
            {
                return;
            }

            var legacyRecipients = await _audience.GetAuthorizedUserIdsAsync(
                serverId.Value,
                spaceId,
                SpaceAction.View,
                cancellationToken);
            var recipients = new List<Guid>(legacyRecipients.Count);
            foreach (var userId in legacyRecipients)
            {
                if (await _voiceConnections.CanViewVoiceChannelAsync(
                        userId,
                        serverId.Value,
                        spaceId,
                        cancellationToken))
                {
                    recipients.Add(userId);
                }
            }
            await _realtime.NotifyUsersAsync(
                recipients,
                "VoiceChannelStateChanged",
                await _voiceConnections.GetChannelStatePayloadAsync(
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
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return null;
            }

            var result = await _voiceConnections.RenewAccessLeaseAsync(
                Context.ConnectionId,
                userId.Value,
                serverId,
                spaceId,
                channelScope,
                Context.ConnectionAborted);
            if (!result.IsActive)
            {
                if (result.RemovedConnection != null)
                {
                    try
                    {
                        await BroadcastVoiceStateAsync(
                            result.RemovedConnection.ServerId,
                            result.RemovedConnection.SpaceId,
                            result.RemovedConnection.ChannelScope,
                            CancellationToken.None);
                    }
                    catch (Exception exception)
                    {
                        _logger.LogWarning(
                            exception,
                            "Voice roster broadcast failed after access lease denial. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId} ChannelScope={ChannelScope}",
                            Context.ConnectionId,
                            userId,
                            serverId,
                            spaceId,
                            channelScope);
                    }


                    if (result.RemovedConnection.ChannelScope ==
                        VoiceChannelScopes.Private)
                    {
                        var transition = await _voiceConnections
                            .ReconcilePrivateCallPrivacyAsync(
                                result.RemovedConnection.SpaceId,
                                CancellationToken.None) ??
                            await _voiceConnections.SynchronizePrivateCallAsync(
                                result.RemovedConnection.SpaceId,
                                "privacy_changed",
                                CancellationToken.None);
                        if (transition != null)
                        {
                            await BroadcastPrivateCallTransitionAsync(
                                transition,
                                CancellationToken.None);
                        }
                    }
                }

                return null;
            }

            if (result.StateChanged)
            {
                await BroadcastVoiceStateAsync(
                    serverId,
                    spaceId,
                    channelScope,
                    CancellationToken.None);
            }

            return await _voiceConnections.GetChannelStatePayloadAsync(
                serverId,
                spaceId,
                channelScope,
                Context.ConnectionAborted);
        }

        private async Task BroadcastPrivateVoiceStateAsync(
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            var userIds = await _db.PrivateSpaceMembers
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

            var payload = await _voiceConnections.GetChannelStatePayloadAsync(
                null,
                spaceId,
                VoiceChannelScopes.Private,
                cancellationToken);

            foreach (var userId in userIds)
            {
                await Clients.Group(RealtimeGroups.User(userId)).SendAsync(
                    "VoiceChannelStateChanged",
                    payload,
                    cancellationToken);
            }
        }

        private async Task BroadcastPrivateCallTransitionAsync(
            PrivateCallTransitionResult transition,
            CancellationToken cancellationToken = default)
        {
            var userIds = await _db.PrivateSpaceMembers
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

            await _realtime.NotifyUsersAsync(
                userIds,
                RealtimeEventNames.PrivateCallStateChanged,
                transition.Call,
                cancellationToken);
            if (transition.IncomingUserIds.Count > 0)
            {
                var authorizedIncomingUserIds = transition.IncomingUserIds
                    .Where(userIds.Contains)
                    .ToList();
                await _realtime.NotifyUsersAsync(
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
                var transition = await _voiceConnections
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
                    await BroadcastPrivateCallTransitionAsync(
                        transition,
                        CancellationToken.None);
                }
                catch (Exception exception)
                {
                    _logger.LogWarning(
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
                    await Clients.Client(replaced.ConnectionId).SendAsync(
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
                    _logger.LogWarning(
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
                    await BroadcastVoiceStateAsync(
                        serverId,
                        spaceId,
                        channelScope,
                        CancellationToken.None);
                }
                catch (Exception exception)
                {
                    _logger.LogWarning(
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
            var transition = await _voiceConnections
                .ReconcilePrivateCallPrivacyAsync(
                    spaceId,
                    CancellationToken.None);
            if (transition == null)
            {
                return false;
            }

            await BroadcastPrivateCallTransitionAsync(
                transition,
                CancellationToken.None);
            await BroadcastPrivateVoiceStateAsync(
                spaceId,
                CancellationToken.None);
            return true;
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = Context.User?.FindFirstValue("userId");
            return Guid.TryParse(userIdValue, out var userId) ? userId : null;
        }

        private Task<bool> IsActiveServerMemberAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return _db.ServerMembers
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
