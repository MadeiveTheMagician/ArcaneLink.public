using ArcaneLink.Services.JwtService;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Observability.HealthChecks
{
    public sealed class JwtSettingsHealthCheck : IHealthCheck
    {
        private readonly IOptions<JwtSettings> _settings;

        public JwtSettingsHealthCheck(IOptions<JwtSettings> settings)
        {
            this._settings = settings;
        }

        public Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            var settings = this._settings.Value;
            var isHealthy =
                !string.IsNullOrWhiteSpace(settings.Issuer) &&
                !string.IsNullOrWhiteSpace(settings.Audience) &&
                !string.IsNullOrWhiteSpace(settings.SecretKey) &&
                settings.SecretKey.Length >= 32 &&
                settings.AccessTokenExpirationMinutes > 0 &&
                settings.RefreshTokenExpirationDays > 0 &&
                settings.DeviceSessionIdleExpirationDays > 0 &&
                settings.DeviceSessionAbsoluteExpirationDays > 0 &&
                settings.DeviceSessionAbsoluteExpirationDays >=
                settings.DeviceSessionIdleExpirationDays;

            return Task.FromResult(isHealthy
                ? HealthCheckResult.Healthy("JWT settings are loaded.")
                : HealthCheckResult.Unhealthy("JWT settings are missing or invalid."));
        }
    }
}
