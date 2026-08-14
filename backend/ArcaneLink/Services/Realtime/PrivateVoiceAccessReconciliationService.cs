using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Realtime.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Realtime
{
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
            _db = db;
            _voiceConnections = voiceConnections;
            _realtime = realtime;
            _logger = logger;
        }

        public async Task RevokeMemberBestEffortAsync(Guid spaceId, Guid userId)
        {
            IReadOnlyList<VoiceConnectionSnapshot> removed;
            try
            {
                removed = await _voiceConnections.RemovePrivateSpaceMemberConnectionsAsync(
                    spaceId,
                    userId,
                    CancellationToken.None);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Private voice access reconciliation failed after membership was closed. SpaceId={SpaceId} UserId={UserId}",
                    spaceId,
                    userId);
                return;
            }

            if (removed.Count == 0)
            {
                return;
            }

            await _realtime.NotifyUserBestEffortAsync(
                _logger,
                userId,
                RealtimeEventNames.VoiceConnectionReplaced,
                payload: null,
                CancellationToken.None);

            try
            {
                var recipients = await _db.PrivateSpaceMembers
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
                var payload = await _voiceConnections.GetChannelStatePayloadAsync(
                    null,
                    spaceId,
                    VoiceChannelScopes.Private,
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
                    "Private voice roster broadcast failed after membership was closed. SpaceId={SpaceId} UserId={UserId}",
                    spaceId,
                    userId);
            }
        }
    }
}
