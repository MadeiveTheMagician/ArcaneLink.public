using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Spaces;

namespace ArcaneLink.Services.Realtime
{
    public sealed class ServerVoiceAccessReconciliationService
    {
        private readonly IVoiceConnectionService _voiceConnections;
        private readonly IRealtimeNotificationService _realtime;
        private readonly ServerSpaceRealtimeAudienceService _audience;
        private readonly ILogger<ServerVoiceAccessReconciliationService> _logger;

        public ServerVoiceAccessReconciliationService(
            IVoiceConnectionService voiceConnections,
            IRealtimeNotificationService realtime,
            ServerSpaceRealtimeAudienceService audience,
            ILogger<ServerVoiceAccessReconciliationService> logger)
        {
            _voiceConnections = voiceConnections;
            _realtime = realtime;
            _audience = audience;
            _logger = logger;
        }

        public async Task ReconcileServerBestEffortAsync(Guid serverId)
        {
            VoiceAccessReconciliationResult result;
            try
            {
                result = await _voiceConnections.ReconcileServerAccessAsync(
                    serverId,
                    CancellationToken.None);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Server voice access reconciliation failed after the database operation completed. ServerId={ServerId}",
                    serverId);
                return;
            }

            foreach (var userId in result.RemovedConnections
                .Select(connection => connection.UserId)
                .Distinct())
            {
                await _realtime.NotifyUserBestEffortAsync(
                    _logger,
                    userId,
                    RealtimeEventNames.VoiceAccessRevoked,
                    new { serverId },
                    CancellationToken.None);
            }

            foreach (var spaceId in result.AffectedSpaceIds)
            {
                try
                {
                    var legacyRecipients = await _audience.GetAuthorizedUserIdsAsync(
                        serverId,
                        spaceId,
                        SpaceAction.View,
                        CancellationToken.None);
                    var recipients = new List<Guid>(legacyRecipients.Count);
                    foreach (var userId in legacyRecipients)
                    {
                        if (await _voiceConnections.CanViewVoiceChannelAsync(
                                userId,
                                serverId,
                                spaceId,
                                CancellationToken.None))
                        {
                            recipients.Add(userId);
                        }
                    }
                    var payload = await _voiceConnections.GetChannelStatePayloadAsync(
                        serverId,
                        spaceId,
                        VoiceChannelScopes.Server,
                        CancellationToken.None);
                    await _realtime.NotifyUsersBestEffortAsync(
                        _logger,
                        recipients,
                        "VoiceChannelStateChanged",
                        payload,
                        CancellationToken.None);
                }
                catch (Exception exception)
                {
                    _logger.LogWarning(
                        exception,
                        "Voice channel state broadcast failed after access reconciliation. ServerId={ServerId} SpaceId={SpaceId}",
                        serverId,
                        spaceId);
                }
            }
        }
    }
}
