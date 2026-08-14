using ArcaneLink.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ArcaneLink.Observability.HealthChecks
{
    public sealed class SignalRHealthCheck : IHealthCheck
    {
        private readonly IHubContext<RealtimeHub> _hubContext;

        public SignalRHealthCheck(IHubContext<RealtimeHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_hubContext.Clients != null
                ? HealthCheckResult.Healthy("SignalR realtime hub is registered.")
                : HealthCheckResult.Unhealthy("SignalR realtime hub is not available."));
        }
    }
}
