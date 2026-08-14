using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;

namespace ArcaneLink.Services.Spaces
{
    public class SpaceRealtimeNotifier
    {
        private readonly IRealtimeNotificationService _realtime;
        private readonly ServerVoiceAccessReconciliationService _voiceAccess;
        private readonly ILogger<SpaceRealtimeNotifier> _logger;

        public SpaceRealtimeNotifier(
            IRealtimeNotificationService realtime,
            ServerVoiceAccessReconciliationService voiceAccess,
            ILogger<SpaceRealtimeNotifier> logger)
        {
            _realtime = realtime;
            _voiceAccess = voiceAccess;
            _logger = logger;
        }

        public async Task NotifySpacesChangedAsync(
            Guid serverId,
            Guid? _,
            CancellationToken cancellationToken)
        {
            await _voiceAccess.ReconcileServerBestEffortAsync(serverId);
            await _realtime.NotifyServerBestEffortAsync(
                _logger,
                serverId,
                RealtimeEventNames.ServerSpacesChanged,
                new { serverId },
                CancellationToken.None);
            await _realtime.NotifyServerBestEffortAsync(
                _logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId },
                CancellationToken.None);
        }
    }
}
