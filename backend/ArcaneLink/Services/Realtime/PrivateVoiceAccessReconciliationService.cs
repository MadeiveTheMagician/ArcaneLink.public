using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Realtime.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Realtime;

public sealed class PrivateVoiceAccessReconciliationService
{
    private readonly AppDbContext _db;
    private readonly IVoiceConnectionService _voiceConnections;
    private readonly IRealtimeNotificationService _realtime;
    private readonly ILogger<PrivateVoiceAccessReconciliationService> _logger;

    public PrivateVoiceAccessReconciliationService(
        AppDbContext db,
        IVoiceConnectionService voiceConnections,
        IRealtimeNotificationService realtime,
        ILogger<PrivateVoiceAccessReconciliationService> logger)
    {
        this._db = db;
        this._voiceConnections = voiceConnections;
        this._realtime = realtime;
        this._logger = logger;
    }

    public async Task RevokeMemberBestEffortAsync(Guid spaceId, Guid userId)
    {
        IReadOnlyList<VoiceConnectionSnapshot> removed;
        try
        {
            removed = await this._voiceConnections.RemovePrivateSpaceMemberConnectionsAsync(
                spaceId,
                userId,
                CancellationToken.None);
        }
        catch (Exception exception)
        {
            this._logger.LogWarning(
                exception,
                "Private voice access reconciliation failed after membership was closed. SpaceId={SpaceId} UserId={UserId}",
                spaceId,
                userId);
            return;
        }

        foreach (var connection in removed)
        {
            await this._realtime.NotifyUserBestEffortAsync(
                this._logger,
                userId,
                RealtimeEventNames.VoiceConnectionReplaced,
                new
                {
                    connection.ServerId,
                    connection.SpaceId,
                    connection.ChannelScope,
                    connection.ParticipantId
                },
                CancellationToken.None);
        }

        try
        {
            var callTransition = await this._voiceConnections
                .SynchronizePrivateCallAsync(
                    spaceId,
                    "membership_changed",
                    CancellationToken.None);
            if (removed.Count == 0 && callTransition == null)
            {
                return;
            }

            var recipients = await this._db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(member =>
                    member.SpaceId == spaceId &&
                    member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    member.PrivateSpace.DeletedAt == null &&
                    member.PrivateSpace.Space.DeletedAt == null &&
                    member.User.DeletedAt == null &&
                    member.User.StatusId == UserStatusIds.Active)
                .Select(member => member.UserId)
                .Distinct()
                .ToListAsync(CancellationToken.None);
            var payload = await this._voiceConnections.GetChannelStatePayloadAsync(
                null,
                spaceId,
                VoiceChannelScopes.Private,
                CancellationToken.None);
            await this._realtime.NotifyUsersBestEffortAsync(
                this._logger,
                recipients,
                "VoiceChannelStateChanged",
                payload,
                CancellationToken.None);

            if (callTransition != null)
            {
                await this._realtime.NotifyUsersBestEffortAsync(
                    this._logger,
                    recipients,
                    RealtimeEventNames.PrivateCallStateChanged,
                    callTransition.Call,
                    CancellationToken.None);
                await this._realtime.NotifyUserBestEffortAsync(
                    this._logger,
                    userId,
                    RealtimeEventNames.PrivateCallStateChanged,
                    callTransition.Call with
                    {
                        Phase = PrivateCallPhases.Ended,
                        Revision = callTransition.Call.Revision + 1,
                        EndedAt = DateTime.UtcNow,
                        ParticipantUserIds = [],
                        RingingUserIds = [],
                        DeclinedUserIds = [],
                        EndReason = "membership_revoked"
                    },
                    CancellationToken.None);

                if (callTransition.Call.Phase == PrivateCallPhases.Ended)
                {
                    var emptyPayload = await this._voiceConnections
                        .GetChannelStatePayloadAsync(
                            null,
                            spaceId,
                            VoiceChannelScopes.Private,
                            CancellationToken.None);
                    await this._realtime.NotifyUsersBestEffortAsync(
                        this._logger,
                        recipients,
                        "VoiceChannelStateChanged",
                        emptyPayload,
                        CancellationToken.None);
                }
            }
        }
        catch (Exception exception)
        {
            this._logger.LogWarning(
                exception,
                "Private voice roster broadcast failed after membership was closed. SpaceId={SpaceId} UserId={UserId}",
                spaceId,
                userId);
        }
    }
}
