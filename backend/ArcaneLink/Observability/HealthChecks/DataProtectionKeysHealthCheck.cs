using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ArcaneLink.Observability.HealthChecks
{
    public sealed class DataProtectionKeysHealthCheck : IHealthCheck
    {
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;

        public DataProtectionKeysHealthCheck(
            IConfiguration configuration,
            IWebHostEnvironment environment)
        {
            _configuration = configuration;
            _environment = environment;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            var configuredPath = _configuration["DataProtection:KeysPath"];
            if (string.IsNullOrWhiteSpace(configuredPath))
            {
                return _environment.IsProduction()
                    ? HealthCheckResult.Unhealthy(
                        "A persistent Data Protection key path is required in production.")
                    : HealthCheckResult.Healthy(
                        "An ephemeral Data Protection key ring is allowed outside production.");
            }

            try
            {
                var keysPath = Path.GetFullPath(configuredPath);
                Directory.CreateDirectory(keysPath);

                var probePath = Path.Combine(
                    keysPath,
                    $".health-{Guid.NewGuid():N}.tmp");
                await File.WriteAllTextAsync(
                    probePath,
                    "ok",
                    cancellationToken);
                File.Delete(probePath);

                return HealthCheckResult.Healthy(
                    "The persistent Data Protection key directory is writable.");
            }
            catch (Exception exception)
            {
                return HealthCheckResult.Unhealthy(
                    "The persistent Data Protection key directory is not writable.",
                    exception);
            }
        }
    }
}
