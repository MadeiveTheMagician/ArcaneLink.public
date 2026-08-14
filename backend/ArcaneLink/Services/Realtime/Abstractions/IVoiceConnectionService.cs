namespace ArcaneLink.Services.Realtime.Abstractions
{
    public interface IVoiceConnectionService
    {
        Task<VoiceJoinResult?> JoinAsync(
            string connectionId,
            Guid userId,
            Guid serverId,
            Guid spaceId,
            VoiceStateUpdate state,
            CancellationToken cancellationToken = default);

        Task<VoiceJoinResult?> JoinPrivateSpaceAsync(
            string connectionId,
            Guid userId,
            Guid spaceId,
            VoiceStateUpdate state,
            CancellationToken cancellationToken = default);

        Task<VoiceConnectionSnapshot?> LeaveAsync(
            string connectionId,
            Guid spaceId,
            CancellationToken cancellationToken = default);

        Task<VoiceStateUpdateResult?> UpdateStateAsync(
            string connectionId,
            Guid spaceId,
            VoiceStateUpdate state,
            CancellationToken cancellationToken = default);

        Task<VoiceMoveResult?> MoveParticipantAsync(
            Guid actorUserId,
            Guid serverId,
            Guid sourceSpaceId,
            Guid targetSpaceId,
            Guid participantId,
            CancellationToken cancellationToken = default);

        Task<VoiceModerationResult?> UpdateParticipantModerationAsync(
            Guid actorUserId,
            Guid serverId,
            Guid spaceId,
            Guid participantId,
            bool? isServerMuted,
            bool? isServerDeafened,
            CancellationToken cancellationToken = default);

        Task<VoiceConnectionSnapshot?> DisconnectParticipantAsync(
            Guid actorUserId,
            Guid serverId,
            Guid spaceId,
            Guid participantId,
            CancellationToken cancellationToken = default);

        Task<VoiceSignalRoute?> GetSignalRouteAsync(
            string connectionId,
            Guid userId,
            Guid spaceId,
            Guid targetParticipantId,
            CancellationToken cancellationToken = default);

        Task<object> GetChannelStatePayloadAsync(
            Guid? serverId,
            Guid spaceId,
            string channelScope = VoiceChannelScopes.Server,
            CancellationToken cancellationToken = default);

        Task<VoiceConnectionSnapshot?> DisconnectAsync(
            string connectionId,
            CancellationToken cancellationToken = default);

        Task<VoiceAccessReconciliationResult> ReconcileServerAccessAsync(
            Guid serverId,
            CancellationToken cancellationToken = default);

        Task<IReadOnlyList<VoiceConnectionSnapshot>> RemovePrivateSpaceMemberConnectionsAsync(
            Guid spaceId,
            Guid userId,
            CancellationToken cancellationToken = default);

        Task<VoiceAccessLeaseResult> RenewAccessLeaseAsync(
            string connectionId,
            Guid userId,
            Guid? serverId,
            Guid spaceId,
            string channelScope,
            CancellationToken cancellationToken = default);

        Task<bool> CanUseVoiceChannelAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default);

        Task<bool> CanViewVoiceChannelAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default);

        Task<bool> CanUsePrivateVoiceChannelAsync(
            Guid userId,
            Guid spaceId,
            CancellationToken cancellationToken = default);
    }

    public static class VoiceChannelScopes
    {
        public const string Server = "server";
        public const string Private = "private";
    }

    public sealed record VoiceStateUpdate(
        bool IsMuted,
        bool IsDeafened,
        bool IsCameraEnabled,
        bool IsScreenSharing);

    public sealed record VoiceMediaCapabilities(
        bool CanSpeak,
        bool CanUseVideo,
        bool CanShareScreen)
    {
        public static VoiceMediaCapabilities PrivateVoice { get; } =
            new(true, true, true);
    }

    public sealed record VoiceJoinResult(
        Guid ParticipantId,
        Guid UserId,
        Guid? ServerId,
        Guid SpaceId,
        string ChannelScope,
        int ParticipantCount,
        IReadOnlyList<VoiceConnectionSnapshot> RemovedConnections,
        IReadOnlyList<VoiceConnectionSnapshot> ReplacedConnections);

    public sealed record VoiceStateUpdateResult(
        VoiceConnectionSnapshot Connection,
        VoiceStateUpdate State);

    public sealed record VoiceMoveResult(
        VoiceConnectionSnapshot PreviousConnection,
        VoiceConnectionSnapshot MovedConnection);

    public sealed record VoiceModerationResult(
        VoiceConnectionSnapshot Connection,
        bool IsServerMuted,
        bool IsServerDeafened);

    public sealed record VoiceSignalRoute(
        VoiceConnectionSnapshot Sender,
        IReadOnlyList<string> TargetConnectionIds);

    public sealed record VoiceConnectionSnapshot(
        string ConnectionId,
        Guid ParticipantId,
        Guid? ServerId,
        Guid SpaceId,
        string ChannelScope,
        Guid UserId);

    public sealed record VoiceAccessReconciliationResult(
        IReadOnlyList<VoiceConnectionSnapshot> RemovedConnections,
        IReadOnlyList<Guid> AffectedSpaceIds);

    public sealed record VoiceAccessLeaseResult(
        bool IsActive,
        VoiceConnectionSnapshot? RemovedConnection = null,
        bool StateChanged = false);
}
