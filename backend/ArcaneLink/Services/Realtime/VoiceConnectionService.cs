using System.Collections.Concurrent;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Servers.Authorization.Abstractions;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Realtime
{
    public class VoiceConnectionService : IVoiceConnectionService
    {
        private const string ViewVoiceSpacesPermission = "VIEW_VOICE_SPACES";
        private const string ConnectVoicePermission = "CONNECT_VOICE";
        private const string SpeakInVoicePermission = "SPEAK_IN_VOICE";
        private const string UseVideoPermission = "USE_VIDEO";
        private const string ShareScreenPermission = "SHARE_SCREEN";
        private const string MuteVoiceMembersPermission = "MUTE_VOICE_MEMBERS";
        private const string DeafenVoiceMembersPermission = "DEAFEN_VOICE_MEMBERS";
        private const string MoveVoiceMembersPermission = "MOVE_VOICE_MEMBERS";
        private const string DisconnectVoiceMembersPermission = "DISCONNECT_VOICE_MEMBERS";

        private static readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, VoiceConnectionState>> VoiceConnections = new();
        private static readonly ConcurrentDictionary<(Guid ServerId, Guid UserId), VoiceServerModerationState> ServerModerationStates = new();
        private static readonly SemaphoreSlim VoiceConnectionsGate = new(1, 1);

        private readonly AppDbContext _db;
        private readonly ISpaceAuthorizationService _spaceAuthorization;
        private readonly IServerAuthorizationRuntime? _serverAuthorization;
        private readonly ILogger<VoiceConnectionService> _logger;

        public VoiceConnectionService(
            AppDbContext db,
            ISpaceAuthorizationService spaceAuthorization,
            ILogger<VoiceConnectionService> logger,
            IServerAuthorizationRuntime? serverAuthorization = null)
        {
            _db = db;
            _spaceAuthorization = spaceAuthorization;
            _logger = logger;
            _serverAuthorization = serverAuthorization;
        }

        public async Task<VoiceJoinResult?> JoinAsync(
            string connectionId,
            Guid userId,
            Guid serverId,
            Guid spaceId,
            VoiceStateUpdate state,
            CancellationToken cancellationToken = default)
        {
            if (!await CanUseVoiceChannelAsync(userId, serverId, spaceId, cancellationToken))
            {
                _logger.LogWarning(
                    "Voice join rejected. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                    connectionId,
                    userId,
                    serverId,
                    spaceId);
                return null;
            }

            var mediaCapabilities = await GetServerVoiceMediaCapabilitiesAsync(
                userId,
                serverId,
                spaceId,
                cancellationToken);

            var user = await GetActiveUserAsync(
                userId,
                serverId,
                cancellationToken);

            if (user == null)
            {
                _logger.LogWarning(
                    "Voice join rejected because user was not active. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                    connectionId,
                    userId,
                    serverId,
                    spaceId);
                return null;
            }

            return await JoinAccessibleChannelAsync(
                connectionId,
                user,
                serverId,
                spaceId,
                VoiceChannelScopes.Server,
                SanitizeState(state, mediaCapabilities),
                mediaCapabilities,
                cancellationToken);
        }

        public async Task<VoiceJoinResult?> JoinPrivateSpaceAsync(
            string connectionId,
            Guid userId,
            Guid spaceId,
            VoiceStateUpdate state,
            CancellationToken cancellationToken = default)
        {
            if (!await CanUsePrivateVoiceChannelAsync(userId, spaceId, cancellationToken))
            {
                _logger.LogWarning(
                    "Private voice join rejected. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId}",
                    connectionId,
                    userId,
                    spaceId);
                return null;
            }

            var user = await GetActiveUserAsync(
                userId,
                serverId: null,
                cancellationToken);

            if (user == null)
            {
                _logger.LogWarning(
                    "Private voice join rejected because user was not active. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId}",
                    connectionId,
                    userId,
                    spaceId);
                return null;
            }

            return await JoinAccessibleChannelAsync(
                connectionId,
                user,
                null,
                spaceId,
                VoiceChannelScopes.Private,
                state,
                VoiceMediaCapabilities.PrivateVoice,
                cancellationToken);
        }

        private async Task<VoiceJoinResult> JoinAccessibleChannelAsync(
            string connectionId,
            ArcaneLink.DataBase.Models.UsersModels.User user,
            Guid? serverId,
            Guid spaceId,
            string channelScope,
            VoiceStateUpdate state,
            VoiceMediaCapabilities mediaCapabilities,
            CancellationToken cancellationToken)
        {
            var participantId = Guid.NewGuid();
            var removedConnections = new List<VoiceConnectionSnapshot>();
            var replacedConnections = new List<VoiceConnectionSnapshot>();
            var participantCount = 0;

            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                removedConnections = RemoveVoiceConnections(connectionId)
                    .Select(ToSnapshot)
                    .ToList();
                replacedConnections = RemoveVoiceConnectionsForUser(user.Id, exceptConnectionId: connectionId)
                    .Select(ToSnapshot)
                    .ToList();

                var channel = VoiceConnections.GetOrAdd(
                    spaceId,
                    _ => new ConcurrentDictionary<string, VoiceConnectionState>());
                var serverModeration = serverId.HasValue
                    ? ServerModerationStates.GetValueOrDefault((serverId.Value, user.Id))
                    : null;

                channel[connectionId] = new VoiceConnectionState(
                    connectionId,
                    participantId,
                    serverId,
                    spaceId,
                    channelScope,
                    user.Id,
                    user.Login,
                    ResolveDisplayName(user, serverId),
                    state.IsMuted,
                    state.IsDeafened,
                    serverModeration?.IsServerMuted == true,
                    serverModeration?.IsServerDeafened == true,
                    state.IsCameraEnabled,
                    state.IsScreenSharing,
                    mediaCapabilities.CanSpeak,
                    mediaCapabilities.CanUseVideo,
                    mediaCapabilities.CanShareScreen,
                    DateTime.UtcNow);
                participantCount = channel.Values.Select(x => x.UserId).Distinct().Count();
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            _logger.LogInformation(
                "Voice joined. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId} Scope={ChannelScope} Participants={ParticipantCount} RemovedConnections={RemovedConnectionCount} ReplacedConnections={ReplacedConnectionCount} Muted={IsMuted} Deafened={IsDeafened}",
                connectionId,
                user.Id,
                serverId,
                spaceId,
                channelScope,
                participantCount,
                removedConnections.Count,
                replacedConnections.Count,
                state.IsMuted,
                state.IsDeafened);

            return new VoiceJoinResult(
                participantId,
                user.Id,
                serverId,
                spaceId,
                channelScope,
                participantCount,
                removedConnections,
                replacedConnections);
        }

        private async Task<ArcaneLink.DataBase.Models.UsersModels.User?> GetActiveUserAsync(
            Guid userId,
            Guid? serverId,
            CancellationToken cancellationToken)
        {
            var query = _db.Users
                .AsNoTracking()
                .Include(x => x.Profile)
                .AsQueryable();
            if (serverId.HasValue)
            {
                query = query
                    .Include(user => user.ServerMemberships
                        .Where(member => member.ServerId == serverId.Value))
                    .ThenInclude(member => member.ServerProfile);
            }

            return await query.FirstOrDefaultAsync(
                    x => x.Id == userId &&
                         x.DeletedAt == null &&
                         x.StatusId == UserStatusIds.Active,
                    cancellationToken);
        }

        private static string ResolveDisplayName(
            ArcaneLink.DataBase.Models.UsersModels.User user,
            Guid? serverId)
        {
            if (!serverId.HasValue)
            {
                return user.Profile.DisplayName;
            }

            return user.ServerMemberships
                       .FirstOrDefault(member => member.ServerId == serverId.Value)
                       ?.ServerProfile
                       ?.DisplayName ??
                   user.Profile.DisplayName;
        }

        public async Task<VoiceConnectionSnapshot?> LeaveAsync(
            string connectionId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            VoiceConnectionSnapshot? removed;
            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                removed = RemoveVoiceConnection(connectionId, spaceId) is { } connection
                    ? ToSnapshot(connection)
                    : null;
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (removed != null)
            {
                _logger.LogInformation(
                    "Voice left. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                    connectionId,
                    removed.UserId,
                    removed.ServerId,
                    removed.SpaceId);
            }

            return removed;
        }

        public async Task<VoiceStateUpdateResult?> UpdateStateAsync(
            string connectionId,
            Guid spaceId,
            VoiceStateUpdate state,
            CancellationToken cancellationToken = default)
        {
            VoiceConnectionState? current;

            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (!VoiceConnections.TryGetValue(spaceId, out var channel) ||
                    !channel.TryGetValue(connectionId, out current))
                {
                    current = null;
                }
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (current == null ||
                !await CanUseConnectionAsync(current, cancellationToken))
            {
                _logger.LogDebug(
                    "Voice state update ignored because connection is not in channel or no longer authorized. ConnectionId={ConnectionId} SpaceId={SpaceId}",
                    connectionId,
                    spaceId);
                return null;
            }

            var mediaCapabilities = current.ChannelScope == VoiceChannelScopes.Private
                ? VoiceMediaCapabilities.PrivateVoice
                : await GetServerVoiceMediaCapabilitiesAsync(
                    current.UserId,
                    current.ServerId!.Value,
                    current.SpaceId,
                    cancellationToken);
            var sanitizedState = SanitizeState(state, mediaCapabilities);

            VoiceConnectionState? updated = null;
            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (VoiceConnections.TryGetValue(spaceId, out var channel) &&
                    channel.TryGetValue(connectionId, out var latest) &&
                    latest.ParticipantId == current.ParticipantId)
                {
                    updated = latest with
                    {
                        IsMuted = sanitizedState.IsMuted,
                        IsDeafened = sanitizedState.IsDeafened,
                        IsCameraEnabled = sanitizedState.IsCameraEnabled,
                        IsScreenSharing = sanitizedState.IsScreenSharing,
                        CanSpeak = mediaCapabilities.CanSpeak,
                        CanUseVideo = mediaCapabilities.CanUseVideo,
                        CanShareScreen = mediaCapabilities.CanShareScreen
                    };
                    channel[connectionId] = updated;
                }
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (updated == null)
            {
                return null;
            }

            _logger.LogInformation(
                "Voice state updated. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId} Muted={IsMuted} Deafened={IsDeafened} Camera={IsCameraEnabled} Screen={IsScreenSharing}",
                connectionId,
                updated.UserId,
                spaceId,
                sanitizedState.IsMuted,
                sanitizedState.IsDeafened,
                sanitizedState.IsCameraEnabled,
                sanitizedState.IsScreenSharing);

            return new VoiceStateUpdateResult(ToSnapshot(updated), sanitizedState);
        }

        public async Task<VoiceMoveResult?> MoveParticipantAsync(
            Guid actorUserId,
            Guid serverId,
            Guid sourceSpaceId,
            Guid targetSpaceId,
            Guid participantId,
            CancellationToken cancellationToken = default)
        {
            if (sourceSpaceId == targetSpaceId)
            {
                return null;
            }

            VoiceConnectionState? candidate = null;
            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (VoiceConnections.TryGetValue(sourceSpaceId, out var sourceChannel))
                {
                    candidate = sourceChannel.Values.FirstOrDefault(x =>
                        x.ParticipantId == participantId &&
                        x.ServerId == serverId &&
                        x.ChannelScope == VoiceChannelScopes.Server);
                }
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (candidate == null ||
                !await CanModerateServerVoiceParticipantAsync(
                    actorUserId,
                    serverId,
                    candidate.UserId,
                    cancellationToken) ||
                !await HasExactSpacePermissionAsync(
                    actorUserId,
                    serverId,
                    sourceSpaceId,
                    MoveVoiceMembersPermission,
                    [ViewVoiceSpacesPermission],
                    cancellationToken) ||
                !await HasExactSpacePermissionAsync(
                    actorUserId,
                    serverId,
                    targetSpaceId,
                    MoveVoiceMembersPermission,
                    [ViewVoiceSpacesPermission],
                    cancellationToken) ||
                !await CanUseVoiceChannelAsync(
                    candidate.UserId,
                    serverId,
                    targetSpaceId,
                    cancellationToken))
            {
                _logger.LogWarning(
                    "Voice participant move rejected because actor cannot moderate participant or participant cannot connect to target. ActorUserId={ActorUserId} ServerId={ServerId} SourceSpaceId={SourceSpaceId} TargetSpaceId={TargetSpaceId} ParticipantId={ParticipantId} TargetUserId={TargetUserId}",
                    actorUserId,
                    serverId,
                    sourceSpaceId,
                    targetSpaceId,
                    participantId,
                    candidate?.UserId);
                return null;
            }

            var targetMediaCapabilities = await GetServerVoiceMediaCapabilitiesAsync(
                candidate.UserId,
                serverId,
                targetSpaceId,
                cancellationToken);

            VoiceConnectionState? previous = null;
            VoiceConnectionState? moved = null;

            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (!VoiceConnections.TryGetValue(sourceSpaceId, out var sourceChannel))
                {
                    return null;
                }

                var sourceItem = sourceChannel
                    .FirstOrDefault(x =>
                        x.Value.ParticipantId == participantId &&
                        x.Value.ConnectionId == candidate.ConnectionId &&
                        x.Value.ServerId == serverId &&
                        x.Value.ChannelScope == VoiceChannelScopes.Server);

                if (string.IsNullOrWhiteSpace(sourceItem.Key) ||
                    !sourceChannel.TryRemove(sourceItem.Key, out previous))
                {
                    return null;
                }

                if (sourceChannel.IsEmpty)
                {
                    VoiceConnections.TryRemove(sourceSpaceId, out _);
                }

                moved = previous with
                {
                    SpaceId = targetSpaceId,
                    IsMuted = previous.IsMuted || !targetMediaCapabilities.CanSpeak,
                    IsCameraEnabled = previous.IsCameraEnabled && targetMediaCapabilities.CanUseVideo,
                    IsScreenSharing = previous.IsScreenSharing && targetMediaCapabilities.CanShareScreen,
                    CanSpeak = targetMediaCapabilities.CanSpeak,
                    CanUseVideo = targetMediaCapabilities.CanUseVideo,
                    CanShareScreen = targetMediaCapabilities.CanShareScreen,
                    JoinedAt = DateTime.UtcNow
                };

                var targetChannel = VoiceConnections.GetOrAdd(
                    targetSpaceId,
                    _ => new ConcurrentDictionary<string, VoiceConnectionState>());
                targetChannel[moved.ConnectionId] = moved;
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            _logger.LogInformation(
                "Voice participant moved. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SourceSpaceId={SourceSpaceId} TargetSpaceId={TargetSpaceId} ParticipantId={ParticipantId}",
                moved.ConnectionId,
                moved.UserId,
                serverId,
                sourceSpaceId,
                targetSpaceId,
                participantId);

            return new VoiceMoveResult(ToSnapshot(previous), ToSnapshot(moved));
        }

        public async Task<VoiceModerationResult?> UpdateParticipantModerationAsync(
            Guid actorUserId,
            Guid serverId,
            Guid spaceId,
            Guid participantId,
            bool? isServerMuted,
            bool? isServerDeafened,
            CancellationToken cancellationToken = default)
        {
            if (!isServerMuted.HasValue && !isServerDeafened.HasValue)
            {
                return null;
            }

            VoiceConnectionState? candidate = null;
            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (VoiceConnections.TryGetValue(spaceId, out var channel))
                {
                    candidate = channel.Values.FirstOrDefault(connection =>
                        connection.ParticipantId == participantId &&
                        connection.ServerId == serverId &&
                        connection.ChannelScope == VoiceChannelScopes.Server);
                }
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (candidate == null ||
                !await CanModerateServerVoiceParticipantAsync(
                    actorUserId,
                    serverId,
                    candidate.UserId,
                    cancellationToken) ||
                (isServerMuted.HasValue &&
                 !await HasExactSpacePermissionAsync(
                     actorUserId,
                     serverId,
                     spaceId,
                     MuteVoiceMembersPermission,
                     [ViewVoiceSpacesPermission],
                     cancellationToken)) ||
                (isServerDeafened.HasValue &&
                 !await HasExactSpacePermissionAsync(
                     actorUserId,
                     serverId,
                     spaceId,
                     DeafenVoiceMembersPermission,
                     [ViewVoiceSpacesPermission],
                     cancellationToken)))
            {
                _logger.LogWarning(
                    "Voice moderation rejected. ActorUserId={ActorUserId} ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId} TargetUserId={TargetUserId}",
                    actorUserId,
                    serverId,
                    spaceId,
                    participantId,
                    candidate?.UserId);
                return null;
            }

            VoiceConnectionState? updated = null;
            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (VoiceConnections.TryGetValue(spaceId, out var channel))
                {
                    var item = channel.FirstOrDefault(connection =>
                        connection.Value.ParticipantId == participantId &&
                        connection.Value.ConnectionId == candidate.ConnectionId &&
                        connection.Value.ServerId == serverId &&
                        connection.Value.ChannelScope == VoiceChannelScopes.Server);
                    if (!string.IsNullOrWhiteSpace(item.Key))
                    {
                        updated = item.Value with
                        {
                            IsServerMuted = isServerMuted ?? item.Value.IsServerMuted,
                            IsServerDeafened = isServerDeafened ?? item.Value.IsServerDeafened
                        };
                        channel[item.Key] = updated;

                        var moderationKey = (serverId, updated.UserId);
                        if (!updated.IsServerMuted && !updated.IsServerDeafened)
                        {
                            ServerModerationStates.TryRemove(moderationKey, out _);
                        }
                        else
                        {
                            ServerModerationStates[moderationKey] = new VoiceServerModerationState(
                                updated.IsServerMuted,
                                updated.IsServerDeafened);
                        }
                    }
                }
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (updated == null)
            {
                return null;
            }

            _logger.LogInformation(
                "Voice participant moderation updated. ActorUserId={ActorUserId} TargetUserId={TargetUserId} ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId} ServerMuted={IsServerMuted} ServerDeafened={IsServerDeafened}",
                actorUserId,
                updated.UserId,
                serverId,
                spaceId,
                participantId,
                updated.IsServerMuted,
                updated.IsServerDeafened);

            return new VoiceModerationResult(
                ToSnapshot(updated),
                updated.IsServerMuted,
                updated.IsServerDeafened);
        }

        public async Task<VoiceConnectionSnapshot?> DisconnectParticipantAsync(
            Guid actorUserId,
            Guid serverId,
            Guid spaceId,
            Guid participantId,
            CancellationToken cancellationToken = default)
        {
            VoiceConnectionState? candidate = null;
            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (VoiceConnections.TryGetValue(spaceId, out var channel))
                {
                    candidate = channel.Values.FirstOrDefault(connection =>
                        connection.ParticipantId == participantId &&
                        connection.ServerId == serverId &&
                        connection.ChannelScope == VoiceChannelScopes.Server);
                }
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (candidate == null ||
                !await CanModerateServerVoiceParticipantAsync(
                    actorUserId,
                    serverId,
                    candidate.UserId,
                    cancellationToken) ||
                !await HasExactSpacePermissionAsync(
                    actorUserId,
                    serverId,
                    spaceId,
                    DisconnectVoiceMembersPermission,
                    [ViewVoiceSpacesPermission],
                    cancellationToken))
            {
                _logger.LogWarning(
                    "Voice participant disconnect rejected. ActorUserId={ActorUserId} ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId} TargetUserId={TargetUserId}",
                    actorUserId,
                    serverId,
                    spaceId,
                    participantId,
                    candidate?.UserId);
                return null;
            }

            VoiceConnectionSnapshot? removed = null;
            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (VoiceConnections.TryGetValue(spaceId, out var channel) &&
                    channel.TryGetValue(candidate.ConnectionId, out var latest) &&
                    latest.ParticipantId == candidate.ParticipantId &&
                    latest.ServerId == serverId &&
                    latest.ChannelScope == VoiceChannelScopes.Server &&
                    channel.TryRemove(candidate.ConnectionId, out var removedConnection))
                {
                    removed = ToSnapshot(removedConnection);
                    if (channel.IsEmpty)
                    {
                        VoiceConnections.TryRemove(spaceId, out _);
                    }
                }
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (removed != null)
            {
                _logger.LogInformation(
                    "Voice participant disconnected by moderator. ActorUserId={ActorUserId} TargetUserId={TargetUserId} ServerId={ServerId} SpaceId={SpaceId} ParticipantId={ParticipantId}",
                    actorUserId,
                    removed.UserId,
                    serverId,
                    spaceId,
                    participantId);
            }

            return removed;
        }

        public async Task<VoiceSignalRoute?> GetSignalRouteAsync(
            string connectionId,
            Guid userId,
            Guid spaceId,
            Guid targetParticipantId,
            CancellationToken cancellationToken = default)
        {
            VoiceConnectionState? sender = null;
            List<VoiceConnectionState> targets = [];

            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (VoiceConnections.TryGetValue(spaceId, out var channel) &&
                    channel.TryGetValue(connectionId, out sender))
                {
                    targets = channel
                        .Where(x => x.Key != connectionId && x.Value.ParticipantId == targetParticipantId)
                        .Select(x => x.Value)
                        .ToList();
                }
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (sender == null || sender.UserId != userId ||
                !await CanUseConnectionAsync(sender, cancellationToken))
            {
                _logger.LogDebug(
                    "Voice signal ignored because sender is not in channel or no longer authorized. ConnectionId={ConnectionId} UserId={UserId} SpaceId={SpaceId} TargetUserId={TargetUserId}",
                    connectionId,
                    userId,
                    spaceId,
                    targetParticipantId);
                return null;
            }

            var authorizedTargets = new List<string>();
            foreach (var target in targets)
            {
                if (target.ChannelScope == sender.ChannelScope &&
                    target.ServerId == sender.ServerId &&
                    await CanUseConnectionAsync(target, cancellationToken))
                {
                    authorizedTargets.Add(target.ConnectionId);
                }
            }

            if (targets.Count > 0 && authorizedTargets.Count == 0)
            {
                return null;
            }

            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (!VoiceConnections.TryGetValue(spaceId, out var channel) ||
                    !channel.TryGetValue(connectionId, out var latestSender) ||
                    latestSender.ParticipantId != sender.ParticipantId ||
                    latestSender.UserId != sender.UserId)
                {
                    return null;
                }

                authorizedTargets = authorizedTargets
                    .Where(targetConnectionId =>
                        channel.TryGetValue(targetConnectionId, out var latestTarget) &&
                        latestTarget.ParticipantId == targetParticipantId &&
                        latestTarget.ChannelScope == latestSender.ChannelScope &&
                        latestTarget.ServerId == latestSender.ServerId)
                    .ToList();
                if (targets.Count > 0 && authorizedTargets.Count == 0)
                {
                    return null;
                }

                sender = latestSender;
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            return new VoiceSignalRoute(ToSnapshot(sender), authorizedTargets);
        }

        public async Task<object> GetChannelStatePayloadAsync(
            Guid? serverId,
            Guid spaceId,
            string channelScope = VoiceChannelScopes.Server,
            CancellationToken cancellationToken = default)
        {
            await VoiceConnectionsGate.WaitAsync(CancellationToken.None);
            try
            {
                return BuildVoiceStatePayload(serverId, spaceId, channelScope);
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }
        }

        public async Task<VoiceConnectionSnapshot?> DisconnectAsync(
            string connectionId,
            CancellationToken cancellationToken = default)
        {
            VoiceConnectionSnapshot? removed;

            await VoiceConnectionsGate.WaitAsync(CancellationToken.None);
            try
            {
                removed = RemoveVoiceConnection(connectionId) is { } connection
                    ? ToSnapshot(connection)
                    : null;
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (removed != null)
            {
                _logger.LogInformation(
                    "Voice disconnected. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId}",
                    connectionId,
                    removed.UserId,
                    removed.ServerId,
                    removed.SpaceId);
            }

            return removed;
        }

        public async Task<VoiceAccessReconciliationResult> ReconcileServerAccessAsync(
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            List<VoiceConnectionSnapshot> candidates;

            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                candidates = VoiceConnections.Values
                    .SelectMany(channel => channel.Values)
                    .Where(connection =>
                        connection.ChannelScope == VoiceChannelScopes.Server &&
                        connection.ServerId == serverId)
                    .Select(ToSnapshot)
                    .ToList();
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (candidates.Count == 0)
            {
                return new VoiceAccessReconciliationResult([], []);
            }

            var unauthorizedParticipantIds = new HashSet<Guid>();
            var mediaCapabilitiesByParticipantId = new Dictionary<Guid, VoiceMediaCapabilities>();
            foreach (var connection in candidates)
            {
                if (!await CanUseVoiceChannelAsync(
                        connection.UserId,
                        serverId,
                        connection.SpaceId,
                        cancellationToken))
                {
                    unauthorizedParticipantIds.Add(connection.ParticipantId);
                    continue;
                }

                mediaCapabilitiesByParticipantId[connection.ParticipantId] =
                    await GetServerVoiceMediaCapabilitiesAsync(
                        connection.UserId,
                        serverId,
                        connection.SpaceId,
                        cancellationToken);
            }

            var removed = new List<VoiceConnectionSnapshot>();
            var affectedSpaceIds = new HashSet<Guid>();
            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                foreach (var candidate in candidates)
                {
                    if (!VoiceConnections.TryGetValue(candidate.SpaceId, out var channel) ||
                        !channel.TryGetValue(candidate.ConnectionId, out var latest) ||
                        latest.ParticipantId != candidate.ParticipantId ||
                        latest.ChannelScope != VoiceChannelScopes.Server ||
                        latest.ServerId != serverId)
                    {
                        continue;
                    }

                    if (unauthorizedParticipantIds.Contains(candidate.ParticipantId))
                    {
                        if (channel.TryRemove(candidate.ConnectionId, out var removedConnection))
                        {
                            removed.Add(ToSnapshot(removedConnection));
                            affectedSpaceIds.Add(candidate.SpaceId);
                            if (channel.IsEmpty)
                            {
                                VoiceConnections.TryRemove(candidate.SpaceId, out _);
                            }
                        }
                        continue;
                    }

                    if (!mediaCapabilitiesByParticipantId.TryGetValue(
                            candidate.ParticipantId,
                            out var mediaCapabilities))
                    {
                        continue;
                    }

                    var sanitizedState = SanitizeState(
                        new VoiceStateUpdate(
                            latest.IsMuted,
                            latest.IsDeafened,
                            latest.IsCameraEnabled,
                            latest.IsScreenSharing),
                        mediaCapabilities);
                    var updated = latest with
                    {
                        IsMuted = sanitizedState.IsMuted,
                        IsCameraEnabled = sanitizedState.IsCameraEnabled,
                        IsScreenSharing = sanitizedState.IsScreenSharing,
                        CanSpeak = mediaCapabilities.CanSpeak,
                        CanUseVideo = mediaCapabilities.CanUseVideo,
                        CanShareScreen = mediaCapabilities.CanShareScreen
                    };
                    if (updated != latest)
                    {
                        channel[candidate.ConnectionId] = updated;
                        affectedSpaceIds.Add(candidate.SpaceId);
                    }
                }
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (removed.Count > 0 || affectedSpaceIds.Count > 0)
            {
                _logger.LogInformation(
                    "Reconciled server voice access. ServerId={ServerId} RemovedConnectionCount={RemovedConnectionCount} AffectedSpaceCount={AffectedSpaceCount}",
                    serverId,
                    removed.Count,
                    affectedSpaceIds.Count);
            }

            return new VoiceAccessReconciliationResult(
                removed,
                affectedSpaceIds.ToList());
        }

        public async Task<IReadOnlyList<VoiceConnectionSnapshot>> RemovePrivateSpaceMemberConnectionsAsync(
            Guid spaceId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            var removed = new List<VoiceConnectionSnapshot>();

            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (!VoiceConnections.TryGetValue(spaceId, out var channel))
                {
                    return removed;
                }

                foreach (var connection in channel.ToList())
                {
                    if (connection.Value.ChannelScope != VoiceChannelScopes.Private ||
                        connection.Value.ServerId != null ||
                        connection.Value.UserId != userId ||
                        !channel.TryRemove(connection.Key, out var removedConnection))
                    {
                        continue;
                    }

                    removed.Add(ToSnapshot(removedConnection));
                }

                if (channel.IsEmpty)
                {
                    VoiceConnections.TryRemove(spaceId, out _);
                }
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (removed.Count > 0)
            {
                _logger.LogInformation(
                    "Removed private voice connections after membership access changed. SpaceId={SpaceId} UserId={UserId} RemovedConnectionCount={RemovedConnectionCount}",
                    spaceId,
                    userId,
                    removed.Count);
            }

            return removed;
        }

        public async Task<VoiceAccessLeaseResult> RenewAccessLeaseAsync(
            string connectionId,
            Guid userId,
            Guid? serverId,
            Guid spaceId,
            string channelScope,
            CancellationToken cancellationToken = default)
        {
            VoiceConnectionState? current;
            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                current = VoiceConnections.TryGetValue(spaceId, out var channel) &&
                          channel.TryGetValue(connectionId, out var connection) &&
                          connection.UserId == userId &&
                          connection.ServerId == serverId &&
                          connection.ChannelScope == channelScope
                    ? connection
                    : null;
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }

            if (current == null)
            {
                return new VoiceAccessLeaseResult(IsActive: false);
            }

            var hasAccess = await CanUseConnectionAsync(current, cancellationToken);
            VoiceMediaCapabilities? mediaCapabilities = null;
            if (hasAccess &&
                current.ChannelScope == VoiceChannelScopes.Server &&
                current.ServerId.HasValue)
            {
                mediaCapabilities = await GetServerVoiceMediaCapabilitiesAsync(
                    current.UserId,
                    current.ServerId.Value,
                    current.SpaceId,
                    cancellationToken);
            }
            await VoiceConnectionsGate.WaitAsync(cancellationToken);
            try
            {
                if (!VoiceConnections.TryGetValue(spaceId, out var channel) ||
                    !channel.TryGetValue(connectionId, out var latest) ||
                    latest.ParticipantId != current.ParticipantId ||
                    latest.UserId != userId ||
                    latest.ServerId != serverId ||
                    latest.ChannelScope != channelScope)
                {
                    return new VoiceAccessLeaseResult(IsActive: false);
                }

                if (hasAccess)
                {
                    if (mediaCapabilities == null)
                    {
                        return new VoiceAccessLeaseResult(IsActive: true);
                    }

                    var sanitizedState = SanitizeState(
                        new VoiceStateUpdate(
                            latest.IsMuted,
                            latest.IsDeafened,
                            latest.IsCameraEnabled,
                            latest.IsScreenSharing),
                        mediaCapabilities);
                    var updated = latest with
                    {
                        IsMuted = sanitizedState.IsMuted,
                        IsCameraEnabled = sanitizedState.IsCameraEnabled,
                        IsScreenSharing = sanitizedState.IsScreenSharing,
                        CanSpeak = mediaCapabilities.CanSpeak,
                        CanUseVideo = mediaCapabilities.CanUseVideo,
                        CanShareScreen = mediaCapabilities.CanShareScreen
                    };
                    var stateChanged = updated != latest;
                    if (stateChanged)
                    {
                        channel[connectionId] = updated;
                    }

                    return new VoiceAccessLeaseResult(
                        IsActive: true,
                        StateChanged: stateChanged);
                }

                if (!channel.TryRemove(connectionId, out var removed))
                {
                    return new VoiceAccessLeaseResult(IsActive: false);
                }

                if (channel.IsEmpty)
                {
                    VoiceConnections.TryRemove(spaceId, out _);
                }

                _logger.LogInformation(
                    "Voice access lease denied and connection removed. ConnectionId={ConnectionId} UserId={UserId} ServerId={ServerId} SpaceId={SpaceId} ChannelScope={ChannelScope}",
                    connectionId,
                    userId,
                    serverId,
                    spaceId,
                    channelScope);
                return new VoiceAccessLeaseResult(
                    IsActive: false,
                    RemovedConnection: ToSnapshot(removed));
            }
            finally
            {
                VoiceConnectionsGate.Release();
            }
        }

        public async Task<bool> CanUseVoiceChannelAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            var capabilities = await _spaceAuthorization.GetCapabilitiesAsync(
                userId,
                serverId,
                spaceId,
                cancellationToken);
            return capabilities?.CanConnectVoice == true &&
                   await HasExactSpacePermissionAsync(
                       userId,
                       serverId,
                       spaceId,
                       ConnectVoicePermission,
                       [ViewVoiceSpacesPermission],
                       cancellationToken);
        }

        public async Task<bool> CanViewVoiceChannelAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            var capabilities = await _spaceAuthorization.GetCapabilitiesAsync(
                userId,
                serverId,
                spaceId,
                cancellationToken);
            return capabilities?.CanView == true &&
                   await HasExactSpacePermissionAsync(
                       userId,
                       serverId,
                       spaceId,
                       ViewVoiceSpacesPermission,
                       [],
                       cancellationToken);
        }

        private async Task<VoiceMediaCapabilities> GetServerVoiceMediaCapabilitiesAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            var dependencies = new[]
            {
                ViewVoiceSpacesPermission,
                ConnectVoicePermission
            };
            var canSpeak = await HasExactSpacePermissionAsync(
                userId,
                serverId,
                spaceId,
                SpeakInVoicePermission,
                dependencies,
                cancellationToken);
            var canUseVideo = await HasExactSpacePermissionAsync(
                userId,
                serverId,
                spaceId,
                UseVideoPermission,
                dependencies,
                cancellationToken);
            var canShareScreen = await HasExactSpacePermissionAsync(
                userId,
                serverId,
                spaceId,
                ShareScreenPermission,
                dependencies,
                cancellationToken);
            return new VoiceMediaCapabilities(
                canSpeak,
                canUseVideo,
                canShareScreen);
        }

        private Task<bool> HasExactSpacePermissionAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            string permissionCode,
            IReadOnlyList<string> dependencyCodes,
            CancellationToken cancellationToken)
        {
            return _spaceAuthorization.IsAllowedAsync(
                userId,
                serverId,
                spaceId,
                new SpaceAuthorizationRequirement(
                    permissionCode,
                    DependencyCodes: dependencyCodes),
                cancellationToken);
        }

        private static VoiceStateUpdate SanitizeState(
            VoiceStateUpdate state,
            VoiceMediaCapabilities capabilities)
        {
            return state with
            {
                IsMuted = state.IsMuted || !capabilities.CanSpeak,
                IsCameraEnabled = state.IsCameraEnabled && capabilities.CanUseVideo,
                IsScreenSharing = state.IsScreenSharing && capabilities.CanShareScreen
            };
        }

        public async Task<bool> CanUsePrivateVoiceChannelAsync(
            Guid userId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            return await _db.PrivateSpaceMembers
                .AsNoTracking()
                .AnyAsync(
                    x => x.SpaceId == spaceId &&
                         x.UserId == userId &&
                         x.StatusId == PrivateSpaceIds.MemberStatusActive &&
                         x.PrivateSpace.DeletedAt == null,
                    cancellationToken);
        }

        private async Task<bool> CanUseConnectionAsync(
            VoiceConnectionState connection,
            CancellationToken cancellationToken)
        {
            return connection.ChannelScope == VoiceChannelScopes.Private
                ? await CanUsePrivateVoiceChannelAsync(
                    connection.UserId,
                    connection.SpaceId,
                    cancellationToken)
                : connection.ServerId.HasValue &&
                  await CanUseVoiceChannelAsync(
                      connection.UserId,
                      connection.ServerId.Value,
                      connection.SpaceId,
                      cancellationToken);
        }

        private async Task<bool> CanModerateServerVoiceParticipantAsync(
            Guid actorUserId,
            Guid serverId,
            Guid targetUserId,
            CancellationToken cancellationToken)
        {
            if (actorUserId == targetUserId)
            {
                return false;
            }

            if (_serverAuthorization != null)
            {
                var actorContext = await _serverAuthorization.GetContextAsync(
                    actorUserId,
                    serverId,
                    cancellationToken);
                var targetContext = await _serverAuthorization.GetContextAsync(
                    targetUserId,
                    serverId,
                    cancellationToken);
                return actorContext != null &&
                       targetContext != null &&
                       ServerAuthorizationEvaluator.TryResolvePrincipal(
                           actorContext.Principal,
                           out var actorAuthority,
                           out _) &&
                       ServerAuthorizationEvaluator.TryResolvePrincipal(
                           targetContext.Principal,
                           out var targetAuthority,
                           out _) &&
                       ServerRoleAuthorityComparer.CanAffectSubject(
                           actorAuthority,
                           targetAuthority);
            }

            var server = await _db.Servers
                .AsNoTracking()
                .Where(candidate => candidate.Id == serverId && candidate.DeletedAt == null)
                .Select(candidate => new { candidate.OwnerUserId })
                .FirstOrDefaultAsync(cancellationToken);
            if (server == null)
            {
                return false;
            }

            var targetIsActive = await _db.ServerMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.ServerId == serverId &&
                    member.UserId == targetUserId &&
                    member.StatusId == ServerMemberStatusIds.Active &&
                    member.BannedAt == null &&
                    member.User.DeletedAt == null &&
                    member.User.StatusId == UserStatusIds.Active,
                    cancellationToken);
            if (!targetIsActive || targetUserId == server.OwnerUserId)
            {
                return false;
            }

            if (actorUserId == server.OwnerUserId)
            {
                return true;
            }

            var actorIsActive = await _db.ServerMembers
                .AsNoTracking()
                .AnyAsync(member =>
                    member.ServerId == serverId &&
                    member.UserId == actorUserId &&
                    member.StatusId == ServerMemberStatusIds.Active &&
                    member.BannedAt == null &&
                    member.User.DeletedAt == null &&
                    member.User.StatusId == UserStatusIds.Active,
                    cancellationToken);
            if (!actorIsActive)
            {
                return false;
            }

            if (await HasLegacyManageServerProtectionAsync(
                    targetUserId,
                    serverId,
                    cancellationToken))
            {
                return false;
            }

            var actorHighestRoleLevel = await GetHighestActiveRoleLevelAsync(
                actorUserId,
                serverId,
                cancellationToken);
            if (!actorHighestRoleLevel.HasValue)
            {
                return false;
            }

            var targetHighestRoleLevel = await GetHighestActiveRoleLevelAsync(
                targetUserId,
                serverId,
                cancellationToken);
            return actorHighestRoleLevel.Value <
                   (targetHighestRoleLevel ?? int.MaxValue);
        }

        private Task<bool> HasLegacyManageServerProtectionAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return _db.ServerMemberRoles
                .AsNoTracking()
                .AnyAsync(assignment =>
                    assignment.ServerId == serverId &&
                    assignment.Member.UserId == userId &&
                    assignment.Member.StatusId == ServerMemberStatusIds.Active &&
                    assignment.Member.BannedAt == null &&
                    assignment.RevokedAt == null &&
                    assignment.Role.DeletedAt == null &&
                    assignment.Role.Permissions.Any(permission =>
                        permission.IsGranted &&
                        permission.PermissionId ==
                            ServerGovernanceIds.PermissionManageServer),
                    cancellationToken);
        }

        private Task<int?> GetHighestActiveRoleLevelAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return _db.ServerMemberRoles
                .AsNoTracking()
                .Where(assignment =>
                    assignment.ServerId == serverId &&
                    assignment.Member.UserId == userId &&
                    assignment.Member.StatusId == ServerMemberStatusIds.Active &&
                    assignment.Member.BannedAt == null &&
                    assignment.RevokedAt == null &&
                    assignment.Role.DeletedAt == null)
                .Select(assignment => (int?)assignment.Role.Level)
                .MinAsync(cancellationToken);
        }

        private static VoiceConnectionState? RemoveVoiceConnection(
            string connectionId,
            Guid? onlySpaceId = null,
            Guid? exceptSpaceId = null)
        {
            return RemoveVoiceConnections(connectionId, onlySpaceId, exceptSpaceId)
                .FirstOrDefault();
        }

        private static List<VoiceConnectionState> RemoveVoiceConnections(
            string connectionId,
            Guid? onlySpaceId = null,
            Guid? exceptSpaceId = null)
        {
            var removedConnections = new List<VoiceConnectionState>();

            foreach (var item in VoiceConnections)
            {
                if (onlySpaceId.HasValue && item.Key != onlySpaceId.Value)
                {
                    continue;
                }

                if (exceptSpaceId.HasValue && item.Key == exceptSpaceId.Value)
                {
                    continue;
                }

                if (item.Value.TryRemove(connectionId, out var removed))
                {
                    removedConnections.Add(removed);

                    if (item.Value.IsEmpty)
                    {
                        VoiceConnections.TryRemove(item.Key, out _);
                    }
                }
            }

            return removedConnections;
        }

        private static List<VoiceConnectionState> RemoveVoiceConnectionsForUser(
            Guid userId,
            string? exceptConnectionId = null)
        {
            var removedConnections = new List<VoiceConnectionState>();

            foreach (var item in VoiceConnections)
            {
                foreach (var connection in item.Value)
                {
                    if (connection.Key == exceptConnectionId ||
                        connection.Value.UserId != userId)
                    {
                        continue;
                    }

                    if (item.Value.TryRemove(connection.Key, out var removed))
                    {
                        removedConnections.Add(removed);
                    }
                }

                if (item.Value.IsEmpty)
                {
                    VoiceConnections.TryRemove(item.Key, out _);
                }
            }

            return removedConnections;
        }

        private static object BuildVoiceStatePayload(
            Guid? serverId,
            Guid spaceId,
            string channelScope)
        {
            var participants = VoiceConnections.TryGetValue(spaceId, out var channel)
                ? channel.Values
                    .Where(x =>
                        x.ChannelScope == channelScope &&
                        (channelScope == VoiceChannelScopes.Private
                            ? x.ServerId == null
                            : x.ServerId == serverId))
                    .OrderBy(x => x.DisplayName)
                    .ThenBy(x => x.JoinedAt)
                    .Select(x => new
                    {
                        participantId = x.ParticipantId,
                        userId = x.UserId,
                        login = x.Login,
                        displayName = x.DisplayName,
                        isMuted = x.IsMuted || x.IsServerMuted,
                        isDeafened = x.IsDeafened || x.IsServerDeafened,
                        isServerMuted = x.IsServerMuted,
                        isServerDeafened = x.IsServerDeafened,
                        canSpeak = x.CanSpeak,
                        canUseVideo = x.CanUseVideo,
                        canShareScreen = x.CanShareScreen,
                        isCameraEnabled = x.IsCameraEnabled,
                        isScreenSharing = x.IsScreenSharing,
                        joinedAt = x.JoinedAt
                    })
                    .ToList()
                : [];

            return new
            {
                serverId,
                spaceId,
                channelScope,
                participants
            };
        }

        private static VoiceConnectionSnapshot ToSnapshot(VoiceConnectionState connection)
        {
            return new VoiceConnectionSnapshot(
                connection.ConnectionId,
                connection.ParticipantId,
                connection.ServerId,
                connection.SpaceId,
                connection.ChannelScope,
                connection.UserId);
        }

        private sealed record VoiceConnectionState(
            string ConnectionId,
            Guid ParticipantId,
            Guid? ServerId,
            Guid SpaceId,
            string ChannelScope,
            Guid UserId,
            string Login,
            string DisplayName,
            bool IsMuted,
            bool IsDeafened,
            bool IsServerMuted,
            bool IsServerDeafened,
            bool IsCameraEnabled,
            bool IsScreenSharing,
            bool CanSpeak,
            bool CanUseVideo,
            bool CanShareScreen,
            DateTime JoinedAt);

        private sealed record VoiceServerModerationState(
            bool IsServerMuted,
            bool IsServerDeafened);
    }
}
