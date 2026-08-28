using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Spaces;

namespace ArcaneLink.Services.Realtime;

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
        this._voiceConnections = voiceConnections;
        this._realtime = realtime;
        this._audience = audience;
        this._logger = logger;
    }

    public async Task ReconcileServerBestEffortAsync(Guid serverId)
    {
        VoiceAccessReconciliationResult result;
        try
        {
            result = await this._voiceConnections.ReconcileServerAccessAsync(
                serverId,
                CancellationToken.None);
        }
        catch (Exception exception)
        {
            this._logger.LogWarning(
                exception,
                "Server voice access reconciliation failed after the database operation completed. ServerId={ServerId}",
                serverId);
            return;
        }

        foreach (var connection in result.RemovedConnections)
        {
            await this._realtime.NotifyConnectionBestEffortAsync(
                this._logger,
                connection.ConnectionId,
                RealtimeEventNames.VoiceAccessRevoked,
                new
                {
                    connection.ServerId,
                    connection.SpaceId,
                    connection.ChannelScope,
                    connection.ParticipantId
                },
                CancellationToken.None);
        }

        foreach (var spaceId in result.AffectedSpaceIds)
        {
            try
            {
                var legacyRecipients = await this._audience.GetAuthorizedUserIdsAsync(
                    serverId,
                    spaceId,
                    SpaceAction.View,
                    CancellationToken.None);
                var recipients = new List<Guid>(legacyRecipients.Count);
                foreach (var userId in legacyRecipients)
                {
                    if (await this._voiceConnections.CanViewVoiceChannelAsync(
                            userId,
                            serverId,
                            spaceId,
                            CancellationToken.None))
                    {
                        recipients.Add(userId);
                    }
                }
                var payload = await this._voiceConnections.GetChannelStatePayloadAsync(
                    serverId,
                    spaceId,
                    VoiceChannelScopes.Server,
                    CancellationToken.None);
                await this._realtime.NotifyUsersBestEffortAsync(
                    this._logger,
                    recipients,
                    "VoiceChannelStateChanged",
                    payload,
                    CancellationToken.None);
            }
            catch (Exception exception)
            {
                this._logger.LogWarning(
                    exception,
                    "Voice channel state broadcast failed after access reconciliation. ServerId={ServerId} SpaceId={SpaceId}",
                    serverId,
                    spaceId);
            }
        }
    }
}
